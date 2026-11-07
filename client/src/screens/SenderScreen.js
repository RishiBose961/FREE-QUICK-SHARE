import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PinCodeDisplay from '../components/PinCodeDisplay';
import { socketService } from '../services/socketService';

export default function SenderScreen({ onCancel, onConnected }) {
  const [roomCode, setRoomCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initRoom = async () => {
    try {
      setLoading(true);
      setError(null);
      const code = await socketService.createRoom();
      setRoomCode(code);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Could not connect to signaling server');
      setLoading(false);
      Alert.alert('Connection Error', err.message || 'Make sure the server is running and accessible.');
    }
  };

  useEffect(() => {
    let isMounted = true;

    initRoom();

    // Listen for peer connection event
    const handleConnectionReady = (data) => {
      console.log('[Sender] Receiver connected to room:', data.roomCode);
      if (isMounted) {
        onConnected(data.roomCode, 'sender');
      }
    };

    socketService.on('connection-ready', handleConnectionReady);

    return () => {
      isMounted = false;
      socketService.off('connection-ready', handleConnectionReady);
    };
  }, []);

  const handleCancel = () => {
    socketService.leaveRoom();
    onCancel();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Generating 4-Digit Room Code...</Text>
          <Text style={styles.loadingSubtext}>Creating a secure peer-to-peer session</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Could Not Create Room</Text>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={initRoom} activeOpacity={0.8}>
              <Ionicons name="refresh" size={15} color="#0F172A" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Text style={styles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <PinCodeDisplay pinCode={roomCode} onCancel={handleCancel} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 18,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingSubtext: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 12,
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
  },
  backBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
});
