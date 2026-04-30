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
  ActivityIndicator,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import { Friend, FriendNote, SignificantDate, OneTimeEvent } from '../types/Friend';
import { Group } from '../types/Group';
import { useTheme } from '../context/ThemeContext';

interface Props {
  friend: Friend | null;
  visible: boolean;
  onClose: () => void;
  onUpdateNote: (friendId: string, noteId: string, updates: Partial<Pick<FriendNote, 'content' | 'pinned'>>) => void;
  onDeleteNote: (friendId: string, noteId: string) => void;
  onConvertCheckIn: (friendId: string, checkInTs: number, content: string) => void;
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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatSignificantDate(date: SignificantDate): string {
  const month = MONTHS[date.month - 1];
  if (date.year) return `${month} ${date.day}, ${date.year}`;
  return `${month} ${date.day}`;
}

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

const PRESET_LABELS = ['Birthday', 'Anniversary'];

// ── Date form (add/edit) ──────────────────────────────────────────────────────

interface DateFormState {
  id: string | null;
  label: string;
  pickerDate: Date;
  includeYear: boolean;
  notifyEnabled: boolean;
  notifyHour: number;
  notifyMinute: number;
}

function makeDatePickerDate(month: number, day: number, year?: number): Date {
  return new Date(year ?? 2000, month - 1, day);
}

function DateForm({
  initial,
  onSave,
  onCancel,
  theme,
}: {
  initial: DateFormState;
  onSave: (state: DateFormState) => void;
  onCancel: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [label, setLabel] = useState(initial.label);
  const [labelFocused, setLabelFocused] = useState(false);
  const [pickerDate, setPickerDate] = useState(initial.pickerDate);
  const [includeYear, setIncludeYear] = useState(initial.includeYear);
  const [notifyEnabled, setNotifyEnabled] = useState(initial.notifyEnabled);
  const [notifyHour, setNotifyHour] = useState(initial.notifyHour);
  const [notifyMinute, setNotifyMinute] = useState(initial.notifyMinute);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const suggestions = PRESET_LABELS.filter(
    p => p.toLowerCase().startsWith(label.toLowerCase()) && p.toLowerCase() !== label.toLowerCase()
  );
  const showSuggestions = labelFocused && suggestions.length > 0;

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) { setNotifyHour(date.getHours()); setNotifyMinute(date.getMinutes()); }
  };

  const timePicker = new Date();
  timePicker.setHours(notifyHour, notifyMinute, 0, 0);

  const canSave = label.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={dateFormStyles.container} keyboardShouldPersistTaps="handled">
      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>LABEL</Text>
      <TextInput
        style={[dateFormStyles.labelInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.input }]}
        value={label}
        onChangeText={setLabel}
        onFocus={() => setLabelFocused(true)}
        onBlur={() => setLabelFocused(false)}
        placeholder="e.g. Birthday, Anniversary…"
        placeholderTextColor={theme.placeholder}
        maxLength={40}
      />
      {showSuggestions && (
        <View style={dateFormStyles.suggestionPills}>
          {suggestions.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => { setLabel(s); setLabelFocused(false); }}
              style={[dateFormStyles.suggestionPill, { backgroundColor: theme.badge, borderColor: theme.border }]}
            >
              <Text style={[dateFormStyles.suggestionPillText, { color: theme.textSecondary }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>DATE</Text>
      <TouchableOpacity
        style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setShowDatePicker(v => !v)}
      >
        <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Date</Text>
        <Text style={[dateFormStyles.rowValue, { color: theme.accent }]}>
          {pickerDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}) })}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          textColor={theme.textPrimary}
          themeVariant={theme.isDark ? 'dark' : 'light'}
        />
      )}

      <TouchableOpacity
        style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 }]}
        onPress={() => setIncludeYear(v => !v)}
      >
        <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Include year</Text>
        <Ionicons name={includeYear ? 'checkbox' : 'square-outline'} size={20} color={includeYear ? theme.accent : theme.textSecondary} />
      </TouchableOpacity>

      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>NOTIFICATION</Text>
      <TouchableOpacity
        style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setNotifyEnabled(v => !v)}
      >
        <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Notify me on this date</Text>
        <Ionicons name={notifyEnabled ? 'checkbox' : 'square-outline'} size={20} color={notifyEnabled ? theme.accent : theme.textSecondary} />
      </TouchableOpacity>
      {notifyEnabled && (
        <TouchableOpacity
          style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 }]}
          onPress={() => setShowTimePicker(v => !v)}
        >
          <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Notify at</Text>
          <Text style={[dateFormStyles.rowValue, { color: theme.accent }]}>{formatTime(notifyHour, notifyMinute)}</Text>
        </TouchableOpacity>
      )}
      {notifyEnabled && showTimePicker && (
        <DateTimePicker
          value={timePicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          textColor={theme.textPrimary}
          themeVariant={theme.isDark ? 'dark' : 'light'}
        />
      )}

      <View style={dateFormStyles.buttons}>
        <TouchableOpacity onPress={onCancel} style={[dateFormStyles.btn, { borderColor: theme.border }]}>
          <Text style={[dateFormStyles.btnCancelText, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!canSave) return;
            onSave({ id: initial.id, label: label.trim(), pickerDate, includeYear, notifyEnabled, notifyHour, notifyMinute });
          }}
          style={[dateFormStyles.btn, { backgroundColor: canSave ? theme.accent : theme.border }]}
          disabled={!canSave}
        >
          <Text style={dateFormStyles.btnSaveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const dateFormStyles = StyleSheet.create({
  container: { padding: 16, gap: 0 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  labelInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  suggestionPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  suggestionPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggestionPillText: { fontSize: 13, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '500' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, fontWeight: '500' },
  btnSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

// ── Date card ─────────────────────────────────────────────────────────────────

function DateCard({
  date,
  onEdit,
  onDelete,
  theme,
}: {
  date: SignificantDate;
  onEdit: () => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        i => { if (i === 0) onEdit(); else if (i === 1) onDelete(); },
      );
    } else {
      Alert.alert(date.label, undefined, [
        { text: 'Edit', onPress: onEdit },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <TouchableOpacity
      onPress={onEdit}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[dateCardStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      activeOpacity={0.7}
    >
      <View style={dateCardStyles.left}>
        <Text style={[dateCardStyles.label, { color: theme.textPrimary }]}>{date.label}</Text>
        <Text style={[dateCardStyles.dateText, { color: theme.textSecondary }]}>{formatSignificantDate(date)}</Text>
      </View>
      {date.notifyEnabled && (
        <Ionicons name="notifications" size={16} color={theme.accent} />
      )}
    </TouchableOpacity>
  );
}

const dateCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  left: { gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  dateText: { fontSize: 13 },
});

// ── Event form (add/edit one-time event) ──────────────────────────────────────

interface EventFormState {
  id: string | null;
  label: string;
  pickerDate: Date;
  notifyEnabled: boolean;
  notifyDaysBefore: number;
  notifyHour: number;
  notifyMinute: number;
}

const NOTIFY_OFFSETS: { label: string; value: number }[] = [
  { label: 'Same day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '2 days before', value: 2 },
  { label: '1 week before', value: 7 },
];

function EventForm({
  initial,
  onSave,
  onCancel,
  theme,
}: {
  initial: EventFormState;
  onSave: (state: EventFormState) => void;
  onCancel: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [label, setLabel] = useState(initial.label);
  const [pickerDate, setPickerDate] = useState(initial.pickerDate);
  const [notifyEnabled, setNotifyEnabled] = useState(initial.notifyEnabled);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(initial.notifyDaysBefore);
  const [notifyHour, setNotifyHour] = useState(initial.notifyHour);
  const [notifyMinute, setNotifyMinute] = useState(initial.notifyMinute);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setPickerDate(date);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) { setNotifyHour(date.getHours()); setNotifyMinute(date.getMinutes()); }
  };

  const timePicker = new Date();
  timePicker.setHours(notifyHour, notifyMinute, 0, 0);

  const canSave = label.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={dateFormStyles.container} keyboardShouldPersistTaps="handled">
      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>LABEL</Text>
      <TextInput
        style={[dateFormStyles.labelInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.input }]}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Surgery, Graduation…"
        placeholderTextColor={theme.placeholder}
        maxLength={40}
      />

      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>DATE</Text>
      <TouchableOpacity
        style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setShowDatePicker(v => !v)}
      >
        <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Date</Text>
        <Text style={[dateFormStyles.rowValue, { color: theme.accent }]}>
          {pickerDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          textColor={theme.textPrimary}
          themeVariant={theme.isDark ? 'dark' : 'light'}
        />
      )}

      <Text style={[dateFormStyles.sectionLabel, { color: theme.textSecondary }]}>NOTIFICATION</Text>
      <TouchableOpacity
        style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => setNotifyEnabled(v => !v)}
      >
        <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Notify me</Text>
        <Ionicons name={notifyEnabled ? 'checkbox' : 'square-outline'} size={20} color={notifyEnabled ? theme.accent : theme.textSecondary} />
      </TouchableOpacity>
      {notifyEnabled && (
        <>
          <View style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8, flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', paddingVertical: 10 }]}>
            {NOTIFY_OFFSETS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setNotifyDaysBefore(opt.value)}
                style={[eventFormStyles.offsetChip, {
                  backgroundColor: notifyDaysBefore === opt.value ? theme.accent : theme.badge,
                  borderColor: notifyDaysBefore === opt.value ? theme.accent : theme.border,
                }]}
              >
                <Text style={[eventFormStyles.offsetChipText, { color: notifyDaysBefore === opt.value ? '#fff' : theme.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[dateFormStyles.row, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 }]}
            onPress={() => setShowTimePicker(v => !v)}
          >
            <Text style={[dateFormStyles.rowLabel, { color: theme.textPrimary }]}>Notify at</Text>
            <Text style={[dateFormStyles.rowValue, { color: theme.accent }]}>{formatTime(notifyHour, notifyMinute)}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={timePicker}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
              textColor={theme.textPrimary}
              themeVariant={theme.isDark ? 'dark' : 'light'}
            />
          )}
        </>
      )}

      <View style={dateFormStyles.buttons}>
        <TouchableOpacity onPress={onCancel} style={[dateFormStyles.btn, { borderColor: theme.border }]}>
          <Text style={[dateFormStyles.btnCancelText, { color: theme.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!canSave) return;
            onSave({ id: initial.id, label: label.trim(), pickerDate, notifyEnabled, notifyDaysBefore, notifyHour, notifyMinute });
          }}
          style={[dateFormStyles.btn, { backgroundColor: canSave ? theme.accent : theme.border }]}
          disabled={!canSave}
        >
          <Text style={dateFormStyles.btnSaveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const eventFormStyles = StyleSheet.create({
  offsetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  offsetChipText: { fontSize: 13, fontWeight: '500' },
});

// ── Event card ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onEdit,
  onDelete,
  theme,
}: {
  event: OneTimeEvent;
  onEdit: () => void;
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        i => { if (i === 0) onEdit(); else if (i === 1) onDelete(); },
      );
    } else {
      Alert.alert(event.label, undefined, [
        { text: 'Edit', onPress: onEdit },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const dateStr = new Date(event.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <TouchableOpacity
      onPress={onEdit}
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[dateCardStyles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      activeOpacity={0.7}
    >
      <View style={dateCardStyles.left}>
        <Text style={[dateCardStyles.label, { color: theme.textPrimary }]}>{event.label}</Text>
        <Text style={[dateCardStyles.dateText, { color: theme.textSecondary }]}>{dateStr}</Text>
      </View>
      {event.notifyEnabled && (
        <Ionicons name="notifications" size={16} color={theme.accent} />
      )}
    </TouchableOpacity>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────

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

// ── Main modal ────────────────────────────────────────────────────────────────

export function NotesModal({
  friend, visible, onClose, onUpdateNote, onDeleteNote, onConvertCheckIn,
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
  const significantDates = friend.significantDates ?? [];
  const oneTimeEvents = friend.oneTimeEvents ?? [];
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
                style={[styles.tab, activeTab === t && [styles.tabActive, { borderBottomColor: theme.accent }]]}
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
  tabActive: {},
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
  datesEmpty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
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
