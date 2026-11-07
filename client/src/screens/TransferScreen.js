import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeftRight,
  FileText,
  Image,
  Camera,
  Video,
  MessageSquare,
  Layers,
} from 'lucide-react-native';
import TransferCard from '../components/TransferCard';
import TextMessageModal from '../components/TextMessageModal';
import { fileTransferService } from '../services/fileTransferService';
import { socketService } from '../services/socketService';

export default function TransferScreen({ roomCode, role, peerName, onDisconnect }) {
  const [transfers, setTransfers] = useState([]);
  const [isPicking, setIsPicking] = useState(false);
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [peerReconnecting, setPeerReconnecting] = useState(false);

  const queuedCount = transfers.filter((t) => t.status === 'queued').length;

  useEffect(() => {
    // Ensure socket knows current room code
    if (roomCode) {
      socketService.setCurrentRoom(roomCode);
    }

    // 1. Subscribe to file transfer lifecycle events
    const unsubscribe = fileTransferService.subscribe((event) => {
      setTransfers((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === event.item?.id);

        if (event.type === 'send-start' || event.type === 'receive-start') {
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...event.item };
            return updated;
          }
          return [event.item, ...prev];
        }

        if (event.type === 'send-progress' || event.type === 'receive-progress') {
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...event.item };
            return updated;
          }
        }

        if (event.type === 'send-complete' || event.type === 'receive-complete') {
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...event.item };
            return updated;
          }
        }

        if (event.type === 'send-error' || event.type === 'receive-error') {
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...event.item };
            return updated;
          }
        }

        return prev;
      });
    });

    // 2. Listen for incoming text messages
    const handleReceiveMessage = (messagePayload) => {
      const textItem = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'text',
        text: messagePayload.text,
        sender: messagePayload.sender || 'Peer',
        timestamp: messagePayload.timestamp || Date.now(),
        direction: 'incoming',
        status: 'completed',
      };
      setTransfers((prev) => [textItem, ...prev]);
    };

    socketService.on('receive-message', handleReceiveMessage);

    // 3. Listen for temporary reconnecting state
    const handlePeerReconnecting = () => {
      setPeerReconnecting(true);
    };

    const handlePeerReconnected = () => {
      setPeerReconnecting(false);
    };

    socketService.on('peer-reconnecting', handlePeerReconnecting);
    socketService.on('peer-reconnected', handlePeerReconnected);

    // 4. Listen for final peer disconnect
    const handlePeerDisconnect = (data) => {
      fileTransferService.clearQueue();
      setPeerReconnecting(false);
      Alert.alert(
        data?.intentional ? 'Peer Left Session' : 'Session Ended',
        data?.message || 'The connected peer has left the session.',
        [{ text: 'OK', onPress: onDisconnect }]
      );
    };

    socketService.on('peer-disconnected', handlePeerDisconnect);

    return () => {
      unsubscribe();
      fileTransferService.clearQueue();
      socketService.off('receive-message', handleReceiveMessage);
      socketService.off('peer-reconnecting', handlePeerReconnecting);
      socketService.off('peer-reconnected', handlePeerReconnected);
      socketService.off('peer-disconnected', handlePeerDisconnect);
    };
  }, []);

  // Handlers for picking and sharing media (supports multiple items in queue)
  const handleSendDocument = async () => {
    if (isPicking) return;
    try {
      setIsPicking(true);
      await fileTransferService.pickAndSendDocument(roomCode);
    } catch (err) {
      if (err.message) Alert.alert('Transfer Error', err.message);
    } finally {
      setIsPicking(false);
    }
  };

  const handleSendImage = async () => {
    if (isPicking) return;
    try {
      setIsPicking(true);
      await fileTransferService.pickAndSendImage(roomCode);
    } catch (err) {
      if (err.message) Alert.alert('Transfer Error', err.message);
    } finally {
      setIsPicking(false);
    }
  };

  const handleCaptureCamera = async () => {
    if (isPicking) return;
    try {
      setIsPicking(true);
      await fileTransferService.captureAndSendCamera(roomCode);
    } catch (err) {
      if (err.message) Alert.alert('Camera Error', err.message);
    } finally {
      setIsPicking(false);
    }
  };

  const handleSendVideo = async () => {
    if (isPicking) return;
    try {
      setIsPicking(true);
      await fileTransferService.pickAndSendVideo(roomCode);
    } catch (err) {
      if (err.message) Alert.alert('Transfer Error', err.message);
    } finally {
      setIsPicking(false);
    }
  };

  const handleSendTextMessage = (text) => {
    socketService.sendMessage({ text, roomCode });
    const localTextItem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'text',
      text,
      sender: 'You',
      timestamp: Date.now(),
      direction: 'outgoing',
      status: 'completed',
    };
    setTransfers((prev) => [localTextItem, ...prev]);
  };

  return (
    <View style={styles.container}>
      {/* Session Info Banner */}
      <View style={styles.sessionBanner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerCodeLabel}>
            {peerName ? `CONNECTED WITH ${peerName.toUpperCase()}` : 'ACTIVE SESSION'}
          </Text>
          <Text style={styles.bannerCode}>Room #{roomCode}</Text>
        </View>
        <View style={styles.bannerRight}>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Live P2P</Text>
          </View>
          <Text style={styles.roleText}>
            {role === 'sender' ? 'Sender (Host)' : 'Receiver'}
          </Text>
        </View>
      </View>

      {/* Temporary Reconnecting Notice Banner */}
      {peerReconnecting && (
        <View style={styles.reconnectingBanner}>
          <ActivityIndicator size="small" color="#FBBF24" />
          <Text style={styles.reconnectingText}>
            Peer connection interrupted. Waiting for peer to reconnect...
          </Text>
        </View>
      )}

      {/* Transfer Queue Info Banner */}
      {queuedCount > 0 && (
        <View style={styles.queueBanner}>
          <Layers size={15} color="#38BDF8" />
          <Text style={styles.queueBannerText}>
            Queue: {queuedCount} file{queuedCount > 1 ? 's' : ''} waiting to transfer...
          </Text>
        </View>
      )}

      {/* Main Content / Transfer Feed */}
      {transfers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <ArrowLeftRight size={36} color="#38BDF8" />
          </View>
          <Text style={styles.emptyTitle}>Connected & Ready!</Text>
          <Text style={styles.emptySubtitle}>
            Choose an option from the bar below to send files, photos, videos, or quick messages directly to this device.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transfers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TransferCard item={item} />}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, isPicking && styles.actionBtnDisabled]}
          disabled={isPicking}
          onPress={handleSendDocument}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
            <FileText size={20} color="#38BDF8" />
          </View>
          <Text style={styles.actionLabel}>File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isPicking && styles.actionBtnDisabled]}
          disabled={isPicking}
          onPress={handleSendImage}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
            <Image size={20} color="#A855F7" />
          </View>
          <Text style={styles.actionLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isPicking && styles.actionBtnDisabled]}
          disabled={isPicking}
          onPress={handleCaptureCamera}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Camera size={20} color="#F59E0B" />
          </View>
          <Text style={styles.actionLabel}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isPicking && styles.actionBtnDisabled]}
          disabled={isPicking}
          onPress={handleSendVideo}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
            <Video size={20} color="#EC4899" />
          </View>
          <Text style={styles.actionLabel}>Video</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setTextModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
            <MessageSquare size={20} color="#22C55E" />
          </View>
          <Text style={styles.actionLabel}>Text</Text>
        </TouchableOpacity>
      </View>

      {/* Text Message Modal */}
      <TextMessageModal
        visible={textModalVisible}
        onClose={() => setTextModalVisible(false)}
        onSend={handleSendTextMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  sessionBanner: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  bannerLeft: {
    flex: 1,
  },
  bannerCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  bannerCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#38BDF8',
    marginTop: 2,
  },
  bannerRight: {
    alignItems: 'flex-end',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  activeText: {
    fontSize: 11,
    color: '#4ADE80',
    fontWeight: '700',
  },
  roleText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 90,
  },
  actionBar: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  actionBtn: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  reconnectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  reconnectingText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderBottomWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 8,
  },
  queueBannerText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
