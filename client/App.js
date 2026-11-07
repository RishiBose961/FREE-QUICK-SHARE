import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, Platform, Alert } from 'react-native';
import Header from './src/components/Header';
import ServerUrlModal from './src/components/ServerUrlModal';
import IncomingConnectionModal from './src/components/IncomingConnectionModal';
import HomeScreen from './src/screens/HomeScreen';
import SenderScreen from './src/screens/SenderScreen';
import ReceiverScreen from './src/screens/ReceiverScreen';
import TransferScreen from './src/screens/TransferScreen';
import { socketService } from './src/services/socketService';
import { deviceService } from './src/services/deviceService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' | 'sender' | 'receiver' | 'transfer'
  const [roomCode, setRoomCode] = useState(null);
  const [role, setRole] = useState(null); // 'sender' | 'receiver'
  const [peerName, setPeerName] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:4000');

  // Device identity and permanent room state (MongoDB + local storage)
  const [deviceProfile, setDeviceProfile] = useState(null);
  const [onlineDevices, setOnlineDevices] = useState([]);
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);
  const [isConnectingDirect, setIsConnectingDirect] = useState(false);
  const [connectingTargetId, setConnectingTargetId] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);

  // Initialize device identity and socket listeners
  useEffect(() => {
    let isMounted = true;

    async function bootstrapDevice() {
      try {
        const profile = await deviceService.init();
        if (isMounted) {
          setDeviceProfile(profile);
          const activeUrl = profile.serverUrl || 'http://localhost:4000';
          console.log('[App] Loaded saved server URL on startup:', activeUrl);
          setServerUrl(activeUrl);
          socketService.setServerUrl(activeUrl);
          socketService.connect();
          socketService.registerDevice(profile).catch((err) => {
            console.warn('[App] Device registration pending connect:', err.message);
          });
        }
      } catch (err) {
        console.warn('[App] Device bootstrap error:', err.message);
        socketService.connect();
      }
    }

    bootstrapDevice();

    // Listen to connection status
    const unsubConnection = socketService.onInternal('connection-status', ({ connected }) => {
      setIsConnected(connected);
      if (connected) {
        // Re-fetch online devices on connect
        socketService.getOnlineDevices().then((devices) => {
          if (isMounted && Array.isArray(devices)) {
            setOnlineDevices(devices);
          }
        });
      }
    });

    // Listen for device profile updates (e.g. permanent room code assigned by server/MongoDB)
    const unsubDeviceRegistered = socketService.onInternal('device-registered', (registered) => {
      if (isMounted && registered) {
        setDeviceProfile((prev) => ({ ...prev, ...registered }));
        deviceService.updateProfile(registered);
      }
    });

    // Listen for broadcast list of online peers
    const handleOnlineDevicesUpdated = (data) => {
      if (isMounted && data && Array.isArray(data.devices)) {
        setOnlineDevices(data.devices);
      }
    };
    socketService.on('online-devices-updated', handleOnlineDevicesUpdated);

    // Listen for incoming direct connect requests from other devices
    const handleIncomingDirectRequest = (requestData) => {
      console.log('📲 [App] Incoming direct connect request from:', requestData.fromDeviceName);
      if (isMounted) {
        setIncomingRequest(requestData);
      }
    };
    socketService.on('incoming-direct-connect-request', handleIncomingDirectRequest);

    // Listen for direct connect rejection
    const handleDirectConnectRejected = (data) => {
      if (isMounted) {
        setIsConnectingDirect(false);
        setConnectingTargetId(null);
        Alert.alert(
          'Request Declined',
          data.message || 'The other device declined the connection request.'
        );
      }
    };
    socketService.on('direct-connect-rejected', handleDirectConnectRejected);

    // Listen for cancellation from requester
    const handleDirectConnectCancelled = (data) => {
      if (isMounted) {
        setIncomingRequest((current) => {
          if (current && current.fromDeviceId === data?.fromDeviceId) {
            return null;
          }
          return current;
        });
      }
    };
    socketService.on('direct-connect-cancelled', handleDirectConnectCancelled);

    // Listen for direct connect failure
    const handleDirectConnectFailed = (data) => {
      if (isMounted) {
        setIsConnectingDirect(false);
        setConnectingTargetId(null);
        Alert.alert('Connection Failed', data.message || 'Unable to establish direct connection.');
      }
    };
    socketService.on('direct-connect-failed', handleDirectConnectFailed);

    // Global connection-ready handler (for direct connect or manual pin pairing)
    const handleConnectionReady = (data) => {
      console.log('🤝 [App] Session established in room:', data.roomCode, 'Role:', data.role, 'Peer:', data.peerName);
      if (isMounted) {
        setIsConnectingDirect(false);
        setConnectingTargetId(null);
        setIncomingRequest(null);
        setRoomCode(data.roomCode);
        setRole(data.role || 'receiver');
        setPeerName(data.peerName || null);

        // Update latest paired device (only 1 item, no history)
        if (data.peerName) {
          const latest = [
            {
              deviceId: data.peerDeviceId || data.roomCode,
              deviceName: data.peerName,
              permanentRoomCode: data.roomCode,
              pairedAt: new Date().toISOString(),
            },
          ];
          setDeviceProfile((prev) => ({ ...prev, pairedDevices: latest }));
          deviceService.updateProfile({ pairedDevices: latest }).catch(() => {});
        }

        setCurrentScreen('transfer');
      }
    };
    socketService.on('connection-ready', handleConnectionReady);

    return () => {
      isMounted = false;
      unsubConnection();
      unsubDeviceRegistered();
      socketService.off('online-devices-updated', handleOnlineDevicesUpdated);
      socketService.off('incoming-direct-connect-request', handleIncomingDirectRequest);
      socketService.off('direct-connect-rejected', handleDirectConnectRejected);
      socketService.off('direct-connect-failed', handleDirectConnectFailed);
      socketService.off('connection-ready', handleConnectionReady);
      socketService.disconnect();
    };
  }, []);

  const handleSelectRole = (selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'sender') {
      setCurrentScreen('sender');
    } else {
      setCurrentScreen('receiver');
    }
  };

  const handleConnected = (code, connectedRole) => {
    setRoomCode(code);
    setRole(connectedRole);
    setCurrentScreen('transfer');
  };

  const handleDisconnect = () => {
    socketService.leaveRoom();
    setRoomCode(null);
    setRole(null);
    setPeerName(null);
    setIsConnectingDirect(false);
    setConnectingTargetId(null);
    setIncomingRequest(null);
    setCurrentScreen('home');
  };

  const handleSaveServerUrl = async (newUrl) => {
    setServerUrl(newUrl);
    socketService.setServerUrl(newUrl);
    await deviceService.setServerUrl(newUrl);
  };

  // 1-Tap Direct Connection to a peer
  const handleDirectConnect = async (targetDevice) => {
    if (!isConnected) {
      Alert.alert(
        'Server Disconnected',
        'Please check your relay server connection before connecting to a device.'
      );
      return;
    }

    try {
      setIsConnectingDirect(true);
      setConnectingTargetId(targetDevice.deviceId);

      await socketService.directConnect({
        fromDeviceId: deviceProfile?.deviceId,
        fromDeviceName: deviceProfile?.deviceName,
        targetDeviceId: targetDevice.deviceId,
        targetRoomCode: targetDevice.permanentRoomCode,
      });

      // Keep connecting state active while waiting for target device to accept
    } catch (err) {
      setIsConnectingDirect(false);
      setConnectingTargetId(null);
      Alert.alert(
        'Connection Error',
        err.message || 'Could not send direct connection request.'
      );
    }
  };

  // Cancel direct connection request
  const handleCancelDirectConnect = (targetDeviceId) => {
    socketService.cancelDirectConnect({
      fromDeviceId: deviceProfile?.deviceId,
      targetDeviceId: targetDeviceId || connectingTargetId,
    });
    setIsConnectingDirect(false);
    setConnectingTargetId(null);
  };

  // Accept incoming connection request
  const handleAcceptIncoming = () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    socketService.respondDirectConnect({
      fromDeviceId: req.fromDeviceId,
      targetDeviceId: req.targetDeviceId || deviceProfile?.deviceId,
      accepted: true,
      roomCode: req.roomCode,
    });
  };

  // Decline incoming connection request
  const handleDeclineIncoming = () => {
    if (!incomingRequest) return;
    const req = incomingRequest;
    setIncomingRequest(null);

    socketService.respondDirectConnect({
      fromDeviceId: req.fromDeviceId,
      targetDeviceId: req.targetDeviceId || deviceProfile?.deviceId,
      accepted: false,
      roomCode: req.roomCode,
    });
  };

  // Update device name in local storage & MongoDB
  const handleUpdateDeviceName = async (newName) => {
    try {
      await deviceService.setDeviceName(newName);
      setDeviceProfile((prev) => ({ ...prev, deviceName: newName }));
      await socketService.registerDevice({
        deviceId: deviceProfile?.deviceId,
        deviceName: newName,
      });
    } catch (err) {
      console.warn('[App] Update device name warning:', err.message);
    }
  };

  // Refresh online devices
  const handleRefreshDevices = async () => {
    if (!isConnected) return;
    try {
      setIsRefreshingDevices(true);
      const devices = await socketService.getOnlineDevices(deviceProfile?.deviceId);
      if (Array.isArray(devices)) {
        setOnlineDevices(devices);
      }
    } catch (err) {
      console.warn('[App] Refresh devices error:', err.message);
    } finally {
      setIsRefreshingDevices(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.container}>
        {/* Universal Top Header */}
        <Header
          title={
            currentScreen === 'transfer'
              ? 'Active Session'
              : currentScreen === 'sender'
              ? 'Send Files'
              : currentScreen === 'receiver'
              ? 'Receive Files'
              : 'QuickShare'
          }
          subtitle={
            currentScreen === 'transfer'
              ? (peerName ? `${peerName} • #${roomCode}` : `Room #${roomCode}`)
              : currentScreen === 'home'
              ? `${serverUrl}`
              : undefined
          }
          isConnected={isConnected}
          roomCode={currentScreen === 'transfer' ? roomCode : null}
          onDisconnect={handleDisconnect}
          onOpenSettings={() => setServerModalVisible(true)}
        />

        {/* Screen Content */}
        <View style={styles.content}>
          {currentScreen === 'home' && (
            <HomeScreen
              onSelectRole={handleSelectRole}
              onOpenSettings={() => setServerModalVisible(true)}
              isConnected={isConnected}
              deviceProfile={deviceProfile}
              onUpdateDeviceName={handleUpdateDeviceName}
              onDirectConnect={handleDirectConnect}
              onCancelDirectConnect={handleCancelDirectConnect}
              isConnectingDirect={isConnectingDirect}
              connectingTargetId={connectingTargetId}
              onlineDevices={onlineDevices}
              serverUrl={serverUrl}
              onRefreshDevices={handleRefreshDevices}
              isRefreshingDevices={isRefreshingDevices}
            />
          )}

          {currentScreen === 'sender' && (
            <SenderScreen
              onCancel={handleDisconnect}
              onConnected={(code) => handleConnected(code, 'sender')}
            />
          )}

          {currentScreen === 'receiver' && (
            <ReceiverScreen
              onCancel={handleDisconnect}
              onConnected={(code) => handleConnected(code, 'receiver')}
            />
          )}

          {currentScreen === 'transfer' && (
            <TransferScreen
              roomCode={roomCode}
              role={role}
              onDisconnect={handleDisconnect}
            />
          )}
        </View>

        {/* Incoming Connection Request Modal */}
        <IncomingConnectionModal
          visible={!!incomingRequest}
          request={incomingRequest}
          onAccept={handleAcceptIncoming}
          onDecline={handleDeclineIncoming}
        />

        {/* Server URL Settings Modal */}
        <ServerUrlModal
          visible={serverModalVisible}
          currentUrl={serverUrl}
          onClose={() => setServerModalVisible(false)}
          onSave={handleSaveServerUrl}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
});
