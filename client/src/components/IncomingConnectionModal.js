import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Radio, Smartphone, X, CheckCircle2 } from 'lucide-react-native';

export default function IncomingConnectionModal({
  visible,
  request,
  onAccept,
  onDecline,
}) {
  if (!visible || !request) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerBadge}>
            <Radio size={12} color="#38BDF8" />
            <Text style={styles.headerBadgeText}>DIRECT CONNECT REQUEST</Text>
          </View>

          <View style={styles.avatarCircle}>
            <Smartphone size={34} color="#38BDF8" />
          </View>

          <Text style={styles.title}>INCOMING CONNECTION</Text>
          <Text style={styles.deviceName}>{request.fromDeviceName || 'Nearby Device'}</Text>
          <Text style={styles.subtitle}>
            wants to connect with your device for instant file & media transfers in permanent room{' '}
            <Text style={styles.roomCodeHighlight}>#{request.roomCode}</Text>.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.7}>
              <X size={16} color="#94A3B8" />
              <Text style={styles.declineBtnText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.8}>
              <CheckCircle2 size={16} color="#0F172A" />
              <Text style={styles.acceptBtnText}>Accept & Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  headerBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  roomCodeHighlight: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'transparent',
  },
  declineBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  acceptBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  acceptBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
});
