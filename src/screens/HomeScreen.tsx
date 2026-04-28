import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
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
import { requestNotificationPermissions } from '../notifications/scheduler';
import { useTheme } from '../context/ThemeContext';

export function HomeScreen() {
  const { theme } = useTheme();
  const { friends, loading, addFriends, checkIn, addNote, updateNote, deleteNote, deleteFriend, convertCheckInToNote, moveToGroup, moveGroupMembers } = useFriends();
  const { groups, loading: groupsLoading, addGroup, updateGroup, deleteGroup } = useGroups(friends);

  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [quickNoteFriend, setQuickNoteFriend] = useState<Friend | null>(null);
  const [quickNoteExisting, setQuickNoteExisting] = useState<{ id: string; content: string } | null>(null);

  // Keep activeGroupId pointing at a valid group
  useEffect(() => {
    if (groups.length === 0) return;
    if (!groups.find(g => g.id === activeGroupId)) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, activeGroupId]);

  const selectedFriend = selectedFriendId ? (friends.find(f => f.id === selectedFriendId) ?? null) : null;

  useEffect(() => { requestNotificationPermissions(); }, []);

  const existingNames = new Set(friends.map(f => f.name.toLowerCase()));

  const visibleFriends = friends.filter(f => f.groupId === activeGroupId);
  const isEmpty = !loading && !groupsLoading && visibleFriends.length === 0;

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
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {groups.length > 1 && (
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
              data={visibleFriends}
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
            contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
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
        defaultGroupId={activeGroupId}
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
        onOpenGroups={() => { setShowGroups(true); }}
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
});
