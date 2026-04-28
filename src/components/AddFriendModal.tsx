import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (names: string[]) => void;
  existingNames: Set<string>;
}

type Tab = 'manual' | 'contacts';

export function AddFriendModal({ visible, onClose, onAdd, existingNames }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>('manual');
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactsFilter, setContactsFilter] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setName('');
      setContactsFilter('');
      setTab('manual');
      setSelected(new Set());
    }
  }, [visible]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    const { status } = await Contacts.requestPermissionsAsync();
    setContactsPermission(status === 'granted' ? 'granted' : 'denied');
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(data.filter(c => c.name && c.name.trim().length > 0));
    }
    setLoadingContacts(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'contacts' && contacts.length === 0 && contactsPermission === 'unknown') {
      loadContacts();
    }
  };

  const handleManualAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd([trimmed]);
    onClose();
  };

  const toggleContact = (contactName: string) => {
    if (existingNames.has(contactName.toLowerCase())) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(contactName) ? next.delete(contactName) : next.add(contactName);
      return next;
    });
  };

  const handleAddSelected = () => {
    if (selected.size === 0) return;
    onAdd(Array.from(selected));
    onClose();
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(contactsFilter.toLowerCase())
  );

  const addButtonLabel =
    selected.size === 0 ? 'Add' : selected.size === 1 ? 'Add 1 Friend' : `Add ${selected.size} Friends`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.cancelButton, { color: theme.accent }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Add Friend</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.segmentWrapper}>
          <View style={[styles.segment, { backgroundColor: theme.segment }]}>
            {(['manual', 'contacts'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentTab, tab === t && [styles.segmentTabActive, { backgroundColor: theme.segmentActive }]]}
                onPress={() => handleTabChange(t)}
              >
                <Text style={[styles.segmentLabel, { color: tab === t ? theme.textPrimary : theme.textSecondary }, tab === t && styles.segmentLabelActive]}>
                  {t === 'manual' ? 'Manual' : 'From Contacts'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {tab === 'manual' ? (
          <View style={styles.manualContainer}>
            <TextInput
              style={[styles.nameInput, { backgroundColor: theme.input, color: theme.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="Friend's name"
              placeholderTextColor={theme.placeholder}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleManualAdd}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: name.trim() ? theme.accent : theme.border }]}
              onPress={handleManualAdd}
              disabled={!name.trim()}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contactsContainer}>
            {contactsPermission === 'denied' ? (
              <View style={styles.permissionDenied}>
                <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
                  Contacts access is required. Enable it in Settings.
                </Text>
              </View>
            ) : loadingContacts ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={theme.accent} />
            ) : (
              <>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: theme.input, color: theme.textPrimary }]}
                  value={contactsFilter}
                  onChangeText={setContactsFilter}
                  placeholder="Search contacts…"
                  placeholderTextColor={theme.placeholder}
                  clearButtonMode="while-editing"
                />
                <FlatList
                  data={filteredContacts}
                  keyExtractor={item => (item as any).id ?? item.name ?? Math.random().toString()}
                  renderItem={({ item }) => {
                    const alreadyAdded = existingNames.has((item.name ?? '').toLowerCase());
                    const isSelected = selected.has(item.name ?? '');
                    return (
                      <TouchableOpacity
                        style={[styles.contactRow, { backgroundColor: theme.card }, alreadyAdded && styles.contactRowAdded]}
                        onPress={() => toggleContact(item.name ?? '')}
                        disabled={alreadyAdded}
                      >
                        <Text style={[styles.contactName, { color: theme.textPrimary }]}>{item.name}</Text>
                        {alreadyAdded ? (
                          <Text style={[styles.addedLabel, { color: theme.textSecondary }]}>Added</Text>
                        ) : (
                          <View style={[styles.checkbox, { borderColor: theme.border }, isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 100 }}
                />
                <View style={styles.addBar}>
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: selected.size > 0 ? theme.accent : theme.border }]}
                    onPress={handleAddSelected}
                    disabled={selected.size === 0}
                  >
                    <Text style={styles.addButtonText}>{addButtonLabel}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
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
  cancelButton: { fontSize: 17, width: 60 },
  segmentWrapper: { paddingHorizontal: 20, paddingVertical: 16 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segmentTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: { fontSize: 14, fontWeight: '500' },
  segmentLabelActive: { fontWeight: '600' },
  manualContainer: { paddingHorizontal: 20 },
  nameInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  addButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  contactsContainer: { flex: 1, paddingHorizontal: 20 },
  searchInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  contactRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactRowAdded: { opacity: 0.4 },
  contactName: { fontSize: 16, flex: 1 },
  addedLabel: { fontSize: 13 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  addBar: { position: 'absolute', bottom: 30, left: 0, right: 0, paddingHorizontal: 20 },
  permissionDenied: { marginTop: 40, alignItems: 'center', paddingHorizontal: 20 },
  permissionText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
