import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fileTransferService } from '../services/fileTransferService';
import VideoPlayerModal from './VideoPlayerModal';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function TransferCard({ item }) {
  const [videoModalVisible, setVideoModalVisible] = useState(false);

  const isImage = item.type === 'image';
  const isVideo = item.type === 'video';
  const isText = item.type === 'text';
  const isIncoming = item.direction === 'incoming';
  const isCompleted = item.status === 'completed';

  const handleShare = async () => {
    if (item.localUri) {
      try {
        await fileTransferService.shareOrOpenFile(item.localUri, item.name, item.mimeType);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Text message bubble
  if (isText) {
    return (
      <View
        style={[
          styles.textMessageContainer,
          isIncoming ? styles.textIncoming : styles.textOutgoing,
        ]}
      >
        <View style={styles.textHeaderRow}>
          <Ionicons
            name={isIncoming ? 'chatbubble-ellipses-outline' : 'paper-plane-outline'}
            size={12}
            color={isIncoming ? '#94A3B8' : '#7DD3FC'}
          />
          <Text style={[styles.textSender, isIncoming ? styles.textSenderIncoming : styles.textSenderOutgoing]}>
            {isIncoming ? (item.sender || 'Peer') : 'You'}
          </Text>
        </View>
        <Text style={styles.textContent}>{item.text}</Text>
        <Text style={styles.textTime}>
          {new Date(item.timestamp || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  const previewUri = item.dataUri || item.localUri;

  const renderFileIcon = () => {
    if (isImage && previewUri) {
      return <Image source={{ uri: previewUri }} style={styles.thumbnail} />;
    }
    if (isVideo) {
      return (
        <View style={styles.videoIconWrapper}>
          <Ionicons name="videocam" size={24} color="#EC4899" />
          {isCompleted && (
            <View style={styles.playBadgeSmall}>
              <Ionicons name="play" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
      );
    }
    if (isImage) {
      return <Ionicons name="image" size={24} color="#A855F7" />;
    }
    return <Ionicons name="document-text" size={24} color="#38BDF8" />;
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {/* Thumbnail or Icon */}
        <TouchableOpacity
          style={styles.iconContainer}
          disabled={!isCompleted || !isVideo}
          onPress={() => {
            if (isVideo) setVideoModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          {renderFileIcon()}
        </TouchableOpacity>

        {/* File Details */}
        <View style={styles.details}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name || 'Shared File'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.fileSize}>{formatBytes(item.size)}</Text>
            <View style={styles.dot} />
            <Ionicons
              name={isIncoming ? 'arrow-down' : 'arrow-up'}
              size={11}
              color={isIncoming ? '#38BDF8' : '#A855F7'}
            />
            <Text style={[styles.directionText, isIncoming ? styles.incomingText : styles.outgoingText]}>
              {isIncoming ? 'Received' : 'Sent'}
            </Text>
          </View>
        </View>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            isCompleted
              ? styles.statusCompleted
              : item.status === 'failed'
              ? styles.statusFailed
              : styles.statusTransferring,
          ]}
        >
          {isCompleted ? (
            <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
          ) : item.status === 'failed' ? (
            <Ionicons name="alert-circle" size={13} color="#EF4444" />
          ) : null}
          <Text
            style={[
              styles.statusText,
              isCompleted
                ? styles.statusTextCompleted
                : item.status === 'failed'
                ? styles.statusTextFailed
                : styles.statusTextTransferring,
            ]}
          >
            {isCompleted ? 'Done' : item.status === 'failed' ? 'Failed' : `${item.progress || 0}%`}
          </Text>
        </View>
      </View>

      {/* Progress Bar (during transfer) */}
      {!isCompleted && item.status !== 'failed' && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${item.progress || 0}%` }]} />
        </View>
      )}

      {/* Action buttons if completed and file is available */}
      {isCompleted && item.localUri && (
        <View style={isVideo ? styles.videoActionRow : null}>
          {isVideo && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.playVideoBtn]}
              onPress={() => setVideoModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle" size={16} color="#FFFFFF" />
              <Text style={styles.playVideoBtnText}>
                {Platform.OS === 'web' ? 'Watch Video' : 'Play Video'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, isVideo ? styles.shareVideoBtn : styles.shareFullBtn]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons
              name={Platform.OS === 'web' ? 'download-outline' : 'share-social-outline'}
              size={15}
              color={isVideo ? '#94A3B8' : '#38BDF8'}
            />
            <Text style={[styles.shareBtnText, isVideo && styles.shareVideoText]}>
              {Platform.OS === 'web'
                ? isVideo
                  ? 'Download'
                  : `Save File`
                : isImage
                ? 'Save / Share'
                : isVideo
                ? 'Save / Share'
                : 'Open / Share'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dedicated Video Player Modal */}
      {isVideo && (
        <VideoPlayerModal
          visible={videoModalVisible}
          item={item}
          onClose={() => setVideoModalVisible(false)}
          onShare={handleShare}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
  },
  videoIconWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadgeSmall: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#EC4899',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: {
    flex: 1,
    marginRight: 10,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fileSize: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748B',
  },
  directionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  incomingText: {
    color: '#38BDF8',
  },
  outgoingText: {
    color: '#C084FC',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  statusTransferring: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  statusFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextCompleted: {
    color: '#4ADE80',
  },
  statusTextTransferring: {
    color: '#38BDF8',
  },
  statusTextFailed: {
    color: '#F87171',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
  },
  videoActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  shareFullBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginTop: 10,
  },
  playVideoBtn: {
    flex: 1.2,
    backgroundColor: '#EC4899',
  },
  playVideoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  shareVideoBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  shareBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 12,
  },
  shareVideoText: {
    color: '#CBD5E1',
  },
  // Text message bubbles
  textMessageContainer: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  textIncoming: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  textOutgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#0369A1',
    borderBottomRightRadius: 4,
  },
  textHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  textSender: {
    fontSize: 11,
    fontWeight: '700',
  },
  textSenderIncoming: {
    color: '#94A3B8',
  },
  textSenderOutgoing: {
    color: '#E0F2FE',
  },
  textContent: {
    fontSize: 14,
    color: '#F8FAFC',
    lineHeight: 19,
  },
  textTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
});
