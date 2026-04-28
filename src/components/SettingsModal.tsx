import React from 'react';
import { Modal, View, Text, Switch, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenGroups: () => void;
}

export function SettingsModal({ visible, onClose, onOpenGroups }: Props) {
  const { theme, settings, updateSettings } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.doneButton, { color: theme.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

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

        <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>Reminders</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Enable Reminders</Text>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={val => updateSettings({ remindersEnabled: val })}
              trackColor={{ false: '#E5E5EA', true: theme.accent }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
          <TouchableOpacity
            style={[styles.row, !settings.remindersEnabled && styles.rowDisabled]}
            onPress={onOpenGroups}
            disabled={!settings.remindersEnabled}
          >
            <Text style={[styles.rowLabel, { color: settings.remindersEnabled ? theme.textPrimary : theme.textSecondary }]}>
              Groups & Schedules
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
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
  rowDisabled: { opacity: 0.4 },
  rowLabel: { fontSize: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
});
