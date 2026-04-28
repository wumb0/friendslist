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
UI components → useFriends hook → FriendRepository interface → AsyncStorageFriendRepository
```
All state lives in `useFriends`. Nothing talks to AsyncStorage directly — always goes through the repository. The interface exists so cloud sync can be added later.

### Key Files
| File | Purpose |
|------|---------|
| `src/types/Friend.ts` | `Friend` and `FriendNote` types |
| `src/repository/FriendRepository.ts` | Repository interface |
| `src/repository/AsyncStorageFriendRepository.ts` | AsyncStorage implementation |
| `src/hooks/useFriends.ts` | All friend state + mutations |
| `src/context/ThemeContext.tsx` | Dark mode + notification settings, persisted to `app_settings_v1` |
| `src/screens/HomeScreen.tsx` | Root screen |
| `src/components/FriendCard.tsx` | Swipeable card |
| `src/components/NotesModal.tsx` | Notes + check-in history timeline |
| `src/components/QuickNoteModal.tsx` | Bottom sheet for swipe-left note entry |
| `src/components/AddFriendModal.tsx` | Manual entry + multi-select contacts import |
| `src/components/SettingsModal.tsx` | Dark mode + notification config |
| `src/components/Toast.tsx` | "Checked in with {name}" pill |
| `src/notifications/scheduler.ts` | expo-notifications daily/weekly scheduling |
| `src/utils/timeAgo.ts` | Relative time formatting + urgency color |
| `src/utils/sortFriends.ts` | null lastCheckedIn sorts first (most overdue) |

### Friend Data Model
```typescript
interface FriendNote { id, content, createdAt: number, pinned?: boolean }
interface Friend { id, name, lastCheckedIn: number|null, createdAt, notes: FriendNote[], checkIns: number[] }
```
- `checkIns[]` — timestamps from plain right-swipe check-ins only
- `notes[]` — notes created via left-swipe or converted from check-ins
- Adding a note removes any same-day check-in entry (note supersedes it)
- Deleting a note converts it back to a check-in entry (same timestamp)
- Check-ins are deduped per calendar day

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
`useFriends` takes `notif: { notificationFrequency, notificationHour, notificationMinute }` and reschedules whenever those or the friend list changes. Notification targets the friend with the oldest `lastCheckedIn`. All scheduler calls are wrapped in try/catch for Expo Go compatibility.

## App Config
- Package: `in.wumb0.friendslist`
- `edgeToEdgeEnabled: true` (Android)
- `newArchEnabled: true`
- Storage keys: `friends_v1` (friends), `app_settings_v1` (settings)
