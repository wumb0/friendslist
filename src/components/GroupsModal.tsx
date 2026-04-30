import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Group, Schedule, ScheduleFrequency } from '../types/Group';
import { Friend } from '../types/Friend';
import { generateId } from '../utils/uuid';
import { formatTime } from '../utils/formatTime';

interface Props {
  visible: boolean;
  onClose: () => void;
  groups: Group[];
  friends: Friend[];
  onAddGroup: (name: string, schedules: Schedule[], significantDatesEnabled: boolean) => Promise<Group>;
  onUpdateGroup: (id: string, updates: Partial<Omit<Group, 'id'>>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onMoveGroupMembers: (fromGroupId: string, toGroupId: string) => Promise<void>;
}

const FREQUENCIES: { label: string; sublabel: string; value: ScheduleFrequency }[] = [
  { label: 'Daily',   sublabel: 'Every day',    value: 'daily' },
  { label: 'Weekly',  sublabel: 'Once a week',  value: 'weekly' },
  { label: 'Monthly', sublabel: 'Once a month', value: 'monthly' },
];

const WEEKDAYS = [
  { label: 'Sun', value: 1 },
  { label: 'Mon', value: 2 },
  { label: 'Tue', value: 3 },
  { label: 'Wed', value: 4 },
  { label: 'Thu', value: 5 },
  { label: 'Fri', value: 6 },
  { label: 'Sat', value: 7 },
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function scheduleLabel(s: Schedule): string {
  const t = formatTime(s.hour, s.minute);
  if (s.frequency === 'daily') return `Daily · ${t}`;
  if (s.frequency === 'weekly') {
    const day = WEEKDAYS.find(d => d.value === (s.weekday ?? 2))?.label ?? 'Mon';
    return `Weekly · ${day} · ${t}`;
  }
  return `Monthly · ${ordinal(s.day ?? 1)} · ${t}`;
}

function scheduleSummary(group: Group): string {
  if (group.schedules.length === 0) return 'Off';
  if (group.schedules.length === 1) return scheduleLabel(group.schedules[0]);
  return `${group.schedules.length} schedules`;
}

type EditState = {
  id: string | null;
  name: string;
  schedules: Schedule[];
  significantDatesEnabled: boolean;
};

type ScheduleEditorState = {
  scheduleId: string | null;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  weekday: number;
  day: number;
};

export function GroupsModal({ visible, onClose, groups, friends, onAddGroup, onUpdateGroup, onDeleteGroup, onMoveGroupMembers }: Props) {
  const { theme, settings } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;

  const [editing, setEditing] = useState<EditState | null>(null);
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleEditorState | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const openNew = () => {
    setEditing({ id: null, name: '', schedules: [], significantDatesEnabled: true });
    setScheduleEditor(null);
    setShowTimePicker(false);
  };

  const openEdit = (group: Group) => {
    setEditing({ id: group.id, name: group.name, schedules: [...group.schedules], significantDatesEnabled: group.significantDatesEnabled });
    setScheduleEditor(null);
    setShowTimePicker(false);
  };

  const openNewSchedule = () => {
    setScheduleEditor({ scheduleId: null, frequency: 'weekly', hour: 9, minute: 0, weekday: 2, day: 1 });
    setShowTimePicker(false);
  };

  const openEditSchedule = (s: Schedule) => {
    setScheduleEditor({ scheduleId: s.id, frequency: s.frequency, hour: s.hour, minute: s.minute, weekday: s.weekday ?? 2, day: s.day ?? 1 });
    setShowTimePicker(false);
  };

  const handleSaveSchedule = () => {
    if (!scheduleEditor || !editing) return;
    const s: Schedule = {
      id: scheduleEditor.scheduleId ?? generateId(),
      frequency: scheduleEditor.frequency,
      hour: scheduleEditor.hour,
      minute: scheduleEditor.minute,
      weekday: scheduleEditor.frequency === 'weekly' ? scheduleEditor.weekday : undefined,
      day: scheduleEditor.frequency === 'monthly' ? scheduleEditor.day : undefined,
    };
    setEditing(e => {
      if (!e) return e;
      const idx = e.schedules.findIndex(x => x.id === s.id);
      const schedules = idx >= 0
        ? e.schedules.map((x, i) => i === idx ? s : x)
        : [...e.schedules, s];
      return { ...e, schedules };
    });
    setScheduleEditor(null);
    setShowTimePicker(false);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setEditing(e => e ? { ...e, schedules: e.schedules.filter(s => s.id !== scheduleId) } : e);
  };

  const handleBack = () => {
    if (scheduleEditor) {
      setScheduleEditor(null);
      setShowTimePicker(false);
    } else {
      setEditing(null);
      setShowTimePicker(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.id) {
      await onUpdateGroup(editing.id, {
        name,
        schedules: editing.schedules,
        significantDatesEnabled: editing.significantDatesEnabled,
      });
    } else {
      await onAddGroup(name, editing.schedules, editing.significantDatesEnabled);
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (groups.length <= 1) {
      Alert.alert('Cannot Delete', 'You must have at least one group.');
      return;
    }
    const members = friends.filter(f => f.groupId === id);
    const otherGroups = groups.filter(g => g.id !== id);
    const doDelete = async () => { await onDeleteGroup(id); setEditing(null); };

    if (members.length > 0) {
      const count = members.length;
      const noun = count === 1 ? 'friend' : 'friends';
      if (Platform.OS === 'ios') {
        const options = [...otherGroups.map(g => g.name), 'Cancel'];
        ActionSheetIOS.showActionSheetWithOptions(
          { title: `Move ${count} ${noun} to:`, options, cancelButtonIndex: options.length - 1 },
          async i => { if (i < otherGroups.length) { await onMoveGroupMembers(id, otherGroups[i].id); await doDelete(); } },
        );
      } else {
        Alert.alert(`Move ${count} ${noun} to:`, undefined, [
          ...otherGroups.map(g => ({
            text: g.name,
            onPress: async () => { await onMoveGroupMembers(id, g.id); await doDelete(); },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]);
      }
      return;
    }

    Alert.alert('Delete Group', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date && scheduleEditor) {
      setScheduleEditor(e => e ? { ...e, hour: date.getHours(), minute: date.getMinutes() } : e);
    }
  };

  const handleClose = () => { setEditing(null); setScheduleEditor(null); setShowTimePicker(false); onClose(); };

  const pickerDate = scheduleEditor
    ? new Date(new Date().setHours(scheduleEditor.hour, scheduleEditor.minute, 0, 0))
    : new Date();

  const isScheduleEditing = scheduleEditor !== null;
  const isGroupEditing = editing !== null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={isScheduleEditing ? () => { setScheduleEditor(null); setShowTimePicker(false); } : isGroupEditing ? handleBack : handleClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          {isScheduleEditing || isGroupEditing ? (
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {isScheduleEditing
              ? (scheduleEditor.scheduleId ? 'Edit Schedule' : 'New Schedule')
              : isGroupEditing
              ? (editing.id ? 'Edit Group' : 'New Group')
              : 'Groups & Schedules'}
          </Text>
          {isScheduleEditing ? (
            <TouchableOpacity onPress={handleSaveSchedule} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: theme.accent, textAlign: 'right' }]}>
                {scheduleEditor.scheduleId ? 'Save' : 'Add'}
              </Text>
            </TouchableOpacity>
          ) : isGroupEditing ? (
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={!editing.name.trim()}>
              <Text style={[styles.headerAction, { color: editing.name.trim() ? theme.accent : theme.textSecondary, textAlign: 'right' }]}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: theme.accent, textAlign: 'right' }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {!settings.remindersEnabled && (
          <View style={[styles.disabledBanner, { backgroundColor: theme.badge }]}>
            <Text style={[styles.disabledBannerText, { color: theme.textSecondary }]}>
              Reminders are globally disabled in Settings.
            </Text>
          </View>
        )}

        {/* Schedule sub-editor */}
        {isScheduleEditing && scheduleEditor && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Frequency */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Frequency</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {FREQUENCIES.map((f, i) => (
                <View key={f.value}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => setScheduleEditor(e => e ? { ...e, frequency: f.value } : e)}
                  >
                    <View style={styles.freqLabels}>
                      <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{f.label}</Text>
                      <Text style={[styles.sublabel, { color: theme.textSecondary }]}>{f.sublabel}</Text>
                    </View>
                    {scheduleEditor.frequency === f.value && (
                      <Text style={[styles.selectedCheck, { color: theme.accent }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                  {i < FREQUENCIES.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>

            {/* Day of week */}
            {scheduleEditor.frequency === 'weekly' && (
              <>
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Day of Week</Text>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map(d => {
                      const active = scheduleEditor.weekday === d.value;
                      return (
                        <TouchableOpacity
                          key={d.value}
                          style={[styles.weekdayBtn, { borderColor: theme.border, backgroundColor: active ? theme.accent : theme.background }]}
                          onPress={() => setScheduleEditor(e => e ? { ...e, weekday: d.value } : e)}
                        >
                          <Text style={[styles.weekdayBtnText, { color: active ? '#fff' : theme.textPrimary }]}>
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {/* Day of month */}
            {scheduleEditor.frequency === 'monthly' && (
              <>
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Day of Month</Text>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      onPress={() => setScheduleEditor(e => e ? { ...e, day: Math.max(1, e.day - 1) } : e)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={[styles.stepperBtn, { color: theme.accent }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stepperValue, { color: theme.textPrimary }]}>
                      {ordinal(scheduleEditor.day)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setScheduleEditor(e => e ? { ...e, day: Math.min(28, e.day + 1) } : e)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={[styles.stepperBtn, { color: theme.accent }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Time */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminder Time</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={styles.row} onPress={() => setShowTimePicker(true)}>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Time</Text>
                <Text style={[styles.timeValue, { color: theme.accent }]}>
                  {formatTime(scheduleEditor.hour, scheduleEditor.minute)}
                </Text>
              </TouchableOpacity>
              {showTimePicker && Platform.OS === 'ios' && (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor={theme.textPrimary}
                  themeVariant={theme.isDark ? 'dark' : 'light'}
                  style={styles.iosPicker}
                />
              )}
            </View>

            {showTimePicker && Platform.OS === 'android' && (
              <DateTimePicker value={pickerDate} mode="time" display="default" onChange={handleTimeChange} textColor={theme.textPrimary} themeVariant={theme.isDark ? 'dark' : 'light'} />
            )}
          </ScrollView>
        )}

        {/* Group edit view */}
        {!isScheduleEditing && isGroupEditing && editing && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Name */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Name</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <TextInput
                style={[styles.nameInput, { color: theme.textPrimary }]}
                value={editing.name}
                onChangeText={name => setEditing(e => e ? { ...e, name } : e)}
                placeholder="Group name"
                placeholderTextColor={theme.placeholder}
                autoFocus={editing.id === null}
                maxLength={20}
              />
            </View>

            {/* Schedules list */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Schedules</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {editing.schedules.length === 0 ? (
                <View style={styles.row}>
                  <Text style={[styles.sublabel, { color: theme.textSecondary }]}>No reminders — add a schedule below</Text>
                </View>
              ) : (
                editing.schedules.map((s, i) => (
                  <View key={s.id}>
                    <TouchableOpacity style={styles.scheduleRow} onPress={() => openEditSchedule(s)}>
                      <Text style={[styles.rowLabel, { color: theme.textPrimary, flex: 1 }]}>{scheduleLabel(s)}</Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteSchedule(s.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.danger} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                    {i < editing.schedules.length - 1 && (
                      <View style={[styles.separator, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                ))
              )}
              {editing.schedules.length > 0 && (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
              <TouchableOpacity style={styles.row} onPress={openNewSchedule}>
                <Text style={[styles.rowLabel, { color: theme.accent }]}>Add Schedule</Text>
              </TouchableOpacity>
            </View>

            {/* Significant dates */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Significant Dates</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => setEditing(e => e ? { ...e, significantDatesEnabled: !e.significantDatesEnabled } : e)}
              >
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Significant date reminders</Text>
                <Ionicons
                  name={editing.significantDatesEnabled ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={editing.significantDatesEnabled ? theme.accent : theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Delete */}
            {editing.id && (
              <>
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]} />
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <TouchableOpacity style={styles.row} onPress={() => editing.id && handleDelete(editing.id)}>
                    <Text style={[styles.rowLabel, { color: theme.danger }]}>Delete Group</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        )}

        {/* Groups list */}
        {!isScheduleEditing && !isGroupEditing && (
          <ScrollView>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>My Groups</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {groups.map((group, i) => {
                const count = friends.filter(f => f.groupId === group.id).length;
                return (
                  <View key={group.id}>
                    <TouchableOpacity style={styles.groupRow} onPress={() => openEdit(group)}>
                      <View style={styles.groupInfo}>
                        <Text style={[styles.groupName, { color: theme.textPrimary }]}>{group.name}</Text>
                        <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>
                          {count} {count === 1 ? 'person' : 'people'} · {scheduleSummary(group)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                    {i < groups.length - 1 && (
                      <View style={[styles.separator, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: theme.card, marginTop: 16 }]}>
              <TouchableOpacity style={styles.row} onPress={openNew}>
                <Text style={[styles.rowLabel, { color: theme.accent }]}>Add Group</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  headerAction: { fontSize: 17, fontWeight: '600', width: 60 },
  disabledBanner: { paddingHorizontal: 20, paddingVertical: 10 },
  disabledBannerText: { fontSize: 13, textAlign: 'center' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: { fontSize: 16 },
  nameInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  freqLabels: { flex: 1 },
  sublabel: { fontSize: 13, marginTop: 2 },
  selectedCheck: { fontSize: 18, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  weekdayBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  weekdayBtnText: { fontSize: 12, fontWeight: '600' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 32,
  },
  stepperBtn: { fontSize: 24, fontWeight: '400', width: 32, textAlign: 'center' },
  stepperValue: { fontSize: 17, fontWeight: '600', minWidth: 60, textAlign: 'center' },
  timeValue: { fontSize: 16, fontWeight: '500' },
  iosPicker: { marginBottom: 8 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16 },
  groupMeta: { fontSize: 13, marginTop: 2 },
});
