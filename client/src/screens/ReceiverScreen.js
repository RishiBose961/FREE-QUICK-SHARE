import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import PinCodeInput from '../components/PinCodeInput';
import { socketService } from '../services/socketService';

export default function ReceiverScreen({ onCancel, onConnected }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const handleConnectionReady = (data) => {
      console.log('[Receiver] Connected with sender:', data.roomCode);
      if (isMounted) {
        setLoading(false);
        onConnected(data.roomCode, 'receiver');
      }
    };

    socketService.on('connection-ready', handleConnectionReady);

    return () => {
      isMounted = false;
      socketService.off('connection-ready', handleConnectionReady);
    };
  }, []);

  const handleJoin = async (pinToSubmit) => {
    const pin = pinToSubmit || code;
    if (pin.length !== 4) return;

    try {
      setLoading(true);
      const res = await socketService.joinRoom(pin);
      if (res && res.success) {
        // In case connection-ready fired or is pending
        onConnected(pin, 'receiver');
      }
    } catch (err) {
      setLoading(false);
      Alert.alert('Join Failed', err.message || 'Invalid or expired 4-digit code. Please try again.');
    }
  };

  const handleCancel = () => {
    socketService.leaveRoom();
    onCancel();
  };

  return (
    <View style={styles.container}>
      <PinCodeInput
        code={code}
        onChangeCode={setCode}
        onSubmit={handleJoin}
        isLoading={loading}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
});

