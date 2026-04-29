import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ActionSheetIOS } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Friend } from '../types/Friend';
import { timeAgo, urgencyColor } from '../utils/timeAgo';
import { useTheme } from '../context/ThemeContext';

interface Props {
  friend: Friend;
  onCheckIn: (id: string) => void;
  onPress: (friend: Friend) => void;
  onDelete: (id: string) => void;
  onAddNote: (friend: Friend) => void;
  groupName?: string;
  noteSnippet?: string;
  onEdit: (friend: Friend) => void;
}

export function FriendCard({ friend, onCheckIn, onPress, onDelete, onAddNote, groupName, noteSnippet, onEdit }: Props) {
  const { theme } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const handleCheckIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCheckIn(friend.id);
  };

  const handleNoteSwipe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    // Small delay so the close animation starts before the modal appears
    setTimeout(() => onAddNote(friend), 120);
  };

  const confirmDelete = () => {
    Alert.alert('Remove Friend', `Remove ${friend.name} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(friend.id) },
    ]);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Edit Name', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        i => { if (i === 0) onEdit(friend); if (i === 1) confirmDelete(); },
      );
    } else {
      Alert.alert(friend.name, undefined, [
        { text: 'Edit Name', onPress: () => onEdit(friend) },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const renderLeftAction = () => (
    <View style={styles.checkInAction}>
      <Text style={styles.actionIcon}>✓</Text>
      <Text style={styles.actionLabel}>Checked in</Text>
    </View>
  );

  const renderRightAction = () => (
    <View style={[styles.noteAction, { backgroundColor: theme.accent }]}>
      <Text style={styles.actionIcon}>✏︎</Text>
      <Text style={styles.actionLabel}>Add Note</Text>
    </View>
  );

  const urgency = urgencyColor(friend.lastCheckedIn);

  return (
    <Swipeable
      ref={swipeableRef}
      key={`${friend.id}-${friend.lastCheckedIn}`}
      renderLeftActions={renderLeftAction}
      renderRightActions={renderRightAction}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') handleCheckIn();
        if (direction === 'right') handleNoteSwipe();
      }}
      leftThreshold={80}
      rightThreshold={80}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card }]}
        onPress={() => onPress(friend)}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        <View style={[styles.urgencyBar, { backgroundColor: urgency }]} />
        <View style={styles.content}>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{friend.name}</Text>
          <Text style={[styles.time, { color: urgency }]}>{timeAgo(friend.lastCheckedIn)}</Text>
          {groupName && (
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>{groupName}</Text>
          )}
          {noteSnippet && (
            <Text style={[styles.noteSnippet, { color: theme.textSecondary }]} numberOfLines={2}>{noteSnippet}</Text>
          )}
        </View>
        {friend.notes.length > 0 && (
          <View style={[styles.notesBadge, { backgroundColor: theme.badge }]}>
            <Text style={[styles.notesBadgeText, { color: theme.badgeText }]}>
              {friend.notes.length} {friend.notes.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  checkInAction: {
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    marginBottom: 10,
    borderRadius: 14,
  },
  noteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    marginBottom: 10,
    borderRadius: 14,
  },
  actionIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  card: {
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  urgencyBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  time: {
    fontSize: 13,
    fontWeight: '500',
  },
  groupLabel: {
    fontSize: 12,
    marginTop: 3,
  },
  noteSnippet: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  notesBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 14,
  },
  notesBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
