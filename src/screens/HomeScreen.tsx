import React, { useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
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
import { Group } from '../types/Group';
import { requestNotificationPermissions } from '../notifications/scheduler';
import { useTheme } from '../context/ThemeContext';
import { useEffect } from 'react';

type FriendSection = { group: Group; data: Friend[] };

export function HomeScreen() {
  const { theme } = useTheme();
  const { friends, loading, addFriends, checkIn, addNote, updateNote, deleteNote, deleteFriend, convertCheckInToNote, moveToGroup, moveGroupMembers } = useFriends();
  const { groups, loading: groupsLoading, addGroup, updateGroup, deleteGroup } = useGroups(friends);

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [quickNoteFriend, setQuickNoteFriend] = useState<Friend | null>(null);
  const [quickNoteExisting, setQuickNoteExisting] = useState<{ id: string; content: string } | null>(null);

  const selectedFriend = selectedFriendId ? (friends.find(f => f.id === selectedFriendId) ?? null) : null;

  useEffect(() => { requestNotificationPermissions(); }, []);

  const existingNames = new Set(friends.map(f => f.name.toLowerCase()));

  const sections: FriendSection[] = groups
    .map(group => ({ group, data: friends.filter(f => f.groupId === group.id) }))
    .filter(s => s.data.length > 0);

  const defaultGroupId = groups[0]?.id ?? '';

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

  const isEmpty = !loading && friends.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Friends</Text>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {isEmpty ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No friends yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap + to add someone you want to stay in touch with.
            </Text>
          </View>
        ) : (
          <SectionList<Friend, FriendSection>
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <FriendCard
                friend={item}
                onCheckIn={handleCheckIn}
                onPress={(f) => setSelectedFriendId(f.id)}
                onDelete={deleteFriend}
                onAddNote={handleAddNote}
              />
            )}
            renderSectionHeader={({ section }) =>
              groups.length > 1 ? (
                <Text style={[styles.sectionHeader, { color: theme.textSecondary, backgroundColor: theme.background }]}>
                  {section.group.name}
                </Text>
              ) : null
            }
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
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
        onAdd={addFriends}
        existingNames={existingNames}
        groups={groups}
        defaultGroupId={defaultGroupId}
      />

      <NotesModal
        friend={selectedFriend}
        visible={selectedFriendId !== null}
        onClose={() => setSelectedFriendId(null)}
        onUpdateNote={updateNote}
        onDeleteNote={deleteNote}
        onConvertCheckIn={convertCheckInToNote}
        groups={groups}
        onMoveGroup={moveToGroup}
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
        onOpenGroups={() => { setShowSettings(false); setShowGroups(true); }}
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 8,
  },
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
});
