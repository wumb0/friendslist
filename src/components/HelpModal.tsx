import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    icon: 'person-add-outline' as const,
    title: 'Adding Friends',
    body: 'Tap the + button on the home screen to add a friend. Enter their name manually or import directly from your Contacts. If you have multiple groups, choose which group to add them to before saving.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: 'Checking In & Adding Notes',
    body: 'Swipe a friend\'s card to the right to record a check-in. Swipe left to add a note about your interaction. If you already added a note today, swiping left re-opens it so you can update it. Long-pressing a check-in entry in the history converts it to a note.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Significant Dates & One-Time Events',
    body: 'Open a friend\'s history and go to the Dates tab. Under "Recurring Dates" you can add birthdays, anniversaries, or any yearly date — with an optional notification on the day. Under "One-Time Events" you can add future events like a surgery or trip and get notified the same day, 1 day before, 2 days before, or a week before.',
  },
  {
    icon: 'time-outline' as const,
    title: 'Viewing History',
    body: 'Tap any friend\'s card to open their history. The History tab shows all check-ins and notes in chronological order, with pinned notes at the top. Tap a note to edit it inline. Long-press a check-in to convert it to a note.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Adding Groups',
    body: 'Go to Settings → Groups & Schedules and tap the + button to create a new group. Groups let you organize friends and set separate reminder schedules for each one. A default "Friends" group is created automatically when you first open the app.',
  },
  {
    icon: 'swap-horizontal-outline' as const,
    title: 'Assigning People to Groups',
    body: 'Open a friend\'s history modal. At the top you\'ll see a row showing their current group — tap any other group pill in that row to move them instantly. You can also reassign everyone in a group at once when deleting a group.',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Per-Group Notifications',
    body: 'Go to Settings → Groups & Schedules, then tap a group to edit it. Tap "Add Schedule" to set a daily, weekly, or monthly reminder for that group. You can add multiple schedules (e.g. Monday and Thursday). The notification names the most overdue friend in the group. The master Reminders switch in Settings turns all notifications on or off globally.',
  },
];

export function HelpModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'ios' ? insets.top + 14 : (StatusBar.currentHeight ?? 0) + 14;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border, paddingTop: topPadding }]}>
          <View style={{ width: 60 }} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Help</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.doneButton, { color: theme.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {SECTIONS.map((section, i) => (
            <View key={i} style={[styles.section, { backgroundColor: theme.card }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon} size={22} color={theme.accent} style={styles.icon} />
                <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{section.title}</Text>
              </View>
              <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
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
  content: { padding: 20, gap: 12 },
  section: {
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon: { marginRight: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  sectionBody: { fontSize: 15, lineHeight: 22 },
});
