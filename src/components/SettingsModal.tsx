import React, { useState } from 'react';
import { Modal, View, Text, Switch, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme, NotificationFrequency } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const FREQUENCIES: { label: string; sublabel: string; value: NotificationFrequency }[] = [
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

export function SettingsModal({ visible, onClose }: Props) {
  const { theme, settings, updateSettings } = useTheme();
  const [showTimePicker, setShowTimePicker] = useState(false);

  const pickerDate = new Date();
  pickerDate.setHours(settings.notificationHour, settings.notificationMinute, 0, 0);

  const handleTimeChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      updateSettings({
        notificationHour: date.getHours(),
        notificationMinute: date.getMinutes(),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.doneButton, { color: theme.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Dark Mode</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={val => updateSettings({ darkMode: val })}
              trackColor={{ false: '#E5E5EA', true: theme.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Reminders */}
        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminders</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {FREQUENCIES.map((f, i) => (
            <View key={f.value}>
              <TouchableOpacity
                style={styles.freqRow}
                onPress={() => updateSettings({ notificationFrequency: f.value })}
              >
                <View style={styles.freqLabels}>
                  <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{f.label}</Text>
                  <Text style={[styles.sublabel, { color: theme.textSecondary }]}>{f.sublabel}</Text>
                </View>
                {settings.notificationFrequency === f.value && (
                  <Text style={[styles.selectedCheck, { color: theme.accent }]}>✓</Text>
                )}
              </TouchableOpacity>
              {i < FREQUENCIES.length - 1 && (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
            </View>
          ))}
        </View>

        {/* Time — only shown when notifications are on */}
        {settings.notificationFrequency !== 'off' && (
          <>
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminder Time</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <TouchableOpacity style={styles.row} onPress={() => setShowTimePicker(true)}>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Time</Text>
                <Text style={[styles.timeValue, { color: theme.accent }]}>
                  {formatTime(settings.notificationHour, settings.notificationMinute)}
                </Text>
              </TouchableOpacity>

              {/* iOS: show inline below the row */}
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

        {/* Android: renders as a modal dialog, shown via state */}
        {showTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="default"
            onChange={handleTimeChange}
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
    paddingTop: Platform.OS === 'ios' ? 56 : 14,
  },
  title: { fontSize: 17, fontWeight: '600' },
  doneButton: { fontSize: 17, fontWeight: '600', width: 60, textAlign: 'right' },
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
});
