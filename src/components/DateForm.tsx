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
import { SignificantDate } from '../types/Friend';
import { formatTime } from '../utils/formatTime';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const PRESET_LABELS = ['Birthday', 'Anniversary'];

export function formatSignificantDate(date: SignificantDate): string {
  const month = MONTHS[date.month - 1];
  if (date.year) return `${month} ${date.day}, ${date.year}`;
  return `${month} ${date.day}`;
}

export interface DateFormState {
  id: string | null;
  label: string;
  pickerDate: Date;
  includeYear: boolean;
  notifyEnabled: boolean;
  notifyHour: number;
  notifyMinute: number;
}

export function makeDatePickerDate(month: number, day: number, year?: number): Date {
  return new Date(year ?? 2000, month - 1, day);
}

export function DateForm({
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

export const dateFormStyles = StyleSheet.create({
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

export function DateCard({
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

export const dateCardStyles = StyleSheet.create({
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
