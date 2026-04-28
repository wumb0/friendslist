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
import { Group, GroupFrequency } from '../types/Group';
import { Friend } from '../types/Friend';

interface Props {
  visible: boolean;
  onClose: () => void;
  groups: Group[];
  friends: Friend[];
  onAddGroup: (name: string, freq: GroupFrequency, hour: number, minute: number) => Promise<Group>;
  onUpdateGroup: (id: string, updates: Partial<Omit<Group, 'id'>>) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onMoveGroupMembers: (fromGroupId: string, toGroupId: string) => Promise<void>;
}

const FREQUENCIES: { label: string; sublabel: string; value: GroupFrequency }[] = [
  { label: 'Daily', sublabel: 'Every day', value: 'daily' },
  { label: 'Weekly', sublabel: 'Every Monday', value: 'weekly' },
  { label: 'Off', sublabel: 'No reminders', value: 'off' },
];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

function frequencyLabel(freq: GroupFrequency): string {
  if (freq === 'daily') return 'Daily';
  if (freq === 'weekly') return 'Weekly';
  return 'Off';
}

type EditState = {
  id: string | null; // null = new group
  name: string;
  notificationFrequency: GroupFrequency;
  notificationHour: number;
  notificationMinute: number;
};

export function GroupsModal({ visible, onClose, groups, friends, onAddGroup, onUpdateGroup, onDeleteGroup, onMoveGroupMembers }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;

  const [editing, setEditing] = useState<EditState | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const openNew = () => {
    setEditing({ id: null, name: '', notificationFrequency: 'weekly', notificationHour: 9, notificationMinute: 0 });
    setShowTimePicker(false);
  };

  const openEdit = (group: Group) => {
    setEditing({
      id: group.id,
      name: group.name,
      notificationFrequency: group.notificationFrequency,
      notificationHour: group.notificationHour,
      notificationMinute: group.notificationMinute,
    });
    setShowTimePicker(false);
  };

  const handleBack = () => { setEditing(null); setShowTimePicker(false); };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.id) {
      await onUpdateGroup(editing.id, {
        name,
        notificationFrequency: editing.notificationFrequency,
        notificationHour: editing.notificationHour,
        notificationMinute: editing.notificationMinute,
      });
    } else {
      await onAddGroup(name, editing.notificationFrequency, editing.notificationHour, editing.notificationMinute);
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
    if (date && editing) {
      setEditing(e => e ? { ...e, notificationHour: date.getHours(), notificationMinute: date.getMinutes() } : e);
    }
  };

  const handleClose = () => { setEditing(null); setShowTimePicker(false); onClose(); };

  const pickerDate = editing ? new Date(new Date().setHours(editing.notificationHour, editing.notificationMinute, 0, 0)) : new Date();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          {editing ? (
            <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: theme.accent }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {editing ? (editing.id ? 'Edit Group' : 'New Group') : 'Groups'}
          </Text>
          {editing ? (
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={!editing.name.trim()}>
              <Text style={[styles.headerAction, { color: editing.name.trim() ? theme.accent : theme.textSecondary, textAlign: 'right' }]}>Save</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.headerAction, { color: theme.accent, textAlign: 'right' }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <ScrollView keyboardShouldPersistTaps="handled">
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

            {/* Reminders */}
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminders</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {FREQUENCIES.map((f, i) => (
                <View key={f.value}>
                  <TouchableOpacity
                    style={styles.freqRow}
                    onPress={() => setEditing(e => e ? { ...e, notificationFrequency: f.value } : e)}
                  >
                    <View style={styles.freqLabels}>
                      <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{f.label}</Text>
                      <Text style={[styles.sublabel, { color: theme.textSecondary }]}>{f.sublabel}</Text>
                    </View>
                    {editing.notificationFrequency === f.value && (
                      <Text style={[styles.selectedCheck, { color: theme.accent }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                  {i < FREQUENCIES.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>

            {/* Time */}
            {editing.notificationFrequency !== 'off' && (
              <>
                <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminder Time</Text>
                <View style={[styles.card, { backgroundColor: theme.card }]}>
                  <TouchableOpacity style={styles.row} onPress={() => setShowTimePicker(true)}>
                    <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Time</Text>
                    <Text style={[styles.timeValue, { color: theme.accent }]}>
                      {formatTime(editing.notificationHour, editing.notificationMinute)}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={pickerDate}
                      mode="time"
                      display="spinner"
                      onChange={handleTimeChange}
                      textColor={theme.textPrimary}
                      style={styles.iosPicker}
                    />
                  )}
                </View>
              </>
            )}

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

            {showTimePicker && Platform.OS === 'android' && (
              <DateTimePicker value={pickerDate} mode="time" display="default" onChange={handleTimeChange} />
            )}
          </ScrollView>
        ) : (
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
                          {count} {count === 1 ? 'person' : 'people'} · {frequencyLabel(group.notificationFrequency)}
                          {group.notificationFrequency !== 'off' ? ` · ${formatTime(group.notificationHour, group.notificationMinute)}` : ''}
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
  rowLabel: { fontSize: 16 },
  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  freqLabels: { flex: 1 },
  sublabel: { fontSize: 13, marginTop: 2 },
  selectedCheck: { fontSize: 18, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
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
  danger: { color: '#FF3B30' },
});
