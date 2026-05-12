import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, TouchableWithoutFeedback, TextInput, Modal, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFriends } from '../hooks/useFriends';
import { useGroups } from '../hooks/useGroups';
import { FriendCard } from '../components/FriendCard';
import { AddFriendModal } from '../components/AddFriendModal';
import { NotesModal } from '../components/NotesModal';
import { QuickNoteModal } from '../components/QuickNoteModal';
import { SettingsModal } from '../components/SettingsModal';
import { GroupsModal } from '../components/GroupsModal';
import { Toast } from '../components/Toast';
import { Friend } from '../types/Friend';
import { requestNotificationPermissions, addNotificationTapListener, getInitialNotificationTarget } from '../notifications/scheduler';
import { useTheme } from '../context/ThemeContext';

function getNoteSnippet(friend: Friend, query: string): string | undefined {
  const q = query.toLowerCase();
  if (friend.name.toLowerCase().includes(q)) return undefined; // name match — no snippet needed
  const match = friend.notes.find(n => n.content.toLowerCase().includes(q));
  if (!match) return undefined;
  const idx = match.content.toLowerCase().indexOf(q);
  const start = Math.max(0, idx - 30);
  const end = Math.min(match.content.length, idx + q.length + 30);
  return (start > 0 ? '…' : '') + match.content.slice(start, end) + (end < match.content.length ? '…' : '');
}

export function HomeScreen() {
  const { theme } = useTheme();
  const { friends, loading, addFriends, checkIn, updateCheckInDate, addNote, updateNote, updateNoteDate, deleteNote, deleteFriend, convertCheckInToNote, moveToGroup, moveGroupMembers, renameFriend, addSignificantDate, updateSignificantDate, deleteSignificantDate, addOneTimeEvent, updateOneTimeEvent, deleteOneTimeEvent } = useFriends();
  const { groups, loading: groupsLoading, addGroup, updateGroup, deleteGroup } = useGroups(friends);

  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotes, setSearchNotes] = useState(false);
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [quickNoteFriend, setQuickNoteFriend] = useState<Friend | null>(null);
  const [quickNoteExisting, setQuickNoteExisting] = useState<{ id: string; content: string } | null>(null);
  const [editFriend, setEditFriend] = useState<Friend | null>(null);
  const [editName, setEditName] = useState('');

  // Keep activeGroupId pointing at a valid group
  useEffect(() => {
    if (groups.length === 0) return;
    if (!groups.find(g => g.id === activeGroupId)) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  const selectedFriend = selectedFriendId ? (friends.find(f => f.id === selectedFriendId) ?? null) : null;
  const existingNames = new Set(friends.map(f => f.name.toLowerCase()));
  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching
    ? friends.filter(f => {
        const q = searchQuery.toLowerCase();
        if (f.name.toLowerCase().includes(q)) return true;
        if (searchNotes) return f.notes.some(n => n.content.toLowerCase().includes(q));
        return false;
      })
    : [];
  const visibleFriends = isSearching ? searchResults : friends.filter(f => f.groupId === activeGroupId);
  const isEmpty = !loading && !groupsLoading && visibleFriends.length === 0;

  useEffect(() => { requestNotificationPermissions(); }, []);

  // Handle notification taps while app is running
  useEffect(() => {
    const sub = addNotificationTapListener(({ friendId, groupId }) => {
      setActiveGroupId(groupId);
      if (friendId) setPendingFriendId(friendId);
    });
    return () => sub.remove();
  }, []);

  // Handle cold-start launch from a notification tap
  useEffect(() => {
    getInitialNotificationTarget().then(target => {
      if (target) {
        setActiveGroupId(target.groupId);
        if (target.friendId) setPendingFriendId(target.friendId);
      }
    });
  }, []);

  // Scroll to pending friend once the list has rendered with the right group
  useEffect(() => {
    if (!pendingFriendId) return;
    const idx = visibleFriends.findIndex(f => f.id === pendingFriendId);
    if (idx < 0) return;
    listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    setPendingFriendId(null);
  }, [pendingFriendId, visibleFriends]);

  const showToast = (name: string) => setToastMessage(`Checked in with ${name}`);

  const handleCheckIn = (id: string) => {
    const name = friends.find(f => f.id === id)?.name;
    if (name) showToast(name);
    checkIn(id);
  };

  const handleAddNote = (friend: Friend) => {
    const today = Date.now();
    const d = new Date(today);
    const existing = friend.notes.find(n => {
      const nd = new Date(n.createdAt);
      return nd.getFullYear() === d.getFullYear() && nd.getMonth() === d.getMonth() && nd.getDate() === d.getDate();
    });
    setQuickNoteExisting(existing ? { id: existing.id, content: existing.content } : null);
    setQuickNoteFriend(friend);
  };

  const handleQuickNoteSubmit = (content: string | null) => {
    if (!quickNoteFriend) return;
    showToast(quickNoteFriend.name);
    if (content) {
      if (quickNoteExisting) {
        updateNote(quickNoteFriend.id, quickNoteExisting.id, { content });
      } else {
        addNote(quickNoteFriend.id, content);
      }
    } else {
      checkIn(quickNoteFriend.id);
    }
    setQuickNoteFriend(null);
    setQuickNoteExisting(null);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Friends</Text>
          <View style={styles.headingButtons}>
            <TouchableOpacity
              onPress={() => setShowSearch(v => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={showSearch ? 'search' : 'search-outline'} size={24} color={showSearch ? theme.accent : theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <>
            <View style={styles.searchRowOuter}>
              <View style={[styles.searchRow, { backgroundColor: theme.input }]}>
                <Ionicons name="search" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search friends…"
                  placeholderTextColor={theme.placeholder}
                  returnKeyType="search"
                  autoFocus
                  clearButtonMode="while-editing"
                />
              </View>
              <TouchableOpacity
                onPress={() => { setShowSearch(false); setSearchQuery(''); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.cancelText, { color: theme.accent }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.notesToggle, { borderColor: searchNotes ? theme.accent : theme.border, backgroundColor: searchNotes ? theme.accent : theme.card }]}
              onPress={() => setSearchNotes(v => !v)}
            >
              <Ionicons name={searchNotes ? 'checkbox' : 'square-outline'} size={14} color={searchNotes ? '#fff' : theme.textSecondary} />
              <Text style={[styles.notesToggleText, { color: searchNotes ? '#fff' : theme.textSecondary }]}>Include notes</Text>
            </TouchableOpacity>
          </>
        )}

        {!showSearch && groups.length > 1 && (
          <View style={styles.groupTabsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTabs}>
              {groups.map(g => {
                const active = g.id === activeGroupId;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.groupTab, { borderColor: theme.border, backgroundColor: active ? theme.accent : theme.card }]}
                    onPress={() => setActiveGroupId(g.id)}
                  >
                    <Text style={[styles.groupTabText, { color: active ? '#fff' : theme.textPrimary }]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>You have no friends!</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              (no offense)
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap + to add someone you want to stay in touch with.
            </Text>
          </View>
        ) : (
            <FlatList
              ref={listRef}
              data={visibleFriends}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <FriendCard
                  friend={item}
                  onCheckIn={handleCheckIn}
                  onPress={(f) => setSelectedFriendId(f.id)}
                  onDelete={deleteFriend}
                  onAddNote={handleAddNote}
                  groupName={isSearching ? (groups.find(g => g.id === item.groupId)?.name) : undefined}
                  noteSnippet={isSearching && searchNotes ? getNoteSnippet(item, searchQuery) : undefined}
                  onEdit={f => { setEditFriend(f); setEditName(f.name); }}
                />
              )}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={({ index }) =>
                listRef.current?.scrollToOffset({ offset: index * 80, animated: true })
              }
            />
        )}

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent, shadowColor: theme.accent }]}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
          disabled={groupsLoading || groups.length === 0}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>

        <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
      </View>

      <AddFriendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(imports, groupId) => addFriends(imports, groupId)}
        existingNames={existingNames}
        groups={groups}
        defaultGroupId={activeGroupId}
      />

      <NotesModal
        friend={selectedFriend}
        visible={selectedFriendId !== null}
        onClose={() => setSelectedFriendId(null)}
        onUpdateNote={updateNote}
        onDeleteNote={deleteNote}
        onConvertCheckIn={convertCheckInToNote}
        onUpdateCheckInDate={updateCheckInDate}
        onUpdateNoteDate={updateNoteDate}
        groups={groups}
        onMoveGroup={moveToGroup}
        onAddSignificantDate={addSignificantDate}
        onUpdateSignificantDate={updateSignificantDate}
        onDeleteSignificantDate={deleteSignificantDate}
        onAddOneTimeEvent={addOneTimeEvent}
        onUpdateOneTimeEvent={updateOneTimeEvent}
        onDeleteOneTimeEvent={deleteOneTimeEvent}
      />

      <QuickNoteModal
        friendName={quickNoteFriend?.name ?? null}
        visible={quickNoteFriend !== null}
        initialContent={quickNoteExisting?.content}
        onSubmit={handleQuickNoteSubmit}
        onDismiss={() => { setQuickNoteFriend(null); setQuickNoteExisting(null); }}
      />

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenGroups={() => { setShowSettings(false); setTimeout(() => setShowGroups(true), 400); }}
      />

      <GroupsModal
        visible={showGroups}
        onClose={() => setShowGroups(false)}
        groups={groups}
        friends={friends}
        onAddGroup={addGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={deleteGroup}
        onMoveGroupMembers={moveGroupMembers}
      />

      <Modal visible={editFriend !== null} transparent presentationStyle="overFullScreen" animationType="fade" onRequestClose={() => setEditFriend(null)}>
        <TouchableWithoutFeedback onPress={() => setEditFriend(null)}>
          <View style={styles.editOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.editCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.editTitle, { color: theme.textPrimary }]}>Edit Name</Text>
                <TextInput
                  style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.input }]}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  maxLength={50}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (editFriend && editName.trim()) {
                      renameFriend(editFriend.id, editName.trim());
                      setEditFriend(null);
                    }
                  }}
                />
                <View style={styles.editButtons}>
                  <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border }]} onPress={() => setEditFriend(null)}>
                    <Text style={[styles.editBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnPrimary, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      if (editFriend && editName.trim()) {
                        renameFriend(editFriend.id, editName.trim());
                        setEditFriend(null);
                      }
                    }}
                  >
                    <Text style={[styles.editBtnText, { color: '#fff' }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: { fontSize: 34, fontWeight: '700' },
  headingButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  searchRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  cancelText: { fontSize: 15, fontWeight: '500' },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
  },
  notesToggleText: { fontSize: 13, fontWeight: '500' },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  groupTabsRow: { height: 50, marginBottom: 4 },
  groupTabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  groupTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  groupTabText: { fontSize: 14, fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginBottom: 60,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '300', lineHeight: 34 },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCard: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  editTitle: { fontSize: 17, fontWeight: '600', marginBottom: 14 },
  editInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  editButtons: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  editBtnPrimary: { borderWidth: 0 },
  editBtnText: { fontSize: 15, fontWeight: '600' },
});
