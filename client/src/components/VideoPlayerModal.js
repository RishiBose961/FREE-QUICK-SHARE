import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function VideoPlayerModal({ visible, item, onClose, onShare }) {
  if (!item) return null;

  const videoUri = item.localUri || item.dataUri;
  const isWeb = Platform.OS === 'web';

  const handlePlayNative = () => {
    if (onShare) {
      onShare();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.videoIconCircle}>
                <Ionicons name="videocam" size={20} color="#EC4899" />
              </View>
              <View style={styles.titleColumn}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.name || 'Video Player'}
                </Text>
                <Text style={styles.subtitle}>
                  {formatBytes(item.size)} • {item.mimeType || 'video/mp4'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Video Player Display */}
          <View style={styles.playerContainer}>
            {isWeb && videoUri ? (
              React.createElement('video', {
                src: videoUri,
                controls: true,
                autoPlay: true,
                playsInline: true,
                style: {
                  width: '100%',
                  maxHeight: 380,
                  borderRadius: 12,
                  backgroundColor: '#000',
                  outline: 'none',
                },
              })
            ) : (
              <View style={styles.nativePreviewBox}>
                <View style={styles.playIconCircle}>
                  <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.nativePromptTitle}>Ready to Play Video</Text>
                <Text style={styles.nativePromptDesc}>
                  Launch in your device's native player (Gallery, VLC, Google Photos, or system player)
                </Text>

                <TouchableOpacity
                  style={styles.primaryPlayBtn}
                  onPress={handlePlayNative}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryPlayBtnText}>Open in Video Player</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onShare} activeOpacity={0.7}>
              <Ionicons
                name={isWeb ? 'download-outline' : 'share-social-outline'}
                size={16}
                color="#38BDF8"
              />
              <Text style={styles.secondaryBtnText}>
                {isWeb ? 'Download Video' : 'Share / Save Video'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Close</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  videoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  playerContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  nativePreviewBox: {
    padding: 24,
    alignItems: 'center',
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EC4899',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  nativePromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  nativePromptDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  primaryPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryPlayBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 11,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  doneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  doneBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
});
