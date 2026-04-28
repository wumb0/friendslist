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
| `src/types/Friend.ts` | `Friend` and `FriendNote` types |
| `src/types/Group.ts` | `Group` and `GroupFrequency` types |
| `src/repository/FriendRepository.ts` | Friend repository interface |
| `src/repository/AsyncStorageFriendRepository.ts` | AsyncStorage implementation |
| `src/repository/GroupRepository.ts` | Group repository interface |
| `src/repository/AsyncStorageGroupRepository.ts` | AsyncStorage implementation (key: `groups_v1`) |
| `src/hooks/useFriends.ts` | All friend state + mutations |
| `src/hooks/useGroups.ts` | All group state + scheduling side effects |
| `src/context/ThemeContext.tsx` | Dark mode + `remindersEnabled` flag, persisted to `app_settings_v1` |
| `src/screens/HomeScreen.tsx` | Root screen — `SectionList` grouped by group |
| `src/components/FriendCard.tsx` | Swipeable card |
| `src/components/NotesModal.tsx` | Notes + check-in history timeline; group move row |
| `src/components/QuickNoteModal.tsx` | Bottom sheet for swipe-left note entry |
| `src/components/AddFriendModal.tsx` | Manual entry + multi-select contacts import; group pill picker |
| `src/components/SettingsModal.tsx` | Dark mode + reminders master switch + link to GroupsModal |
| `src/components/GroupsModal.tsx` | Add / edit / delete groups; per-group notification schedule |
| `src/components/Toast.tsx` | "Checked in with {name}" pill |
| `src/notifications/scheduler.ts` | expo-notifications — `scheduleGroupReminders` + `cancelAllReminders` |
| `src/utils/migrateGroups.ts` | One-time migration: creates default group from old global settings |
| `src/utils/timeAgo.ts` | Relative time formatting + urgency color |
| `src/utils/sortFriends.ts` | null lastCheckedIn sorts first (most overdue) |

### Friend Data Model
```typescript
interface FriendNote { id, content, createdAt: number, pinned?: boolean }
interface Friend { id, name, groupId: string, lastCheckedIn: number|null, createdAt, notes: FriendNote[], checkIns: number[] }
```
- `groupId` — every friend belongs to exactly one group
- `checkIns[]` — timestamps from plain right-swipe check-ins only
- `notes[]` — notes created via left-swipe or converted from check-ins
- Adding a note removes any same-day check-in entry (note supersedes it)
- Deleting a note converts it back to a check-in entry (same timestamp)
- Check-ins are deduped per calendar day

### Group Data Model
```typescript
type GroupFrequency = 'daily' | 'weekly' | 'off';
interface Group { id, name, notificationFrequency: GroupFrequency, notificationHour: number, notificationMinute: number }
```
- Each group has its own notification schedule
- `'off'` suppresses notifications for that group entirely
- `AppSettings.remindersEnabled` (in `app_settings_v1`) is a master switch that overrides all groups

### Swipe Directions (Critical Gotcha)
`FriendCard` uses `react-native-gesture-handler` `Swipeable` with both `renderLeftActions` and `renderRightActions`. When both are active, the `onSwipeableOpen` direction values are **inverted**:
- `direction === 'left'` → user swiped RIGHT → check-in
- `direction === 'right'` → user swiped LEFT → add note

Card uses `key={\`${friend.id}-${friend.lastCheckedIn}\`}` to force remount after check-in (resets open state).

### Notes Modal Timeline
`buildTimeline()` merges `notes[]` and `checkIns[]` into a single sorted list:
- Pinned notes first (newest-first among pinned)
- Then unpinned notes + check-in rows interleaved, sorted newest-first

Long-pressing a check-in row converts it to a note (inline editor expands). Tapping a note's content edits it inline.

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

`scheduleGroupReminders` cancels all existing notifications then schedules one per group (targeting the most-overdue friend in that group via `sortFriends`). Groups with `notificationFrequency === 'off'` or no members are skipped. All scheduler calls are wrapped in try/catch for Expo Go compatibility.

### Data Migration
`migrateGroups()` runs in `App.tsx` before first render (gates on a `ready` state). It is idempotent:
- First launch: creates a default "Friends" group from any old global notification settings in `app_settings_v1`, then strips those fields from settings.
- Every launch: assigns any friends missing a `groupId` to the first group (handles partial-failure recovery).

### Group Management
Groups are managed via Settings → Reminders → Groups & Schedules (`GroupsModal`):
- Add a new group with custom name and notification schedule
- Edit any group's name or schedule
- Delete a group — if it has members, an alert offers to move them to another group before deleting; cannot delete the last group

## App Config
- Package: `in.wumb0.friendslist`
- `edgeToEdgeEnabled: true` (Android)
- `newArchEnabled: true`
- Storage keys: `friends_v1` (friends), `groups_v1` (groups), `app_settings_v1` (settings)
