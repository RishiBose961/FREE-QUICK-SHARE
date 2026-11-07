import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Header({
  title = 'QuickShare',
  subtitle,
  isConnected,
  roomCode,
  onDisconnect,
  onOpenSettings,
}) {
  return (
    <View style={styles.container}>
      {/* Brand / Title Section */}
      <View style={styles.left}>
        <View style={styles.brandIconBox}>
          <Ionicons name="flash" size={18} color="#38BDF8" />
        </View>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* Action Badges & Settings */}
      <View style={styles.right}>
        {/* Server status pill */}
        <TouchableOpacity
          style={[styles.statusPill, isConnected ? styles.connectedPill : styles.disconnectedPill]}
          onPress={onOpenSettings}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isConnected ? 'wifi' : 'cloud-offline-outline'}
            size={13}
            color={isConnected ? '#22C55E' : '#EF4444'}
          />
          <Text style={[styles.statusText, isConnected ? styles.connectedText : styles.disconnectedText]}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>

        {/* Settings button */}
        {onOpenSettings && !roomCode && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Room Disconnect / Leave button */}
        {roomCode && onDisconnect ? (
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={onDisconnect}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={15} color="#F87171" />
            <Text style={styles.disconnectText}>Exit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  connectedPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  disconnectedPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  connectedText: {
    color: '#4ADE80',
  },
  disconnectedText: {
    color: '#F87171',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  disconnectText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
  },
});
