import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const SETTINGS_FILE_NAME = 'quickshare_device.json';

function generateRandomId() {
  return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getDefaultDeviceName() {
  if (Platform.OS === 'web') {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    if (/Windows/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'MacBook';
    if (/Linux/i.test(userAgent)) return 'Linux Machine';
    return 'Web Browser';
  }
  if (Platform.OS === 'android') {
    return 'Android Device';
  }
  if (Platform.OS === 'ios') {
    return 'iPhone / iPad';
  }
  return 'My Device';
}

class DeviceService {
  constructor() {
    this.deviceId = null;
    this.deviceName = null;
    this.permanentRoomCode = null;
    this.pairedDevices = [];
    this.serverUrl = 'http://localhost:4000';
    this.isLoaded = false;
  }

  async init() {
    if (this.isLoaded) {
      return this.getProfile();
    }

    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const storedId = localStorage.getItem('quickshare_device_id');
        const storedName = localStorage.getItem('quickshare_device_name');
        const storedPin = localStorage.getItem('quickshare_permanent_pin');
        const storedServer = localStorage.getItem('quickshare_server_url');
        const storedPaired = localStorage.getItem('quickshare_paired_devices');

        this.deviceId = storedId || generateRandomId();
        this.deviceName = storedName || getDefaultDeviceName();
        this.permanentRoomCode = storedPin || null;
        if (storedServer) this.serverUrl = storedServer;
        if (storedPaired) {
          try { this.pairedDevices = JSON.parse(storedPaired); } catch (_) {}
        }

        if (!storedId) localStorage.setItem('quickshare_device_id', this.deviceId);
        if (!storedName) localStorage.setItem('quickshare_device_name', this.deviceName);
      } else if (Platform.OS !== 'web' && FileSystem && FileSystem.documentDirectory) {
        const filePath = `${FileSystem.documentDirectory}${SETTINGS_FILE_NAME}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(filePath);
          const data = JSON.parse(content);
          this.deviceId = data.deviceId || generateRandomId();
          this.deviceName = data.deviceName || getDefaultDeviceName();
          this.permanentRoomCode = data.permanentRoomCode || null;
          this.pairedDevices = data.pairedDevices || [];
          if (data.serverUrl) this.serverUrl = data.serverUrl;
        } else {
          this.deviceId = generateRandomId();
          this.deviceName = getDefaultDeviceName();
          this.permanentRoomCode = null;
          this.pairedDevices = [];
          this.serverUrl = 'http://localhost:4000';
          await this.saveToFile();
        }
      } else {
        this.deviceId = generateRandomId();
        this.deviceName = getDefaultDeviceName();
      }
    } catch (err) {
      console.warn('[DeviceService] Failed to load device profile:', err.message);
      this.deviceId = this.deviceId || generateRandomId();
      this.deviceName = this.deviceName || getDefaultDeviceName();
    }

    this.isLoaded = true;
    return this.getProfile();
  }

  async saveToFile() {
    if (Platform.OS !== 'web' && FileSystem && FileSystem.documentDirectory) {
      try {
        const filePath = `${FileSystem.documentDirectory}${SETTINGS_FILE_NAME}`;
        await FileSystem.writeAsStringAsync(
          filePath,
          JSON.stringify({
            deviceId: this.deviceId,
            deviceName: this.deviceName,
            permanentRoomCode: this.permanentRoomCode,
            pairedDevices: this.pairedDevices,
            serverUrl: this.serverUrl,
          })
        );
      } catch (err) {
        console.warn('[DeviceService] Could not save to file:', err.message);
      }
    }
  }

  async setServerUrl(url) {
    if (!url || !url.trim()) return;
    this.serverUrl = url.trim();
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem('quickshare_server_url', this.serverUrl);
    } else {
      await this.saveToFile();
    }
  }

  async setPermanentRoomCode(code) {
    this.permanentRoomCode = code ? code.toString().trim() : null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (this.permanentRoomCode) {
        localStorage.setItem('quickshare_permanent_pin', this.permanentRoomCode);
      } else {
        localStorage.removeItem('quickshare_permanent_pin');
      }
    } else {
      await this.saveToFile();
    }
  }

  async setDeviceName(newName) {
    if (!newName || !newName.trim()) return;
    this.deviceName = newName.trim();

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem('quickshare_device_name', this.deviceName);
    } else {
      await this.saveToFile();
    }
  }

  async updateProfile(updates = {}) {
    if (updates.deviceName && updates.deviceName.trim()) {
      this.deviceName = updates.deviceName.trim();
    }
    if (updates.permanentRoomCode) {
      this.permanentRoomCode = updates.permanentRoomCode.toString().trim();
    }
    if (updates.pairedDevices && Array.isArray(updates.pairedDevices)) {
      this.pairedDevices = updates.pairedDevices.slice(0, 1);
    }
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (this.deviceName) localStorage.setItem('quickshare_device_name', this.deviceName);
      if (this.permanentRoomCode) localStorage.setItem('quickshare_permanent_pin', this.permanentRoomCode);
      localStorage.setItem('quickshare_paired_devices', JSON.stringify(this.pairedDevices));
    } else {
      await this.saveToFile();
    }
    return this.getProfile();
  }

  getProfile() {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      permanentRoomCode: this.permanentRoomCode,
      pairedDevices: this.pairedDevices,
      serverUrl: this.serverUrl,
    };
  }
}

export const deviceService = new DeviceService();
