import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Friend, FriendNote } from '../types/Friend';
import { useTheme } from '../context/ThemeContext';

interface Props {
  friend: Friend | null;
  visible: boolean;
  onClose: () => void;
  onUpdateNote: (friendId: string, noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>) => void;
  onDeleteNote: (friendId: string, noteId: string) => void;
  onConvertCheckIn: (friendId: string, checkInTs: number, content: string) => void;
}

type TimelineItem =
  | { kind: 'note'; note: FriendNote; ts: number }
  | { kind: 'checkIn'; ts: number };

function buildTimeline(friend: Friend): TimelineItem[] {
  const pinned: TimelineItem[] = friend.notes
    .filter(n => n.pinned)
    .map(n => ({ kind: 'note', note: n, ts: n.createdAt }));

  const unpinned: TimelineItem[] = [
    ...friend.notes.filter(n => !n.pinned).map(n => ({ kind: 'note' as const, note: n, ts: n.createdAt })),
    ...friend.checkIns.map(ts => ({ kind: 'checkIn' as const, ts })),
  ].sort((a, b) => b.ts - a.ts);

  return [...pinned.sort((a, b) => b.ts - a.ts), ...unpinned];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function NoteCard({ item, friendId, onUpdate, onDelete, theme }: {
  item: Extract<TimelineItem, { kind: 'note' }>;
  friendId: string;
  onUpdate: (noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>) => void;
  onDelete: (friendId: string, noteId: string) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const { note } = item;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.content) onUpdate(note.id, { content: trimmed });
    setEditing(false);
  };

  const handleCancelEdit = () => { setDraft(note.content); setEditing(false); };

  const handleDelete = () => {
    Alert.alert('Remove Note', 'Convert this note back to a check-in?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', style: 'destructive', onPress: () => onDelete(friendId, note.id) },
    ]);
  };

  return (
    <View style={[
      styles.noteCard,
      { backgroundColor: theme.card, borderColor: note.pinned ? theme.accent : theme.border },
    ]}>
      <View style={styles.noteHeader}>
        <Text style={[styles.noteDate, { color: theme.textSecondary }]}>{formatDate(note.createdAt)}</Text>
        <View style={styles.noteActions}>
          <TouchableOpacity onPress={() => onUpdate(note.id, { pinned: !note.pinned })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={note.pinned ? 'bookmark' : 'bookmark-outline'} size={18} color={note.pinned ? theme.accent : theme.textSecondary} />
          </TouchableOpacity>
          {!editing && (
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 12 }}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {editing ? (
        <>
          <TextInput
            style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.input }]}
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={styles.editButtons}>
            <TouchableOpacity onPress={handleCancelEdit} style={[styles.editBtn, { borderColor: theme.border }]}>
              <Text style={[styles.editBtnCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.editBtn, { backgroundColor: theme.accent }]}>
              <Text style={styles.editBtnSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity onPress={() => { setDraft(note.content); setEditing(true); }} activeOpacity={0.7}>
          <Text style={[styles.noteContent, { color: theme.textPrimary }]}>{note.content}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CheckInRow({ ts, theme, onConvertToNote }: {
  ts: number;
  theme: ReturnType<typeof useTheme>['theme'];
  onConvertToNote: (ts: number, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleSave = () => {
    if (draft.trim()) onConvertToNote(ts, draft.trim());
    setDraft('');
    setEditing(false);
  };

  const handleCancel = () => { setDraft(''); setEditing(false); };

  if (editing) {
    return (
      <View style={[styles.checkInCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.checkInCardDate, { color: theme.textSecondary }]}>{formatDate(ts)}</Text>
        <TextInput
          style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.input }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="What happened?"
          placeholderTextColor={theme.placeholder}
          multiline
          autoFocus
          textAlignVertical="top"
        />
        <View style={styles.editButtons}>
          <TouchableOpacity onPress={handleCancel} style={[styles.editBtn, { borderColor: theme.border }]}>
            <Text style={[styles.editBtnCancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={[styles.editBtn, { backgroundColor: theme.accent }]}>
            <Text style={styles.editBtnSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onLongPress={() => setEditing(true)} delayLongPress={400}>
      <View style={styles.checkInRow}>
        <View style={[styles.checkInDot, { backgroundColor: theme.green }]} />
        <Text style={[styles.checkInText, { color: theme.textSecondary }]}>
          Checked in · {formatDate(ts)}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

export function NotesModal({ friend, visible, onClose, onUpdateNote, onDeleteNote, onConvertCheckIn }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;

  if (!friend) return null;

  const timeline = buildTimeline(friend);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>{friend.name}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.doneButton, { color: theme.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {timeline.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No history yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Check ins and notes will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={timeline}
            keyExtractor={item => item.kind === 'note' ? `note-${item.note.id}` : `checkin-${item.ts}`}
            renderItem={({ item }) =>
              item.kind === 'note' ? (
                <NoteCard
                  item={item}
                  friendId={friend.id}
                  onUpdate={(noteId, updates) => onUpdateNote(friend.id, noteId, updates)}
                  onDelete={onDeleteNote}
                  theme={theme}
                />
              ) : (
                <CheckInRow ts={item.ts} theme={theme} onConvertToNote={(ts, content) => onConvertCheckIn(friend.id, ts, content)} />
              )
            }
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  title: { fontSize: 17, fontWeight: '600' },
  doneButton: { fontSize: 17, fontWeight: '600', width: 60, textAlign: 'right' },
  list: { padding: 16, gap: 10 },
  noteCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noteDate: { fontSize: 13, fontWeight: '500' },
  noteActions: { flexDirection: 'row', alignItems: 'center' },
  noteContent: { fontSize: 15, lineHeight: 22 },
  editInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    marginBottom: 10,
  },
  editButtons: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  editBtnCancelText: { fontSize: 14, fontWeight: '500' },
  editBtnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 8,
  },
  checkInDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  checkInText: {
    fontSize: 13,
  },
  checkInCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  checkInCardDate: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginBottom: 60,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
