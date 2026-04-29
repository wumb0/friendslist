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
| `src/types/Friend.ts` | `Friend`, `FriendNote`, and re-exported `SignificantDate` types |
| `src/types/SignificantDate.ts` | `SignificantDate` type |
| `src/types/Group.ts` | `Group` and `GroupFrequency` types |
| `src/repository/FriendRepository.ts` | Friend repository interface |
| `src/repository/AsyncStorageFriendRepository.ts` | AsyncStorage implementation |
| `src/repository/GroupRepository.ts` | Group repository interface |
| `src/repository/AsyncStorageGroupRepository.ts` | AsyncStorage implementation (key: `groups_v1`) |
| `src/hooks/useFriends.ts` | All friend state + mutations |
| `src/hooks/useGroups.ts` | All group state + scheduling side effects |
| `src/context/ThemeContext.tsx` | Dark mode + `remindersEnabled` flag, persisted to `app_settings_v1` |
| `src/screens/HomeScreen.tsx` | Root screen — `FlatList` with group tab selector and cross-group search |
| `src/components/FriendCard.tsx` | Swipeable card; long-press action sheet for Edit Name / Delete |
| `src/components/NotesModal.tsx` | Two-tab modal: History (notes + check-in timeline) and Dates (significant dates); group move row |
| `src/components/QuickNoteModal.tsx` | Bottom sheet for swipe-left note entry |
| `src/components/AddFriendModal.tsx` | Manual entry + multi-select contacts import; group pill picker |
| `src/components/SettingsModal.tsx` | Dark mode + reminders master switch + link to GroupsModal |
| `src/components/GroupsModal.tsx` | Add / edit / delete groups; per-group notification schedule |
| `src/components/Toast.tsx` | "Checked in with {name}" pill |
| `src/notifications/scheduler.ts` | expo-notifications — `scheduleGroupReminders` (group reminders + yearly significant-date reminders) + `cancelAllReminders` |
| `src/utils/migrateGroups.ts` | One-time migration: creates default group from old global settings |
| `src/utils/timeAgo.ts` | Relative time formatting + urgency color |
| `src/utils/sortFriends.ts` | null lastCheckedIn sorts first (most overdue) |
| `android/.../NightModeModule.kt` | Native Kotlin module: calls `AppCompatDelegate.setDefaultNightMode()` so native dialogs follow app dark mode |
| `android/.../NightModePackage.kt` | Registers `NightModeModule` with React Native |

### Friend Data Model
```typescript
interface FriendNote { id, content, createdAt: number, pinned?: boolean }
interface SignificantDate { id, label: string, month: number, day: number, year?: number, notifyEnabled: boolean, notifyHour: number, notifyMinute: number }
interface Friend { id, name, groupId: string, lastCheckedIn: number|null, createdAt, notes: FriendNote[], checkIns: number[], significantDates?: SignificantDate[] }
```
- `groupId` — every friend belongs to exactly one group
- `checkIns[]` — timestamps from plain right-swipe check-ins only
- `notes[]` — notes created via left-swipe or converted from check-ins
- Adding a note removes any same-day check-in entry (note supersedes it)
- Deleting a note converts it back to a check-in entry (same timestamp)
- Check-ins are deduped per calendar day
- `significantDates[]` — birthdays, anniversaries, etc.; optional, defaults to `[]` in `migrate()`
- `SignificantDate.month` is 1-based (1 = January); `year` is optional (omit for year-less dates like "March 15")

### Group Data Model
```typescript
type GroupFrequency = 'daily' | 'weekly' | 'monthly' | 'off';
interface Group {
  id: string;
  name: string;                        // max 20 chars
  notificationFrequency: GroupFrequency;
  notificationHour: number;
  notificationMinute: number;
  notificationWeekday?: number;        // 1=Sun…7=Sat, used when frequency='weekly'
  notificationDay?: number;            // 1–28, used when frequency='monthly'
  significantDatesEnabled: boolean;    // whether yearly date reminders fire for this group
}
```
- Each group has its own notification schedule
- `'off'` suppresses notifications for that group entirely
- `AppSettings.remindersEnabled` (in `app_settings_v1`) is a master switch that overrides all groups
- Monthly trigger uses `CALENDAR` type with `day: notificationDay ?? 1, repeats: true`; capped at 28 to fire every month
- Weekly trigger uses `weekday: notificationWeekday ?? 2`
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

**Dates tab** — lists `significantDates[]` with Add/Edit/Delete actions:
- Tap a date card or tap "Add Date" to open the inline date form (replaces tab content; no Back/Done in header — form has its own Cancel/Save)
- `onRequestClose` when form is open goes back to dates list, not all the way out (Android back button safe)
- Form: label TextInput with suggestion chips that appear on focus (filtered by prefix match, styled as `theme.badge` pills), date picker, "Include year" toggle, notify toggle + time picker
- New date defaults: `notifyHour`/`notifyMinute` inherited from the group's notification time
- "Import Birthday from Contacts" searches contacts by friend name for a birthday field; uses `Contacts.Fields.Birthday` (expo-contacts `Date.month` is 0-based — add 1 when storing)
- Long-pressing a date card shows Edit/Delete action sheet (iOS) or Alert (Android)

### Same-Day Note Recall
When swiping left to add a note, `HomeScreen` checks if the friend already has a note from today. If so, `QuickNoteModal` opens pre-filled and submitting calls `updateNote` instead of `addNote`.

### Status Bar / Modal Padding
Modals (`NotesModal`, `SettingsModal`, `AddFriendModal`) use:
```tsx
const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;
```
`StatusBar.currentHeight` is Android-only and gives the exact OS status bar height in dp. This looks wrong in Expo Go (which positions modals differently from standalone builds) but is correct in the APK. Always verify modal layout with the actual APK, not Expo Go.

### Notification Scheduling
`useGroups` owns scheduling. A `useEffect` watching `[groups, friends, settings.remindersEnabled]` calls `scheduleGroupReminders` (or `cancelAllReminders` when the master switch is off) on every change. The first render is skipped via `useRef` to avoid redundant scheduling on mount.

`scheduleGroupReminders` cancels all existing notifications then schedules in two passes:
1. **Group reminders** — one per group (targeting the most-overdue friend via `sortFriends`). Groups with `notificationFrequency === 'off'` or no members are skipped.
2. **Significant date reminders** — one YEARLY notification per enabled `SignificantDate` across all friends. Uses `SchedulableTriggerInputTypes.YEARLY` with 1-based month. The `remindersEnabled` master switch suppresses both streams (cancel-all is called instead of schedule when it's off).

All scheduler calls are wrapped in try/catch for Expo Go compatibility. iOS has a 64-notification cap; group reminders are scheduled first so they're never dropped in favour of date reminders.

### Notification Tap Navigation
Each scheduled notification carries `data: { friendId, groupId }`. Two handlers in `HomeScreen`:
- **Foreground**: `addNotificationTapListener` sets `activeGroupId` + `pendingFriendId`.
- **Cold start**: `getInitialNotificationTarget` (wraps `Notifications.getLastNotificationResponseAsync`) sets the same state on mount.
A `useEffect` watching `[pendingFriendId, visibleFriends]` calls `listRef.current?.scrollToIndex` once the correct group's friends are rendered, then clears `pendingFriendId`.

### Data Migration
`migrateGroups()` runs in `App.tsx` before first render (gates on a `ready` state). It is idempotent:
- First launch: creates a default "Friends" group from any old global notification settings in `app_settings_v1`, then strips those fields from settings.
- Every launch: assigns any friends missing a `groupId` to the first group (handles partial-failure recovery).

### Group Management
Groups are managed via Settings → Reminders → Groups & Schedules (`GroupsModal`):
- Add a new group with custom name (max 20 chars) and notification schedule
- Edit any group's name or schedule; frequency options: daily, weekly (pick day of week), monthly (pick day 1–28), off
- Delete a group — if it has members, an action sheet offers to move them to another group before deleting; cannot delete the last group
- Groups & Schedules is always accessible even when the master reminders switch is off; a banner explains the disabled state
- Android back button in the edit-schedule view returns to the groups list (not all the way out to Settings)

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
