import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { Friend, FriendNote, SignificantDate, OneTimeEvent } from '../types/Friend';
import { Group } from '../types/Group';
import { useTheme } from '../context/ThemeContext';
import { MONTHS, DateFormState, makeDatePickerDate, DateForm, DateCard } from './DateForm';
import { EventFormState, EventForm, EventCard } from './EventForm';

interface Props {
  friend: Friend | null;
  visible: boolean;
  onClose: () => void;
  onUpdateNote: (friendId: string, noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>) => void;
  onDeleteNote: (friendId: string, noteId: string) => void;
  onConvertCheckIn: (friendId: string, checkInTs: number, content: string) => void;
  onUpdateCheckInDate: (friendId: string, oldTs: number, newTs: number) => void;
  onUpdateNoteDate: (friendId: string, noteId: string, newCreatedAt: number) => void;
  groups: Group[];
  onMoveGroup: (friendId: string, groupId: string) => void;
  onAddSignificantDate: (friendId: string, data: Omit<SignificantDate, 'id'>) => void;
  onUpdateSignificantDate: (friendId: string, dateId: string, updates: Partial<Omit<SignificantDate, 'id'>>) => void;
  onDeleteSignificantDate: (friendId: string, dateId: string) => void;
  onAddOneTimeEvent: (friendId: string, data: Omit<OneTimeEvent, 'id'>) => void;
  onUpdateOneTimeEvent: (friendId: string, eventId: string, updates: Partial<Omit<OneTimeEvent, 'id'>>) => void;
  onDeleteOneTimeEvent: (friendId: string, eventId: string) => void;
}

type Tab = 'history' | 'dates';

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function DateTimeEditor({ initial, onSave, onCancel, theme }: {
  initial: Date;
  onSave: (date: Date) => void;
  onCancel: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [pending, setPending] = useState(new Date(initial));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPending(prev => {
      const next = new Date(prev);
      next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      return next;
    });
  };

  const handleTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) setPending(prev => {
      const next = new Date(prev);
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      return next;
    });
  };

  return (
    <View style={dtStyles.container}>
      <View style={dtStyles.row}>
        <TouchableOpacity
          style={[dtStyles.pill, { backgroundColor: theme.input, borderColor: theme.border }]}
          onPress={() => { setShowDatePicker(v => !v); setShowTimePicker(false); }}
        >
          <Text style={[dtStyles.pillText, { color: theme.textPrimary }]}>{formatDate(pending.getTime())}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[dtStyles.pill, { backgroundColor: theme.input, borderColor: theme.border }]}
          onPress={() => { setShowTimePicker(v => !v); setShowDatePicker(false); }}
        >
          <Text style={[dtStyles.pillText, { color: theme.textPrimary }]}>{formatTime(pending.getTime())}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={pending}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={pending}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}

      <View style={dtStyles.buttons}>
        <TouchableOpacity onPress={onCancel} style={[dtStyles.btn, { borderColor: theme.border }]}>
          <Text style={[dtStyles.btnCancelText, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSave(pending)} style={[dtStyles.btn, { backgroundColor: theme.accent }]}>
          <Text style={dtStyles.btnSaveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const dtStyles = StyleSheet.create({
  container: { marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pill: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  pillText: { fontSize: 13, fontWeight: '500' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  btnCancelText: { fontSize: 14, fontWeight: '500' },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({ item, friendId, onUpdate, onDelete, onChangeDate, theme }: {
  item: Extract<TimelineItem, { kind: 'note' }>;
  friendId: string;
  onUpdate: (noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>) => void;
  onDelete: (friendId: string, noteId: string) => void;
  onChangeDate: (noteId: string, newCreatedAt: number) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const { note } = item;
  const [editing, setEditing] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
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
        <TouchableOpacity onPress={() => setEditingDate(true)}>
          <Text style={[styles.noteDate, { color: theme.textSecondary }]}>{formatDate(note.createdAt)}</Text>
        </TouchableOpacity>
        <View style={styles.noteActions}>
          <TouchableOpacity onPress={() => onUpdate(note.id, { pinned: !note.pinned })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={note.pinned ? 'bookmark' : 'bookmark-outline'} size={18} color={note.pinned ? theme.accent : theme.textSecondary} />
          </TouchableOpacity>
          {!editing && !editingDate && (
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 12 }}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {editingDate ? (
        <DateTimeEditor
          initial={new Date(note.createdAt)}
          onSave={date => { onChangeDate(note.id, date.getTime()); setEditingDate(false); }}
          onCancel={() => setEditingDate(false)}
          theme={theme}
        />
      ) : editing ? (
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

function CheckInRow({ ts, theme, onConvertToNote, onChangeDate }: {
  ts: number;
  theme: ReturnType<typeof useTheme>['theme'];
  onConvertToNote: (ts: number, content: string) => void;
  onChangeDate: (oldTs: number, newTs: number) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'editingNote' | 'editingDate'>('idle');
  const [draft, setDraft] = useState('');

  const handleLongPress = () => {
    const title = `Checked in · ${formatDate(ts)} · ${formatTime(ts)}`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: ['Cancel', 'Change Date', 'Convert to Note'], cancelButtonIndex: 0 },
        i => { if (i === 1) setMode('editingDate'); else if (i === 2) setMode('editingNote'); },
      );
    } else {
      Alert.alert(title, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change Date', onPress: () => setMode('editingDate') },
        { text: 'Convert to Note', onPress: () => setMode('editingNote') },
      ]);
    }
  };

  if (mode === 'editingDate') {
    return (
      <View style={[styles.checkInCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.checkInCardDate, { color: theme.textSecondary }]}>{formatDate(ts)} · {formatTime(ts)}</Text>
        <DateTimeEditor
          initial={new Date(ts)}
          onSave={date => { onChangeDate(ts, date.getTime()); setMode('idle'); }}
          onCancel={() => setMode('idle')}
          theme={theme}
        />
      </View>
    );
  }

  if (mode === 'editingNote') {
    const handleSave = () => {
      if (draft.trim()) onConvertToNote(ts, draft.trim());
      setDraft('');
      setMode('idle');
    };
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
          <TouchableOpacity onPress={() => { setDraft(''); setMode('idle'); }} style={[styles.editBtn, { borderColor: theme.border }]}>
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
    <TouchableWithoutFeedback onLongPress={handleLongPress} delayLongPress={400}>
      <View style={styles.checkInRow}>
        <View style={[styles.checkInDot, { backgroundColor: theme.green }]} />
        <Text style={[styles.checkInText, { color: theme.textSecondary }]}>
          Checked in · {formatDate(ts)}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function NotesModal({
  friend, visible, onClose, onUpdateNote, onDeleteNote, onConvertCheckIn,
  onUpdateCheckInDate, onUpdateNoteDate,
  groups, onMoveGroup, onAddSignificantDate, onUpdateSignificantDate, onDeleteSignificantDate,
  onAddOneTimeEvent, onUpdateOneTimeEvent, onDeleteOneTimeEvent,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [editingDate, setEditingDate] = useState<DateFormState | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventFormState | null>(null);
  const [importingBirthday, setImportingBirthday] = useState(false);

  if (!friend) return null;

  const timeline = buildTimeline(friend);
  const currentGroup = groups.find(g => g.id === friend.groupId);
  const significantDates = friend.significantDates;
  const oneTimeEvents = friend.oneTimeEvents;
  const defaultNotifyHour = currentGroup?.schedules[0]?.hour ?? 9;
  const defaultNotifyMinute = currentGroup?.schedules[0]?.minute ?? 0;

  const handleOpenNewDate = () => {
    setEditingDate({
      id: null,
      label: 'Birthday',
      pickerDate: new Date(2000, 0, 1),
      includeYear: false,
      notifyEnabled: true,
      notifyHour: defaultNotifyHour,
      notifyMinute: defaultNotifyMinute,
    });
  };

  const handleOpenEditDate = (date: SignificantDate) => {
    setEditingDate({
      id: date.id,
      label: date.label,
      pickerDate: makeDatePickerDate(date.month, date.day, date.year),
      includeYear: !!date.year,
      notifyEnabled: date.notifyEnabled,
      notifyHour: date.notifyHour,
      notifyMinute: date.notifyMinute,
    });
  };

  const handleSaveDate = (state: DateFormState) => {
    const data: Omit<SignificantDate, 'id'> = {
      label: state.label,
      month: state.pickerDate.getMonth() + 1,
      day: state.pickerDate.getDate(),
      year: state.includeYear ? state.pickerDate.getFullYear() : undefined,
      notifyEnabled: state.notifyEnabled,
      notifyHour: state.notifyHour,
      notifyMinute: state.notifyMinute,
    };
    if (state.id) {
      onUpdateSignificantDate(friend.id, state.id, data);
    } else {
      onAddSignificantDate(friend.id, data);
    }
    setEditingDate(null);
  };

  const handleDeleteDate = (dateId: string) => {
    Alert.alert('Delete Date', 'Remove this significant date?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteSignificantDate(friend.id, dateId) },
    ]);
  };

  const handleImportBirthday = async () => {
    setImportingBirthday(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Contacts access is needed to import birthdays.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.Birthday],
        name: friend.name,
      });
      const match = data.find(c => c.birthday);
      if (!match || !match.birthday) {
        Alert.alert('Not Found', `No birthday found in contacts for "${friend.name}".`);
        return;
      }
      // expo-contacts Date: month is 0-based (like JS Date), year may be absent or fake
      const bday = match.birthday as Contacts.Date;
      const month = bday.month + 1;
      const day = bday.day;
      const year = bday.year && bday.year > 1900 ? bday.year : undefined;
      const dateStr = year
        ? `${MONTHS[month - 1]} ${day}, ${year}`
        : `${MONTHS[month - 1]} ${day}`;
      Alert.alert(
        'Import Birthday',
        `Add ${friend.name}'s birthday: ${dateStr}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: () => {
              onAddSignificantDate(friend.id, {
                label: 'Birthday',
                month,
                day,
                year,
                notifyEnabled: true,
                notifyHour: defaultNotifyHour,
                notifyMinute: defaultNotifyMinute,
              });
            },
          },
        ],
      );
    } finally {
      setImportingBirthday(false);
    }
  };

  const handleOpenNewEvent = () => {
    setEditingEvent({
      id: null,
      label: '',
      pickerDate: new Date(),
      notifyEnabled: true,
      notifyDaysBefore: 0,
      notifyHour: defaultNotifyHour,
      notifyMinute: defaultNotifyMinute,
    });
  };

  const handleOpenEditEvent = (event: OneTimeEvent) => {
    setEditingEvent({
      id: event.id,
      label: event.label,
      pickerDate: new Date(event.eventDate),
      notifyEnabled: event.notifyEnabled,
      notifyDaysBefore: event.notifyDaysBefore,
      notifyHour: event.notifyHour,
      notifyMinute: event.notifyMinute,
    });
  };

  const handleSaveEvent = (state: EventFormState) => {
    const d = new Date(state.pickerDate);
    d.setHours(0, 0, 0, 0);
    const data: Omit<OneTimeEvent, 'id'> = {
      label: state.label,
      eventDate: d.getTime(),
      notifyDaysBefore: state.notifyDaysBefore,
      notifyEnabled: state.notifyEnabled,
      notifyHour: state.notifyHour,
      notifyMinute: state.notifyMinute,
    };
    if (state.id) {
      onUpdateOneTimeEvent(friend.id, state.id, data);
    } else {
      onAddOneTimeEvent(friend.id, data);
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    Alert.alert('Delete Event', 'Remove this one-time event?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDeleteOneTimeEvent(friend.id, eventId) },
    ]);
  };

  const handleClose = () => {
    setEditingDate(null);
    setEditingEvent(null);
    setActiveTab('history');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => editingEvent ? setEditingEvent(null) : editingDate ? setEditingDate(null) : handleClose()}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {editingEvent
              ? (editingEvent.id ? 'Edit Event' : 'Add Event')
              : editingDate
              ? (editingDate.id ? 'Edit Date' : 'Add Date')
              : friend.name}
          </Text>
          {editingDate || editingEvent ? (
            <View style={{ width: 60 }} />
          ) : (
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.doneButton, { color: theme.accent }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Group row (only on main view) */}
        {!editingDate && !editingEvent && currentGroup && (
          <TouchableOpacity
            style={[styles.groupRow, { borderBottomColor: theme.border }]}
            onPress={() => { if (groups.length > 1) setGroupPickerVisible(true); }}
            disabled={groups.length <= 1}
          >
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Group</Text>
            <View style={styles.groupRight}>
              <Text style={[styles.groupName, { color: theme.textPrimary }]}>{currentGroup.name}</Text>
              {groups.length > 1 && <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 4 }} />}
            </View>
          </TouchableOpacity>
        )}

        {/* Tab switcher (only on main view) */}
        {!editingDate && !editingEvent && (
          <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
            {(['history', 'dates'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, activeTab === t && { borderBottomColor: theme.accent }]}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[styles.tabText, { color: activeTab === t ? theme.accent : theme.textSecondary }]}>
                  {t === 'history' ? 'History' : 'Dates'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Event form */}
        {editingEvent ? (
          <EventForm
            initial={editingEvent}
            onSave={handleSaveEvent}
            onCancel={() => setEditingEvent(null)}
            theme={theme}
          />
        ) : editingDate ? (
          <DateForm
            initial={editingDate}
            onSave={handleSaveDate}
            onCancel={() => setEditingDate(null)}
            theme={theme}
          />
        ) : activeTab === 'history' ? (
          /* History tab */
          timeline.length === 0 ? (
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
                    onChangeDate={(noteId, newTs) => onUpdateNoteDate(friend.id, noteId, newTs)}
                    theme={theme}
                  />
                ) : (
                  <CheckInRow
                    ts={item.ts}
                    theme={theme}
                    onConvertToNote={(ts, content) => onConvertCheckIn(friend.id, ts, content)}
                    onChangeDate={(oldTs, newTs) => onUpdateCheckInDate(friend.id, oldTs, newTs)}
                  />
                )
              }
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )
        ) : (
          /* Dates tab */
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Recurring Dates section */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Recurring Dates</Text>
            {significantDates.length === 0 && (
              <Text style={[styles.sectionEmpty, { color: theme.textSecondary }]}>No recurring dates yet</Text>
            )}
            {significantDates.map(date => (
              <DateCard
                key={date.id}
                date={date}
                onEdit={() => handleOpenEditDate(date)}
                onDelete={() => handleDeleteDate(date.id)}
                theme={theme}
              />
            ))}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.accent }]}
              onPress={handleOpenNewDate}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Add Date</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, marginTop: 10 }]}
              onPress={handleImportBirthday}
              disabled={importingBirthday}
            >
              {importingBirthday ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <>
                  <Ionicons name="person-circle-outline" size={18} color={theme.accent} />
                  <Text style={[styles.actionButtonText, { color: theme.accent }]}>Import Birthday from Contacts</Text>
                </>
              )}
            </TouchableOpacity>

            {/* One-Time Events section */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 24 }]}>One-Time Events</Text>
            {oneTimeEvents.length === 0 && (
              <Text style={[styles.sectionEmpty, { color: theme.textSecondary }]}>No upcoming events</Text>
            )}
            {oneTimeEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={() => handleOpenEditEvent(event)}
                onDelete={() => handleDeleteEvent(event.id)}
                theme={theme}
              />
            ))}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.accent, marginTop: oneTimeEvents.length > 0 ? 0 : 4 }]}
              onPress={handleOpenNewEvent}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Add Event</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Group picker */}
        <Modal visible={groupPickerVisible} transparent animationType="fade" onRequestClose={() => setGroupPickerVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setGroupPickerVisible(false)}>
            <View style={styles.pickerOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.pickerCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.pickerTitle, { color: theme.textSecondary }]}>Move to Group</Text>
                  {groups.map((g, i) => (
                    <View key={g.id}>
                      {i > 0 && <View style={[styles.pickerSep, { backgroundColor: theme.border }]} />}
                      <TouchableOpacity
                        style={styles.pickerRow}
                        onPress={() => {
                          if (g.id !== friend.groupId) onMoveGroup(friend.id, g.id);
                          setGroupPickerVisible(false);
                        }}
                      >
                        <Text style={[styles.pickerRowText, { color: g.id === friend.groupId ? theme.accent : theme.textPrimary }]}>
                          {g.name}
                        </Text>
                        {g.id === friend.groupId && <Ionicons name="checkmark" size={18} color={theme.accent} />}
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={[styles.pickerSep, { backgroundColor: theme.border }]} />
                  <TouchableOpacity style={styles.pickerRow} onPress={() => setGroupPickerVisible(false)}>
                    <Text style={[styles.pickerCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupLabel: { fontSize: 14 },
  groupRight: { flexDirection: 'row', alignItems: 'center' },
  groupName: { fontSize: 14, fontWeight: '500' },
  list: { padding: 16, gap: 10 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionEmpty: { fontSize: 14, marginBottom: 8, paddingHorizontal: 2 },
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pickerCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pickerRowText: { fontSize: 16 },
  pickerCancelText: { fontSize: 16, fontWeight: '500', width: '100%', textAlign: 'center' },
  pickerSep: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },
});
