import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFriends } from '../hooks/useFriends';
import { FriendCard } from '../components/FriendCard';
import { AddFriendModal } from '../components/AddFriendModal';
import { NotesModal } from '../components/NotesModal';
import { QuickNoteModal } from '../components/QuickNoteModal';
import { SettingsModal } from '../components/SettingsModal';
import { Toast } from '../components/Toast';
import { Friend } from '../types/Friend';
import { requestNotificationPermissions } from '../notifications/scheduler';
import { useTheme } from '../context/ThemeContext';

export function HomeScreen() {
  const { theme, settings } = useTheme();
  const { friends, loading, addFriends, checkIn, addNote, updateNote, deleteNote, deleteFriend, convertCheckInToNote } = useFriends({
    notificationFrequency: settings.notificationFrequency,
    notificationHour: settings.notificationHour,
    notificationMinute: settings.notificationMinute,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (name: string) => setToastMessage(`Checked in with ${name}`);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [quickNoteFriend, setQuickNoteFriend] = useState<Friend | null>(null);
  const [quickNoteExisting, setQuickNoteExisting] = useState<{ id: string; content: string } | null>(null);

  // Always pass the live friend object so note edits/pins reflect immediately
  const selectedFriend = selectedFriendId ? (friends.find(f => f.id === selectedFriendId) ?? null) : null;

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  const existingNames = new Set(friends.map(f => f.name.toLowerCase()));

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

        {!loading && friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No friends yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Tap + to add someone you want to stay in touch with.
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
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
      />

      <NotesModal
        friend={selectedFriend}
        visible={selectedFriendId !== null}
        onClose={() => setSelectedFriendId(null)}
        onUpdateNote={updateNote}
        onDeleteNote={deleteNote}
        onConvertCheckIn={convertCheckInToNote}
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
