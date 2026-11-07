import { io } from 'socket.io-client';

function getDefaultServerUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  }
  return 'http://localhost:4000';
}

class SocketService {
  constructor() {
    this.socket = null;
    this.serverUrl = getDefaultServerUrl(); // Default fallback or current browser host
    this.isConnected = false;
    this.internalListeners = new Map();
    this.socketEventListeners = new Map(); // eventName -> Set<Function>
    this.currentRoomCode = null;
    this.deviceProfile = null; // { deviceId, deviceName, permanentRoomCode }
  }

  setServerUrl(url) {
    if (!url) return;
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    // If URL is identical and socket already exists, avoid dropping existing session
    if (this.serverUrl === cleanUrl && this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }
    this.serverUrl = cleanUrl;
    this.disconnect();
    this.connect();
  }

  setCurrentRoom(roomCode) {
    this.currentRoomCode = roomCode;
  }

  connect() {
    if (this.socket) {
      if (this.socket.connected) {
        return this.socket;
      }
      // If socket instance already created and active, trigger connect
      this.socket.connect();
      return this.socket;
    }

    console.log(`[Socket] Connecting to ${this.serverUrl}...`);
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 30,
      timeout: 15000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log(`[Socket] Connected to server, ID: ${this.socket.id}`);
      this.isConnected = true;
      this.emitInternal('connection-status', { connected: true, socketId: this.socket.id });

      // If we were in a room, re-join on reconnect
      if (this.currentRoomCode) {
        console.log(`[Socket] Re-joining room: ${this.currentRoomCode}`);
        this.socket.emit('rejoin-room', { roomCode: this.currentRoomCode });
      }

      // Re-register device profile with MongoDB / server if we have one
      if (this.deviceProfile) {
        console.log(`[Socket] Re-registering device profile:`, this.deviceProfile.deviceName);
        this.socket.emit(
          'register-device',
          {
            deviceId: this.deviceProfile.deviceId,
            deviceName: this.deviceProfile.deviceName,
          },
          (res) => {
            if (res && res.success && res.device) {
              this.deviceProfile = { ...this.deviceProfile, ...res.device };
              this.emitInternal('device-registered', this.deviceProfile);
            }
          }
        );
      }

      // Re-attach all registered listeners to this new socket instance
      this.rebindAllSocketListeners();
    });

    this.socket.on('connect_error', (error) => {
      console.warn(`[Socket] Connect error:`, error.message);
      this.isConnected = false;
      this.emitInternal('connection-status', { connected: false, error: error.message });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected:`, reason);
      this.isConnected = false;
      this.emitInternal('connection-status', { connected: false, reason });
    });

    // Bind listeners immediately if already registered
    this.rebindAllSocketListeners();

    return this.socket;
  }

  rebindAllSocketListeners() {
    if (!this.socket) return;
    for (const [event, handlers] of this.socketEventListeners.entries()) {
      for (const handler of handlers) {
        this.socket.off(event, handler); // Prevent duplicate binds
        this.socket.on(event, handler);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  createRoom() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Not connected to relay server. Check server URL.'));
      }
      this.socket.emit('create-room', (response) => {
        if (response && response.success) {
          this.currentRoomCode = response.roomCode;
          resolve(response.roomCode);
        } else {
          reject(new Error(response?.message || 'Failed to create room'));
        }
      });
    });
  }

  joinRoom(roomCode) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Not connected to relay server. Check server URL.'));
      }
      this.socket.emit('join-room', { roomCode }, (response) => {
        if (response && response.success) {
          this.currentRoomCode = roomCode;
          resolve(response);
        } else {
          reject(new Error(response?.message || 'Failed to join room'));
        }
      });
    });
  }

  leaveRoom() {
    this.currentRoomCode = null;
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave-room');
    }
  }

  /**
   * Register or update device identity with server & MongoDB
   * Returns: { deviceId, deviceName, permanentRoomCode }
   */
  registerDevice(profile) {
    this.deviceProfile = { ...this.deviceProfile, ...profile };
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        // Cached profile will be registered automatically on socket connect
        return resolve(this.deviceProfile);
      }
      this.socket.emit(
        'register-device',
        {
          deviceId: profile.deviceId,
          deviceName: profile.deviceName,
        },
        (response) => {
          if (response && response.success && response.device) {
            this.deviceProfile = { ...this.deviceProfile, ...response.device };
            this.emitInternal('device-registered', this.deviceProfile);
            resolve(this.deviceProfile);
          } else {
            reject(new Error(response?.message || 'Device registration failed'));
          }
        }
      );
    });
  }

  /**
   * Query online devices currently connected to relay server
   */
  getOnlineDevices(currentDeviceId = null) {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        return resolve([]);
      }
      const myId = currentDeviceId || this.deviceProfile?.deviceId;
      this.socket.emit('get-online-devices', { currentDeviceId: myId }, (response) => {
        if (response && response.success && Array.isArray(response.devices)) {
          resolve(response.devices);
        } else {
          resolve([]);
        }
      });
    });
  }

  /**
   * Initiate direct connection to a target device using its ID or permanent room code
   */
  directConnect({ fromDeviceId, fromDeviceName, targetDeviceId, targetRoomCode }) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        return reject(new Error('Signaling server is disconnected.'));
      }
      this.socket.emit(
        'direct-connect',
        {
          fromDeviceId: fromDeviceId || this.deviceProfile?.deviceId,
          fromDeviceName: fromDeviceName || this.deviceProfile?.deviceName,
          targetDeviceId,
          targetRoomCode,
        },
        (response) => {
          if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.message || 'Direct connection request failed'));
          }
        }
      );
    });
  }

  /**
   * Accept or decline an incoming direct connect request
   */
  respondDirectConnect({ fromDeviceId, targetDeviceId, accepted, roomCode }) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('direct-connect-response', {
      fromDeviceId,
      targetDeviceId: targetDeviceId || this.deviceProfile?.deviceId,
      accepted,
      roomCode,
    });
    return true;
  }

  /**
   * Cancel an outgoing direct connect request
   */
  cancelDirectConnect({ fromDeviceId, targetDeviceId }) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('cancel-direct-connect', {
      fromDeviceId: fromDeviceId || this.deviceProfile?.deviceId,
      targetDeviceId,
    });
    return true;
  }

  sendMetadata(payload) {
    if (!this.socket || !this.socket.connected) {
      console.warn('[Socket] Cannot send metadata: socket offline');
      return false;
    }
    const dataToSend = {
      roomCode: payload.roomCode || this.currentRoomCode,
      ...payload,
    };
    console.log(`[Socket] Emitting send-chunk-metadata to room [${dataToSend.roomCode}]:`, payload.name);
    this.socket.emit('send-chunk-metadata', dataToSend);
    return true;
  }

  sendChunk(payload) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('send-chunk', {
      roomCode: payload.roomCode || this.currentRoomCode,
      ...payload,
    });
    return true;
  }

  sendTransferComplete(payload) {
    if (!this.socket || !this.socket.connected) return false;
    console.log(`[Socket] Emitting transfer-complete for file ${payload.id}`);
    this.socket.emit('transfer-complete', {
      roomCode: payload.roomCode || this.currentRoomCode,
      ...payload,
    });
    return true;
  }

  sendMessage(message) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('send-message', {
      roomCode: message.roomCode || this.currentRoomCode,
      ...message,
    });
    return true;
  }

  /**
   * Safe persistent listener registration that survives socket reconnects and pre-connection calls
   */
  on(event, callback) {
    if (!this.socketEventListeners.has(event)) {
      this.socketEventListeners.set(event, new Set());
    }
    this.socketEventListeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socketEventListeners.has(event)) {
      this.socketEventListeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Internal event bus for UI triggers
  onInternal(event, callback) {
    if (!this.internalListeners.has(event)) {
      this.internalListeners.set(event, new Set());
    }
    this.internalListeners.get(event).add(callback);
    return () => this.internalListeners.get(event).delete(callback);
  }

  emitInternal(event, data) {
    if (this.internalListeners.has(event)) {
      for (const cb of this.internalListeners.get(event)) {
        cb(data);
      }
    }
  }
}

export const socketService = new SocketService();
