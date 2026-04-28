import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  friendName: string | null;
  visible: boolean;
  initialContent?: string;
  onSubmit: (content: string | null) => void;
  onDismiss: () => void;
}

export function QuickNoteModal({ friendName, visible, initialContent, onSubmit, onDismiss }: Props) {
  const { theme } = useTheme();
  const [content, setContent] = useState('');

  useEffect(() => {
    if (visible) {
      setContent(initialContent ?? '');
    } else {
      setContent('');
    }
  }, [visible, initialContent]);

  const hasText = content.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.textSecondary }]}>
            Checking in with{' '}
            <Text style={[styles.name, { color: theme.textPrimary }]}>{friendName}</Text>
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: theme.input, color: theme.textPrimary, borderColor: theme.border }]}
            value={content}
            onChangeText={setContent}
            placeholder="What did you talk about? (optional)"
            placeholderTextColor={theme.placeholder}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: hasText ? theme.accent : theme.green }]}
            onPress={() => onSubmit(hasText ? content.trim() : null)}
          >
            <Text style={styles.buttonText}>
              {hasText ? 'Add Note' : 'Checked In (no note)'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    marginBottom: 12,
  },
  name: {
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
