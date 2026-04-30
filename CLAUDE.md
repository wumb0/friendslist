# FriendsList — Claude Context

## What This Is
A React Native + Expo (SDK 54, managed workflow, TypeScript) mobile app for iOS and Android. Users add friends, swipe to check in with them, and the list sorts so the most overdue contacts bubble to the top.

## Running Commands
**Always use the node Docker container for npx/npm:**
```bash
docker run --rm -v /Users/wumb0/Projects/friendslist:/app -w /app node:latest npx <command>
```
Type-check: `npx tsc --noEmit`

## Building the Android APK
```bash
# One-time: clear the autolinking cache (must do after package name changes)
rm -rf android/build/generated/autolinking

# Build
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```
If you get `package com.anonymous.app does not exist` errors, delete `android/build/generated/autolinking/` — the autolinking cache uses lock-file SHAs and won't regenerate unless lock files change or the directory is deleted.

After editing `app.json` (name, package), run `npx expo prebuild --platform android` to sync native files, then delete the autolinking cache and rebuild.

## Architecture

### Data Flow
```
UI components → useFriends / useGroups hooks → Repository interfaces → AsyncStorage implementations
```
All friend state lives in `useFriends`. All group state lives in `useGroups`. Nothing talks to AsyncStorage directly — always goes through the repository. The interfaces exist so cloud sync can be added later.

### Key Files
| File | Purpose |
|------|---------|
| `src/types/Friend.ts` | `Friend`, `FriendNote`, `SignificantDate`, and `OneTimeEvent` types |
| `src/types/Group.ts` | `Group`, `Schedule`, and `ScheduleFrequency` types |
| `src/repository/FriendRepository.ts` | Friend repository interface |
| `src/repository/AsyncStorageFriendRepository.ts` | AsyncStorage implementation |
| `src/repository/GroupRepository.ts` | Group repository interface |
| `src/repository/AsyncStorageGroupRepository.ts` | AsyncStorage implementation (key: `groups_v1`) |
| `src/hooks/useFriends.ts` | All friend state + mutations |
| `src/hooks/useGroups.ts` | All group state + scheduling side effects |
| `src/context/ThemeContext.tsx` | Dark mode + `remindersEnabled` flag, persisted to `app_settings_v1` |
| `src/screens/HomeScreen.tsx` | Root screen — `FlatList` with group tab selector and cross-group search |
| `src/components/FriendCard.tsx` | Swipeable card; long-press action sheet for Edit Name / Delete |
| `src/components/NotesModal.tsx` | Two-tab modal: History (notes + check-in timeline) and Dates (significant dates + one-time events); group move row |
| `src/components/DateForm.tsx` | `DateForm` (add/edit significant dates) + `DateCard` + shared `dateFormStyles`/`dateCardStyles` |
| `src/components/EventForm.tsx` | `EventForm` (add/edit one-time events) + `EventCard`; reuses `dateFormStyles` from `DateForm` |
| `src/components/QuickNoteModal.tsx` | Bottom sheet for swipe-left note entry |
| `src/components/AddFriendModal.tsx` | Manual entry + multi-select contacts import; group pill picker |
| `src/components/SettingsModal.tsx` | Dark mode + reminders master switch + link to GroupsModal |
| `src/components/GroupsModal.tsx` | Add / edit / delete groups; per-group notification schedule |
| `src/components/Toast.tsx` | "Checked in with {name}" pill |
| `src/notifications/scheduler.ts` | expo-notifications — `refreshScheduledNotifications` (group repeating triggers + yearly significant-date triggers + one-shot event DATE triggers) + `cancelAllReminders` |
| `src/utils/cleanupExpiredEvents.ts` | Scans all friends on startup and deletes `oneTimeEvents` whose `eventDate` is in the past |
| `src/utils/formatTime.ts` | `formatTime(hour, minute)` → `"9:00 AM"` style string; shared by GroupsModal, DateForm, EventForm |
| `src/utils/timeAgo.ts` | Relative time formatting + urgency color |
| `src/utils/sortFriends.ts` | null lastCheckedIn sorts first (most overdue) |
| `android/.../NightModeModule.kt` | Native Kotlin module: calls `AppCompatDelegate.setDefaultNightMode()` so native dialogs follow app dark mode |
| `android/.../NightModePackage.kt` | Registers `NightModeModule` with React Native |

### Friend Data Model
```typescript
interface FriendNote { id, content, createdAt: number, pinned?: boolean }
interface SignificantDate { id, label: string, month: number, day: number, year?: number, notifyEnabled: boolean, notifyHour: number, notifyMinute: number }
interface OneTimeEvent { id, label: string, eventDate: number, notifyDaysBefore: number, notifyHour: number, notifyMinute: number, notifyEnabled: boolean }
interface Friend { id, name, groupId: string, lastCheckedIn: number|null, createdAt, notes: FriendNote[], checkIns: number[], significantDates: SignificantDate[], oneTimeEvents: OneTimeEvent[] }
```
- `groupId` — every friend belongs to exactly one group
- `checkIns[]` — timestamps from plain right-swipe check-ins only
- `notes[]` — notes created via left-swipe or converted from check-ins
- Adding a note removes any same-day check-in entry (note supersedes it)
- Deleting a note converts it back to a check-in entry (same timestamp)
- Check-ins are deduped per calendar day
- `significantDates[]` — birthdays, anniversaries, etc.; required, always `[]` or populated
- `SignificantDate.month` is 1-based (1 = January); `year` is optional (omit for year-less dates like "March 15")
- `oneTimeEvents[]` — future one-time reminders (surgery, trip, etc.); required, always `[]` or populated
- `OneTimeEvent.eventDate` is a midnight-local timestamp; `notifyDaysBefore` is 0|1|2|7
- Expired one-time events (eventDate < today) are auto-deleted on app startup via `cleanupExpiredEvents()`

### Group Data Model
```typescript
type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
interface Schedule {
  id: string;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  weekday?: number;  // 1=Sun…7=Sat, weekly only
  day?: number;      // 1–28, monthly only
}
interface Group {
  id: string;
  name: string;               // max 20 chars
  schedules: Schedule[];      // empty = no reminders for this group
  significantDatesEnabled: boolean;
}
```
- Each group has zero or more independent schedules (e.g. Monday + Friday, or 3rd + 17th monthly)
- `schedules: []` suppresses notifications for that group entirely (replaces the old `'off'` frequency)
- `AppSettings.remindersEnabled` (in `app_settings_v1`) is a master switch that overrides all groups
- `daily` → `DAILY` repeating trigger; `weekly` → `WEEKLY` repeating trigger; `monthly` → `CALENDAR` repeating trigger with `day` and `repeats: true`
- `significantDatesEnabled` gates the yearly significant-date notification stream for the group; defaults to `true` in the migration

### HomeScreen Layout
- Header row: title + search icon (left of settings icon). Tapping the search icon toggles the search bar.
- Search bar is hidden by default; opens with `autoFocus` and a "Cancel" button that clears the query and closes.
- "Include notes" toggle pill is visible as soon as the search bar opens (before any text is typed).
- Group tab selector (horizontal `ScrollView`) is hidden while the search bar is open.
- Search is cross-group; results show the group name below the friend's time.
- `noteSnippet` shows a ±30-char excerpt only when the match is in a note (not the name).
- Notification tap sets `activeGroupId` + `pendingFriendId`; a `useEffect` watching `[pendingFriendId, visibleFriends]` scrolls the `FlatList` to the friend once the correct group is rendered.

### FriendCard Long-Press
Long-pressing a card triggers a haptic + action sheet (iOS `ActionSheetIOS`) or `Alert` (Android) with:
- **Edit Name** → opens a themed `Modal` (transparent + `presentationStyle="overFullScreen"`) pre-filled with the current name; Save calls `renameFriend` in `useFriends`.
- **Delete** → confirmation alert then `deleteFriend`.

### Swipe Directions (Critical Gotcha)
`FriendCard` uses `react-native-gesture-handler` `Swipeable` with both `renderLeftActions` and `renderRightActions`. When both are active, the `onSwipeableOpen` direction values are **inverted**:
- `direction === 'left'` → user swiped RIGHT → check-in
- `direction === 'right'` → user swiped LEFT → add note

Card uses `key={\`${friend.id}-${friend.lastCheckedIn}\`}` to force remount after check-in (resets open state).

### Notes Modal
The modal has two tabs below the group row: **History** and **Dates**.

**History tab** — `buildTimeline()` merges `notes[]` and `checkIns[]` into a single sorted list:
- Pinned notes first (newest-first among pinned)
- Then unpinned notes + check-in rows interleaved, sorted newest-first

Long-pressing a check-in row converts it to a note (inline editor expands). Tapping a note's content edits it inline.

**Dates tab** — two sections: "Recurring Dates" and "One-Time Events".

*Recurring Dates* — lists `significantDates[]`:
- Tap a date card or tap "Add Date" to open the inline date form (replaces tab content)
- `onRequestClose` priority: event form open → date form open → close modal (Android back button safe)
- Form: label TextInput with suggestion chips on focus, date picker, "Include year" toggle, notify toggle + time picker
- New date defaults: `notifyHour`/`notifyMinute` from `currentGroup?.schedules[0]?.hour ?? 9`
- "Import Birthday from Contacts" searches contacts by friend name; expo-contacts `Date.month` is 0-based — add 1 when storing
- Long-pressing a date card shows Edit/Delete action sheet (iOS) or Alert (Android)

*One-Time Events* — lists `oneTimeEvents[]`:
- Tap "Add Event" or long-press an event card (Edit/Delete) to open the event form
- Form: label TextInput, date picker (date mode), notify toggle; when notify on: offset segmented control (Same day / 1 day before / 2 days before / 1 week before) + time picker
- `notifyDaysBefore` stored as 0|1|2|7
- Expired events are cleaned up at startup; events due in the past are skipped by the scheduler

### Same-Day Note Recall
When swiping left to add a note, `HomeScreen` checks if the friend already has a note from today. If so, `QuickNoteModal` opens pre-filled and submitting calls `updateNote` instead of `addNote`.

### Status Bar / Modal Padding
Modals (`NotesModal`, `SettingsModal`, `AddFriendModal`) use:
```tsx
const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;
```
`StatusBar.currentHeight` is Android-only and gives the exact OS status bar height in dp. This looks wrong in Expo Go (which positions modals differently from standalone builds) but is correct in the APK. Always verify modal layout with the actual APK, not Expo Go.

### Notification Scheduling
`useGroups` owns scheduling. A `useEffect` watching `[groups, friends, settings.remindersEnabled]` calls `refreshScheduledNotifications` (or `cancelAllReminders` when the master switch is off) on every change. The first render is skipped via `useRef` to avoid redundant scheduling on mount. An `AppState` listener also triggers a refresh whenever the app comes to the foreground (to pick up newly added one-time events).

`refreshScheduledNotifications` cancels all existing notifications then schedules in three passes:
1. **Group reminders** — one per `Schedule` per group (repeating triggers: DAILY/WEEKLY/CALENDAR). Groups with no schedules or no members are skipped. Tap data: `{ groupId }` only — no `friendId` baked in.
2. **Significant date reminders** — one YEARLY notification per enabled `SignificantDate` across all friends whose group has `significantDatesEnabled`. Uses `SchedulableTriggerInputTypes.YEARLY` with 1-based month.
3. **One-time event reminders** — one DATE one-shot trigger per enabled `OneTimeEvent` where the fire time is still in the future. Fire time = `startOfDay(eventDate) - notifyDaysBefore * 86400000` then set to `notifyHour:notifyMinute`. Already-past events are skipped (not an error).

All scheduler calls are wrapped in try/catch for Expo Go compatibility. iOS has a 64-notification cap; repeating triggers (group/date) count as 1 slot each regardless of recurrences, so the cap is rarely a concern.

### Notification Tap Navigation
Each scheduled notification carries `data: { groupId, friendId? }` (`friendId` is present for significant-date and one-time-event notifications, absent for group-schedule notifications). Two handlers in `HomeScreen`:
- **Foreground**: `addNotificationTapListener` sets `activeGroupId` + `pendingFriendId`.
- **Cold start**: `getInitialNotificationTarget` (wraps `Notifications.getLastNotificationResponseAsync`) sets the same state on mount.
A `useEffect` watching `[pendingFriendId, visibleFriends]` calls `listRef.current?.scrollToIndex` once the correct group's friends are rendered, then clears `pendingFriendId`.

### Startup
`cleanupExpiredEvents()` runs in `App.tsx` before first render (gates on a `ready` state). It scans all friends and deletes any `oneTimeEvents` whose `eventDate` is in the past.

### Group Management
Groups are managed via Settings → Reminders → Groups & Schedules (`GroupsModal`). Three-level navigation (push-style, single Modal):
1. **Groups list** — shows each group with a schedule summary ("Off" / "Daily · 9:00 AM" / "3 schedules")
2. **Group edit** — name field, list of schedules (each tappable + trash icon), "Add Schedule" row, significant dates toggle, Delete group row
3. **Schedule sub-editor** — frequency radio (Daily/Weekly/Monthly, no Off), weekday picker (weekly), day stepper (monthly), time picker

- Delete a group — if it has members, an action sheet offers to move them to another group before deleting; cannot delete the last group
- Groups & Schedules is always accessible even when the master reminders switch is off; a banner explains the disabled state
- Android back button in the schedule sub-editor returns to the group edit view (not all the way out)

### Android Dark Mode (Native Module)
`Appearance.setColorScheme()` only updates the JS-side color scheme — it does NOT call `AppCompatDelegate.setDefaultNightMode()`, so native Android dialogs (DateTimePicker, Alert) ignore the app's custom dark mode toggle.

`NightModeModule` / `NightModePackage` fix this:
- `ThemeContext` calls `NativeModules.NightMode?.setNightMode(isDark)` on Android whenever dark mode changes (guarded by `Platform.OS === 'android'`)
- The module calls `AppCompatDelegate.setDefaultNightMode(MODE_NIGHT_YES/NO)` then posts `activity.delegate.applyDayNight()` to the main thread via `Handler(Looper.getMainLooper()).post { ... }`
- **Gotcha**: `ReactApplicationContext` does NOT have a `runOnUiThread` method — use `Handler(Looper.getMainLooper()).post {}` instead
- `values-night/styles.xml` sets `windowLightStatusBar = false` for system-level dark mode; `values/styles.xml` sets it to `true` for light mode

## App Config
- Package: `in.wumb0.friendslist`
- `edgeToEdgeEnabled: true` (Android)
- `newArchEnabled: true`
- Storage keys: `friends_v1` (friends), `groups_v1` (groups), `app_settings_v1` (settings)
