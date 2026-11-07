import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import EditDeviceNameModal from '../components/EditDeviceNameModal';

export default function HomeScreen({
  onSelectRole,
  onOpenSettings,
  isConnected,
  serverUrl,
  deviceProfile,
  onUpdateDeviceName,
  onDirectConnect,
  onCancelDirectConnect,
  isConnectingDirect,
  connectingTargetId,
  onlineDevices = [],
  onRefreshDevices,
  isRefreshingDevices,
}) {
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const getDeviceIcon = (name = '') => {
    const lower = name.toLowerCase();
    if (
      lower.includes('pc') ||
      lower.includes('windows') ||
      lower.includes('laptop') ||
      lower.includes('mac') ||
      lower.includes('linux') ||
      lower.includes('computer')
    ) {
      return <MaterialCommunityIcons name="laptop" size={24} color="#38BDF8" />;
    }
    if (
      lower.includes('iphone') ||
      lower.includes('android') ||
      lower.includes('phone') ||
      lower.includes('galaxy') ||
      lower.includes('pixel')
    ) {
      return <Ionicons name="phone-portrait-outline" size={24} color="#38BDF8" />;
    }
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return <Ionicons name="tablet-portrait-outline" size={24} color="#38BDF8" />;
    }
    return Platform.OS === 'web' ? (
      <MaterialCommunityIcons name="laptop" size={24} color="#38BDF8" />
    ) : (
      <Ionicons name="phone-portrait-outline" size={24} color="#38BDF8" />
    );
  };

  const handleCopy = async () => {
    if (deviceProfile?.permanentRoomCode) {
      try {
        await Clipboard.setStringAsync(deviceProfile.permanentRoomCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch (_) {}
    }
  };

  const latestPaired = deviceProfile?.pairedDevices?.[0];

  const otherDevices = (onlineDevices || [])
    .filter((dev) => dev.deviceId !== deviceProfile?.deviceId)
    .sort((a, b) => {
      const aIsPaired = latestPaired && a.deviceId === latestPaired.deviceId;
      const bIsPaired = latestPaired && b.deviceId === latestPaired.deviceId;
      if (aIsPaired && !bIsPaired) return -1;
      if (!aIsPaired && bIsPaired) return 1;
      return 0;
    });

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. Device Profile & Permanent Room Box */}
      <View style={styles.profileCard}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.avatarBox}>
            {getDeviceIcon(deviceProfile?.deviceName)}
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.deviceNameRow}>
              <Text style={styles.deviceName} numberOfLines={1}>
                {deviceProfile?.deviceName || 'My Device'}
              </Text>
              <TouchableOpacity
                onPress={() => setEditNameVisible(true)}
                style={styles.editBtn}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={12} color="#38BDF8" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.networkStatusRow}>
              <View
                style={[
                  styles.statusDotSmall,
                  { backgroundColor: isConnected ? '#22C55E' : '#EF4444' },
                ]}
              />
              <Text style={styles.profileSubtext} numberOfLines={1}>
                {isConnected
                  ? `Online • ${serverUrl || 'Connected'}`
                  : `Offline (${serverUrl || 'localhost:4000'}) • Tap to configure`}
              </Text>
            </View>
          </View>
        </View>

        {/* Permanent Room Code Showcase */}
        <View style={styles.permanentRoomBox}>
          <View style={styles.permanentRoomLeft}>
            <View style={styles.roomTagRow}>
              <Text style={styles.permanentRoomLabel}>YOUR PERMANENT ROOM</Text>
              <View style={styles.permanentBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#22C55E" />
              </View>
            </View>
            <Text style={styles.permanentRoomCode}>
              {deviceProfile?.permanentRoomCode ? `#${deviceProfile.permanentRoomCode}` : '----'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.copyBtn, copiedCode && styles.copyBtnSuccess]}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Ionicons
              name={copiedCode ? 'checkmark-circle' : 'copy-outline'}
              size={15}
              color={copiedCode ? '#22C55E' : '#38BDF8'}
            />
          
          </TouchableOpacity>
        </View>

        <View style={styles.roomExplainerRow}>
          <Ionicons name="information-circle-outline" size={14} color="#64748B" />
          <Text style={styles.permanentRoomDesc}>
            This 4-digit code never changes. Friends or your own devices can connect to you anytime!
          </Text>
        </View>
      </View>

      {/* 2. Direct Connect: Online Devices Section */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionBadge}>
            <Ionicons name="radio-outline" size={14} color="#38BDF8" />
            <Text style={styles.sectionTitle}>ONLINE DEVICES (1-TAP CONNECT)</Text>
          </View>
          {isRefreshingDevices ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <TouchableOpacity
              onPress={onRefreshDevices}
              style={styles.refreshBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={13} color="#38BDF8" />
              <Text style={styles.refreshBtnText}>Scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {otherDevices.length > 0 ? (
        <View style={styles.deviceListContainer}>
          {otherDevices.map((target) => {
            const isConnectingThis = isConnectingDirect && connectingTargetId === target.deviceId;
            const isLatestPaired = latestPaired && latestPaired.deviceId === target.deviceId;
            return (
              <View
                key={target.deviceId}
                style={[styles.peerCard, isLatestPaired && styles.peerCardPaired]}
              >
                <View style={styles.peerIconWrapper}>
                  {getDeviceIcon(target.deviceName)}
                </View>
                <View style={styles.peerContent}>
                  <View style={styles.peerTitleRow}>
                    <Text style={styles.peerName} numberOfLines={1}>
                      {target.deviceName}
                    </Text>
                    {isLatestPaired && (
                      <View style={styles.pairedBadge}>
                        <Ionicons name="star" size={9} color="#FBBF24" />
                      </View>
                    )}
                  </View>
                  <View style={styles.peerMetaRow}>
                    <View style={styles.peerStatusDot} />
                    <Text style={styles.peerRoomText}>
                      Room #{target.permanentRoomCode} • Ready
                    </Text>
                  </View>
                </View>
                {isConnectingThis ? (
                  <TouchableOpacity
                    style={styles.directConnectCancelBtn}
                    onPress={() => onCancelDirectConnect && onCancelDirectConnect(target.deviceId)}
                    activeOpacity={0.7}
                  >
                    <ActivityIndicator size="small" color="#F87171" style={{ marginRight: 2 }} />
                    <Text style={styles.directConnectCancelText}>Cancel ✕</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.directConnectBtn}
                    onPress={() => onDirectConnect(target)}
                    disabled={isConnectingDirect}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash" size={13} color="#0F172A" />
                    <Text style={styles.directConnectBtnText}>Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyPeersBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="wifi-outline" size={26} color="#64748B" />
          </View>
          <Text style={styles.emptyPeersTitle}>Looking for nearby devices...</Text>
          <Text style={styles.emptyPeersDesc}>
            Open QuickShare on another phone, tablet, or PC on this network. They will appear here automatically for 1-tap connection!
          </Text>
        </View>
      )}

      {/* 3. Manual 4-Digit Room Selection */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBadge}>
          <Ionicons name="keypad-outline" size={14} color="#94A3B8" />
          <Text style={[styles.sectionTitle, { color: '#94A3B8' }]}>OR CONNECT WITH A PIN</Text>
        </View>
      </View>

      <View style={styles.cardsContainer}>
        {/* Send Option */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => onSelectRole('sender')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrapper, styles.sendIcon]}>
            <Ionicons name="arrow-up-circle" size={28} color="#38BDF8" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Send Files</Text>
            <Text style={styles.cardDesc}>
              Generate a temporary 4-digit room code for receiver to join.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>

        {/* Receive Option */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => onSelectRole('receiver')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconWrapper, styles.receiveIcon]}>
            <Ionicons name="arrow-down-circle" size={28} color="#C084FC" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Receive Files</Text>
            <Text style={styles.cardDesc}>
              Enter any 4-digit code or permanent room number to connect.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* 5. Connection info bar */}
      <TouchableOpacity
        style={styles.serverBar}
        onPress={onOpenSettings}
        activeOpacity={0.7}
      >
        <View style={styles.serverBarLeft}>
          <View
            style={[
              styles.dot,
              isConnected ? { backgroundColor: '#22C55E' } : { backgroundColor: '#EF4444' },
            ]}
          />
          <View style={styles.serverBarTextCol}>
            <Text style={styles.serverBarHost} numberOfLines={1}>
              {serverUrl || 'http://localhost:4000'}
            </Text>
            <Text style={styles.serverBarStatus}>
              {isConnected ? 'Relay Server Active & Connected' : 'Server Disconnected • Tap to configure IP'}
            </Text>
          </View>
        </View>
        <View style={styles.configurePill}>
          <Ionicons name="options-outline" size={12} color="#38BDF8" />
          <Text style={styles.serverBarAction}>Configure</Text>
        </View>
      </TouchableOpacity>

      {/* Edit Device Name Modal */}
      <EditDeviceNameModal
        visible={editNameVisible}
        currentName={deviceProfile?.deviceName}
        onClose={() => setEditNameVisible(false)}
        onSave={(name) => {
          if (onUpdateDeviceName) onUpdateDeviceName(name);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
    paddingBottom: 28,
  },
  // Profile Card
  profileCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: '#334155',
    marginLeft: 8,
  },
  editBtnText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  networkStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  profileSubtext: {
    fontSize: 11,
    color: '#94A3B8',
  },
  permanentRoomBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  permanentRoomLeft: {
    flex: 1,
  },
  roomTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permanentRoomLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  permanentRoomCode: {
    fontSize: 24,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 2,
    marginTop: 2,
  },
  permanentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  permanentBadgeText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  copyBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  copyBtnTextSuccess: {
    color: '#4ADE80',
  },
  roomExplainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  permanentRoomDesc: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
  // Section Headers
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  refreshBtnText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  // Online Device Peer Cards
  deviceListContainer: {
    gap: 10,
    marginBottom: 20,
  },
  peerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  peerCardPaired: {
    borderColor: 'rgba(251, 191, 36, 0.4)',
    backgroundColor: '#1F2937',
  },
  peerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  pairedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  pairedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
  },
  peerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  peerContent: {
    flex: 1,
  },
  peerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  peerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  peerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  peerRoomText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  directConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 80,
    justifyContent: 'center',
  },
  directConnectBtnDisabled: {
    opacity: 0.7,
  },
  directConnectBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 12,
  },
  directConnectCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    justifyContent: 'center',
  },
  directConnectCancelText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 11,
  },
  emptyPeersBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyPeersTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 4,
  },
  emptyPeersDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 10,
  },
  // Manual PIN Cards
  cardsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sendIcon: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  receiveIcon: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  // Supported Transfers
  supportedSection: {
    marginBottom: 16,
  },
  supportedTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  // Server Status Bar
  serverBar: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  serverBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  serverBarTextCol: {
    flex: 1,
  },
  serverBarHost: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  serverBarStatus: {
    fontSize: 10,
    color: '#94A3B8',
  },
  configurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serverBarAction: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
});
