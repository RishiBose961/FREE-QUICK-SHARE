import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ServerUrlModal({ visible, currentUrl, onClose, onSave }) {
  const [url, setUrl] = useState(currentUrl || 'http://localhost:4000');

  // Always keep input synchronized with the currently loaded/saved server URL
  useEffect(() => {
    if (visible && currentUrl) {
      setUrl(currentUrl);
    }
  }, [visible, currentUrl]);

  const handleSave = () => {
    if (url && url.trim()) {
      let clean = url.trim();
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = `http://${clean}`;
      }
      if (clean.endsWith('/')) {
        clean = clean.slice(0, -1);
      }
      onSave(clean);
      onClose();
    }
  };

  const handleSetLocalhost = () => {
    setUrl('http://localhost:4000');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="server-outline" size={20} color="#38BDF8" />
            </View>
            <View style={styles.headerCol}>
              <Text style={styles.title}>Relay Server Connection</Text>
              <Text style={styles.subtitle}>
                Configure the IP and port where your relay server is running.
              </Text>
            </View>
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={16} color="#FBBF24" style={styles.tipIcon} />
            <Text style={styles.tipText}>
              On mobile (Expo Go), replace "localhost" with your machine's LAN IP address (e.g.{' '}
              <Text style={styles.bold}>http://192.168.1.X:4000</Text>). Check your computer's server console!
            </Text>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={url}
              onChangeText={setUrl}
              placeholder="http://192.168.1.X:4000"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {url && url.length > 0 ? (
              <TouchableOpacity onPress={() => setUrl('')} style={styles.inputClearBtn}>
                <Ionicons name="close-circle" size={18} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.currentActiveRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#38BDF8" />
            <Text style={styles.currentActiveText} numberOfLines={1}>
              Active: {currentUrl || 'http://localhost:4000'}
            </Text>
          </View>

          <View style={styles.presetRow}>
            <Text style={styles.presetLabel}>Quick Preset:</Text>
            <TouchableOpacity onPress={handleSetLocalhost} style={styles.presetPill}>
              <Text style={styles.presetPillText}>localhost:4000</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={16} color="#0F172A" />
              <Text style={styles.saveBtnText}>Save & Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCol: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  tipBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 17,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 40,
    color: '#F8FAFC',
    fontSize: 14,
  },
  inputClearBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  currentActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  currentActiveText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  presetLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  presetPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  presetPillText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
});
