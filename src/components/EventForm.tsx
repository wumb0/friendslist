import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { OneTimeEvent } from '../types/Friend';
import { formatTime } from '../utils/formatTime';
import { dateFormStyles, dateCardStyles } from './DateForm';

export interface EventFormState {
  id: string | null;
  label: string;
  pickerDate: Date;
  notifyEnabled: boolean;
  notifyDaysBefore: number;
  notifyHour: number;
  notifyMinute: number;
}

export const NOTIFY_OFFSETS: { label: string; value: number }[] = [
  { label: 'Same day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '2 days before', value: 2 },
  { label: '1 week before', value: 7 },
];

export function EventForm({
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

export const eventFormStyles = StyleSheet.create({
  offsetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  offsetChipText: { fontSize: 13, fontWeight: '500' },
});

export function EventCard({
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
