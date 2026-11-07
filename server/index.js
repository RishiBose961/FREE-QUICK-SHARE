import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Device } from './models/Device.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// Initialize Socket.io with high buffer capacity for video and media chunk streaming
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 5e7, // 50 MB buffer limit for socket packets
});

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quickshare';

// Track MongoDB connection state
let isMongoConnected = false;

// Connect to MongoDB using Mongoose
async function connectMongoDB() {
  try {
    console.log(`[MongoDB] Connecting to ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    console.log('✅ [MongoDB] Connected successfully to database!');

    // Reset online status on server boot
    await Device.updateMany({}, { isOnline: false, socketId: null });
  } catch (err) {
    isMongoConnected = false;
    console.warn(`⚠️ [MongoDB] Connection notice: ${err.message}`);
    console.warn('ℹ️ [MongoDB] Server is running with in-memory persistence fallback until MongoDB connects.');
  }
}

mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('✅ [MongoDB] Connection established.');
});

mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('⚠️ [MongoDB] Disconnected.');
});

connectMongoDB();

// Active rooms map: roomCode (4 digits) -> Room State
// roomCode: { code, createdAt, hostSocketId, peers: Set<string>, senderId, receiverId, isPermanent, deviceId }
const rooms = new Map();
const socketToRoom = new Map(); // socket.id -> roomCode

// In-memory Device Cache fallback (keeps device IDs & permanent PINs in sync)
const memoryDevices = new Map(); // deviceId -> Device object
const socketToDevice = new Map(); // socket.id -> deviceId

/**
 * Generate a random 4-digit code between 1000 and 9999
 */
function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generate a permanent 4-digit code guaranteed to be unique across all devices
 */
async function generateUniquePermanentCode() {
  let code;
  let attempts = 0;
  while (attempts < 10000) {
    code = generate4DigitCode();
    attempts++;

    // Check memory rooms
    if (rooms.has(code)) continue;

    // Check memory devices
    let memoryTaken = false;
    for (const dev of memoryDevices.values()) {
      if (dev.permanentRoomCode === code) {
        memoryTaken = true;
        break;
      }
    }
    if (memoryTaken) continue;

    // Check MongoDB if connected
    if (isMongoConnected) {
      try {
        const existing = await Device.findOne({ permanentRoomCode: code });
        if (existing) continue;
      } catch (_) {}
    }

    return code;
  }
  return generate4DigitCode();
}

/**
 * Register or update device profile in MongoDB & memory
 */
async function registerOrUpdateDevice({ deviceId, deviceName, socketId, ipAddress }) {
  let device = null;

  if (isMongoConnected) {
    try {
      device = await Device.findOne({ deviceId });
      if (device) {
        if (deviceName) device.deviceName = deviceName.trim();
        device.socketId = socketId;
        device.isOnline = true;
        device.ipAddress = ipAddress;
        device.lastSeen = new Date();
        // Ensure pairedDevices stores only the latest device (trim history)
        if (device.pairedDevices && device.pairedDevices.length > 1) {
          device.pairedDevices = [device.pairedDevices[device.pairedDevices.length - 1]];
        }
        await device.save();
      } else {
        const permanentRoomCode = await generateUniquePermanentCode();
        device = await Device.create({
          deviceId,
          deviceName: deviceName ? deviceName.trim() : 'Unknown Device',
          permanentRoomCode,
          socketId,
          isOnline: true,
          ipAddress,
          lastSeen: new Date(),
        });
      }
    } catch (err) {
      console.warn('[Device] MongoDB operation warning:', err.message);
    }
  }

  // Update in-memory fallback
  if (!device) {
    let existingMem = memoryDevices.get(deviceId);
    if (existingMem) {
      if (deviceName) existingMem.deviceName = deviceName.trim();
      existingMem.socketId = socketId;
      existingMem.isOnline = true;
      existingMem.ipAddress = ipAddress;
      existingMem.lastSeen = new Date();
      device = existingMem;
    } else {
      const permanentRoomCode = await generateUniquePermanentCode();
      device = {
        deviceId,
        deviceName: deviceName ? deviceName.trim() : 'Unknown Device',
        permanentRoomCode,
        socketId,
        isOnline: true,
        ipAddress,
        pairedDevices: [],
        lastSeen: new Date(),
      };
      memoryDevices.set(deviceId, device);
    }
  } else {
    // Keep memory in sync with DB
    memoryDevices.set(deviceId, {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      permanentRoomCode: device.permanentRoomCode,
      socketId: device.socketId,
      isOnline: device.isOnline,
      ipAddress: device.ipAddress,
      pairedDevices: device.pairedDevices || [],
      lastSeen: device.lastSeen,
    });
  }

  // Ensure permanent room exists in memory
  if (device && device.permanentRoomCode) {
    if (!rooms.has(device.permanentRoomCode)) {
      rooms.set(device.permanentRoomCode, {
        code: device.permanentRoomCode,
        createdAt: Date.now(),
        hostSocketId: socketId,
        senderId: socketId,
        receiverId: null,
        peers: new Set([socketId]),
        isPermanent: true,
        deviceId: device.deviceId,
      });
    } else {
      const room = rooms.get(device.permanentRoomCode);
      room.peers.add(socketId);
      room.hostSocketId = socketId;
    }
  }

  return device;
}

/**
 * Store ONLY the latest paired device for both peers (replaces history)
 */
async function setLatestPairedDevice(devA, devB) {
  if (!devA || !devB || devA.deviceId === devB.deviceId) return;

  const pairedForA = [
    {
      deviceId: devB.deviceId,
      deviceName: devB.deviceName,
      permanentRoomCode: devB.permanentRoomCode,
      pairedAt: new Date(),
    },
  ];

  const pairedForB = [
    {
      deviceId: devA.deviceId,
      deviceName: devA.deviceName,
      permanentRoomCode: devA.permanentRoomCode,
      pairedAt: new Date(),
    },
  ];

  // Update in-memory fallback
  const memA = memoryDevices.get(devA.deviceId);
  if (memA) memA.pairedDevices = pairedForA;
  const memB = memoryDevices.get(devB.deviceId);
  if (memB) memB.pairedDevices = pairedForB;

  // Persist only the latest paired device in MongoDB
  if (isMongoConnected) {
    try {
      await Device.updateOne(
        { deviceId: devA.deviceId },
        { $set: { pairedDevices: pairedForA } }
      );
      await Device.updateOne(
        { deviceId: devB.deviceId },
        { $set: { pairedDevices: pairedForB } }
      );
      console.log(
        `💾 [Pairing] Stored latest paired device: "${devA.deviceName}" <--> "${devB.deviceName}"`
      );
    } catch (pairErr) {
      console.warn('[MongoDB] Pairing update notice:', pairErr.message);
    }
  }
}

/**
 * Get local IPv4 addresses to show friendly instructions in console
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// REST API Endpoints

// 1. Health check & status
app.get('/', async (req, res) => {
  let totalDevices = memoryDevices.size;
  let onlineDevices = 0;

  if (isMongoConnected) {
    try {
      totalDevices = await Device.countDocuments();
      onlineDevices = await Device.countDocuments({ isOnline: true });
    } catch (_) {}
  } else {
    for (const dev of memoryDevices.values()) {
      if (dev.isOnline) onlineDevices++;
    }
  }

  res.json({
    status: 'online',
    message: 'QuickShare Relay Server is active',
    database: isMongoConnected ? 'connected (MongoDB)' : 'in-memory (MongoDB offline)',
    activeRooms: rooms.size,
    totalDevices,
    onlineDevices,
    timestamp: new Date().toISOString(),
  });
});

// 2. Get registered devices
app.get('/api/devices', async (req, res) => {
  try {
    if (isMongoConnected) {
      const devices = await Device.find(
        {},
        'deviceId deviceName permanentRoomCode isOnline lastSeen pairedDevices'
      );
      return res.json({
        success: true,
        devices: devices.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          permanentRoomCode: d.permanentRoomCode,
          isOnline: d.isOnline,
          lastSeen: d.lastSeen,
          pairedDevices: (d.pairedDevices || []).slice(0, 1),
        })),
      });
    }
    const devices = Array.from(memoryDevices.values()).map((d) => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      permanentRoomCode: d.permanentRoomCode,
      isOnline: d.isOnline,
      lastSeen: d.lastSeen,
      pairedDevices: (d.pairedDevices || []).slice(0, 1),
    }));
    res.json({ success: true, devices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Register device via REST API
app.post('/api/devices/register', async (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'deviceId is required' });
  }
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const device = await registerOrUpdateDevice({
    deviceId,
    deviceName,
    socketId: null,
    ipAddress: clientIp,
  });

  res.json({
    success: true,
    device: {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      permanentRoomCode: device.permanentRoomCode,
    },
  });
});

// WebSocket Event Handlers
io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  console.log(`[Socket Connected] ID: ${socket.id} from ${clientIp}`);

  // 1. Register or identify device with permanent room number
  socket.on('register-device', async (payload, callback) => {
    const { deviceId, deviceName } = payload || {};
    if (!deviceId) {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'deviceId is required' });
      }
      return;
    }

    try {
      const device = await registerOrUpdateDevice({
        deviceId,
        deviceName,
        socketId: socket.id,
        ipAddress: clientIp,
      });

      socketToDevice.set(socket.id, device.deviceId);
      socket.join(device.permanentRoomCode);
      socketToRoom.set(socket.id, device.permanentRoomCode);

      console.log(
        `📱 [Device Registered] "${device.deviceName}" (ID: ${device.deviceId}) -> Permanent Room #${device.permanentRoomCode}`
      );

      const response = {
        success: true,
        device: {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          permanentRoomCode: device.permanentRoomCode,
          pairedDevices: (device.pairedDevices || []).slice(0, 1),
        },
      };

      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('device-registered', response);
      }

      // Notify other clients about the updated online device list
      broadcastOnlineDevices();
    } catch (err) {
      console.error('[Socket] register-device error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    }
  });

  // 2. Fetch list of online / discoverable peers
  socket.on('get-online-devices', async (payload, callback) => {
    const currentDeviceId = payload?.currentDeviceId || socketToDevice.get(socket.id);
    const devices = await getOnlineDevicesList(currentDeviceId);

    if (typeof callback === 'function') {
      callback({ success: true, devices });
    } else {
      socket.emit('online-devices', { devices });
    }
  });

  // 3. Direct Connect to a device without manual PIN entry
  socket.on('direct-connect', async (payload, callback) => {
    const { fromDeviceId, fromDeviceName, targetDeviceId, targetRoomCode } = payload || {};

    let targetDevice = null;
    if (targetDeviceId) {
      targetDevice = memoryDevices.get(targetDeviceId);
      if (!targetDevice && isMongoConnected) {
        targetDevice = await Device.findOne({ deviceId: targetDeviceId });
      }
    } else if (targetRoomCode) {
      for (const dev of memoryDevices.values()) {
        if (dev.permanentRoomCode === targetRoomCode.toString().trim()) {
          targetDevice = dev;
          break;
        }
      }
      if (!targetDevice && isMongoConnected) {
        targetDevice = await Device.findOne({ permanentRoomCode: targetRoomCode.toString().trim() });
      }
    }

    if (!targetDevice) {
      const msg = 'Target device not found. Please verify the device or room number.';
      if (typeof callback === 'function') callback({ success: false, message: msg });
      else socket.emit('direct-connect-failed', { message: msg });
      return;
    }

    if (!targetDevice.isOnline || !targetDevice.socketId) {
      const msg = `"${targetDevice.deviceName}" is currently offline.`;
      if (typeof callback === 'function') callback({ success: false, message: msg });
      else socket.emit('direct-connect-failed', { message: msg });
      return;
    }

    const roomCode = targetDevice.permanentRoomCode;

    console.log(
      `⚡ [Direct Connect] "${fromDeviceName || fromDeviceId}" requests connection to "${targetDevice.deviceName}" (Room #${roomCode})`
    );

    // Prompt the target device with an incoming connection request dialog
    io.to(targetDevice.socketId).emit('incoming-direct-connect-request', {
      fromDeviceId,
      fromDeviceName: fromDeviceName || 'Nearby Device',
      roomCode,
      targetDeviceId: targetDevice.deviceId,
      targetDeviceName: targetDevice.deviceName,
    });

    if (typeof callback === 'function') {
      callback({
        success: true,
        message: `Connection request sent to ${targetDevice.deviceName}...`,
        roomCode,
      });
    }
  });

  // 3b. Cancel outgoing direct connection request
  socket.on('cancel-direct-connect', async (payload) => {
    const { fromDeviceId, targetDeviceId } = payload || {};
    let targetDevice = null;
    if (targetDeviceId) {
      targetDevice =
        memoryDevices.get(targetDeviceId) ||
        (isMongoConnected ? await Device.findOne({ deviceId: targetDeviceId }) : null);
    }
    if (targetDevice && targetDevice.socketId) {
      io.to(targetDevice.socketId).emit('direct-connect-cancelled', { fromDeviceId });
      console.log(
        `🚫 [Direct Connect Cancelled] "${fromDeviceId}" cancelled request to "${targetDevice.deviceName}"`
      );
    }
  });

  // 4. Target device accepts or declines direct connection
  socket.on('direct-connect-response', async (payload) => {
    const { fromDeviceId, targetDeviceId, accepted, roomCode } = payload || {};

    const requesterDevice = memoryDevices.get(fromDeviceId) || (isMongoConnected ? await Device.findOne({ deviceId: fromDeviceId }) : null);
    const targetDevice = memoryDevices.get(targetDeviceId) || (isMongoConnected ? await Device.findOne({ deviceId: targetDeviceId }) : null);

    if (!requesterDevice || !targetDevice) return;

    if (!accepted) {
      if (requesterDevice.socketId) {
        io.to(requesterDevice.socketId).emit('direct-connect-rejected', {
          message: `"${targetDevice.deviceName}" declined the connection request.`,
          fromDeviceName: targetDevice.deviceName,
        });
      }
      return;
    }

    const activeRoomCode = roomCode || targetDevice.permanentRoomCode;

    // Both devices join the active room
    socket.join(activeRoomCode);
    socketToRoom.set(socket.id, activeRoomCode);

    const requesterSocket = io.sockets.sockets.get(requesterDevice.socketId);
    if (requesterSocket) {
      requesterSocket.join(activeRoomCode);
      socketToRoom.set(requesterDevice.socketId, activeRoomCode);
    }

    // Initialize or update the room in active rooms map
    let room = rooms.get(activeRoomCode);
    if (!room) {
      room = {
        code: activeRoomCode,
        createdAt: Date.now(),
        hostSocketId: targetDevice.socketId,
        senderId: requesterDevice.socketId,
        receiverId: targetDevice.socketId,
        peers: new Set([requesterDevice.socketId, targetDevice.socketId]),
        isPermanent: true,
        deviceId: targetDevice.deviceId,
      };
      rooms.set(activeRoomCode, room);
    } else {
      room.peers.add(requesterDevice.socketId);
      room.peers.add(targetDevice.socketId);
      room.senderId = requesterDevice.socketId;
      room.receiverId = targetDevice.socketId;
    }

    console.log(
      `🤝 [Direct Paired] Room #${activeRoomCode}: "${requesterDevice.deviceName}" <--> "${targetDevice.deviceName}"`
    );

    // Save ONLY the latest paired device in MongoDB & memory (replaces history)
    await setLatestPairedDevice(targetDevice, requesterDevice);

    // Notify requester (Role: Sender)
    if (requesterDevice.socketId) {
      io.to(requesterDevice.socketId).emit('connection-ready', {
        roomCode: activeRoomCode,
        role: 'sender',
        peerName: targetDevice.deviceName,
        peerDeviceId: targetDevice.deviceId,
        message: `Directly connected with ${targetDevice.deviceName}!`,
      });
    }

    // Notify target device (Role: Receiver)
    if (targetDevice.socketId) {
      io.to(targetDevice.socketId).emit('connection-ready', {
        roomCode: activeRoomCode,
        role: 'receiver',
        peerName: requesterDevice.deviceName,
        peerDeviceId: requesterDevice.deviceId,
        message: `Directly connected with ${requesterDevice.deviceName}!`,
      });
    }
  });

  // 5. Classic 4-Digit PIN Creation (Backward Compatibility)
  socket.on('create-room', (callback) => {
    const roomCode = generate4DigitCode();
    const room = {
      code: roomCode,
      createdAt: Date.now(),
      hostSocketId: socket.id,
      senderId: socket.id,
      receiverId: null,
      peers: new Set([socket.id]),
      isPermanent: false,
    };

    rooms.set(roomCode, room);
    socketToRoom.set(socket.id, roomCode);
    socket.join(roomCode);

    console.log(`[Room Created] Code: ${roomCode} by ${socket.id}`);

    if (typeof callback === 'function') {
      callback({ success: true, roomCode });
    } else {
      socket.emit('room-created', { roomCode });
    }
  });

  // 6. Classic 4-Digit PIN Joining (Permanent or Ad-hoc)
  socket.on('join-room', ({ roomCode }, callback) => {
    const code = roomCode?.toString().trim();
    let room = rooms.get(code);

    // If it's a permanent room registered in DB or memory, allow pairing
    if (!room) {
      for (const dev of memoryDevices.values()) {
        if (dev.permanentRoomCode === code) {
          room = {
            code,
            createdAt: Date.now(),
            hostSocketId: dev.socketId,
            senderId: dev.socketId,
            receiverId: socket.id,
            peers: new Set([socket.id]),
            isPermanent: true,
            deviceId: dev.deviceId,
          };
          if (dev.socketId) room.peers.add(dev.socketId);
          rooms.set(code, room);
          break;
        }
      }
    }

    if (!room) {
      const errorMsg = 'Room not found or expired. Please check the 4-digit code.';
      console.warn(`[Join Failed] Code: ${code} not found`);
      if (typeof callback === 'function') {
        callback({ success: false, message: errorMsg });
      } else {
        socket.emit('join-error', { message: errorMsg });
      }
      return;
    }

    room.peers.add(socket.id);
    room.receiverId = socket.id;
    socketToRoom.set(socket.id, code);
    socket.join(code);

    console.log(`[Room Paired] Code: ${code} - Host: ${room.hostSocketId}, Receiver: ${socket.id}`);

    // Update latest paired device if both devices are registered
    const hostDeviceId = socketToDevice.get(room.hostSocketId) || room.deviceId;
    const receiverDeviceId = socketToDevice.get(socket.id);
    if (hostDeviceId && receiverDeviceId && hostDeviceId !== receiverDeviceId) {
      (async () => {
        try {
          const hostDev =
            memoryDevices.get(hostDeviceId) ||
            (isMongoConnected ? await Device.findOne({ deviceId: hostDeviceId }) : null);
          const receiverDev =
            memoryDevices.get(receiverDeviceId) ||
            (isMongoConnected ? await Device.findOne({ deviceId: receiverDeviceId }) : null);
          if (hostDev && receiverDev) {
            await setLatestPairedDevice(hostDev, receiverDev);
          }
        } catch (_) {}
      })();
    }

    if (typeof callback === 'function') {
      callback({ success: true, roomCode: code, role: 'receiver' });
    }

    // Notify both parties that connection is ready
    io.to(code).emit('connection-ready', {
      roomCode: code,
      senderId: room.senderId,
      receiverId: room.receiverId,
      message: 'Both devices are connected and ready to share!',
    });
  });

  // Re-join room on reconnect
  socket.on('rejoin-room', ({ roomCode }) => {
    const code = roomCode?.toString().trim();
    if (code) {
      socket.join(code);
      socketToRoom.set(socket.id, code);
      if (rooms.has(code)) {
        rooms.get(code).peers.add(socket.id);
      }
      console.log(`[Socket Rejoined] ID: ${socket.id} to room ${code}`);
    }
  });

  // 7. File Chunk Transfer Protocol
  socket.on('send-chunk-metadata', (payload) => {
    const metadata = payload.metadata || payload;
    const roomCode = (payload.roomCode || metadata.roomCode || socketToRoom.get(socket.id))?.toString();

    if (!roomCode) {
      console.warn(`[Server] send-chunk-metadata: Socket ${socket.id} has no associated room!`);
      return;
    }

    socket.join(roomCode);
    console.log(`[Server] Relaying file metadata in room [${roomCode}]: ${metadata.name} (${metadata.size} bytes)`);
    socket.to(roomCode).emit('receive-chunk-metadata', metadata);
  });

  socket.on('send-chunk', (payload) => {
    const roomCode = (payload.roomCode || socketToRoom.get(socket.id))?.toString();
    if (!roomCode) return;
    socket.to(roomCode).emit('receive-chunk', payload);
  });

  socket.on('chunk-ack', (payload) => {
    const roomCode = (payload.roomCode || socketToRoom.get(socket.id))?.toString();
    if (!roomCode) return;
    socket.to(roomCode).emit('chunk-ack-received', payload);
  });

  socket.on('transfer-complete', (payload) => {
    const roomCode = (payload.roomCode || socketToRoom.get(socket.id))?.toString();
    if (!roomCode) return;
    console.log(`[Server] Transfer complete in room [${roomCode}] for file ${payload.id}`);
    socket.to(roomCode).emit('receive-transfer-complete', payload);
  });

  socket.on('send-message', (payload) => {
    const roomCode = (payload.roomCode || socketToRoom.get(socket.id))?.toString();
    if (!roomCode) return;
    console.log(`[Server] Relaying text message in room [${roomCode}]`);
    socket.to(roomCode).emit('receive-message', {
      ...payload,
      senderSocketId: socket.id,
      timestamp: Date.now(),
    });
  });

  socket.on('leave-room', () => {
    const roomCode = socketToRoom.get(socket.id);
    if (roomCode) {
      cleanupRoom(roomCode, socket.id);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', async () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    const deviceId = socketToDevice.get(socket.id);
    socketToDevice.delete(socket.id);

    if (deviceId) {
      const dev = memoryDevices.get(deviceId);
      if (dev && dev.socketId === socket.id) {
        dev.isOnline = false;
        dev.socketId = null;
        dev.lastSeen = new Date();
      }

      if (isMongoConnected) {
        try {
          await Device.updateOne(
            { deviceId, socketId: socket.id },
            { isOnline: false, socketId: null, lastSeen: new Date() }
          );
        } catch (_) {}
      }

      broadcastOnlineDevices();
    }

    const roomCode = socketToRoom.get(socket.id);
    if (roomCode) {
      setTimeout(() => {
        const room = rooms.get(roomCode);
        if (room && room.peers.has(socket.id)) {
          cleanupRoom(roomCode, socket.id);
        }
      }, 5000);
    }
  });
});

/**
 * Clean up room and notify peer
 */
function cleanupRoom(roomCode, disconnectedSocketId = null) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (disconnectedSocketId) {
    room.peers.delete(disconnectedSocketId);
    socketToRoom.delete(disconnectedSocketId);
  }

  io.to(roomCode).emit('peer-disconnected', {
    message: 'The other device disconnected or left the room.',
    roomCode,
  });

  // Permanent rooms stay alive for their host device
  if (room.peers.size === 0 && !room.isPermanent) {
    rooms.delete(roomCode);
    console.log(`[Room Closed] Code: ${roomCode}`);
  }
}

/**
 * Query online discoverable devices
 */
async function getOnlineDevicesList(excludeDeviceId = null) {
  const devices = [];

  if (isMongoConnected) {
    try {
      const query = { isOnline: true };
      if (excludeDeviceId) {
        query.deviceId = { $ne: excludeDeviceId };
      }
      const docs = await Device.find(
        query,
        'deviceId deviceName permanentRoomCode isOnline lastSeen pairedDevices'
      );
      return docs.map((d) => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        permanentRoomCode: d.permanentRoomCode,
        isOnline: d.isOnline,
        lastSeen: d.lastSeen,
        pairedDevices: (d.pairedDevices || []).slice(0, 1),
      }));
    } catch (_) {}
  }

  for (const dev of memoryDevices.values()) {
    if (dev.isOnline && dev.deviceId !== excludeDeviceId) {
      devices.push({
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
        permanentRoomCode: dev.permanentRoomCode,
        isOnline: dev.isOnline,
        lastSeen: dev.lastSeen,
        pairedDevices: (dev.pairedDevices || []).slice(0, 1),
      });
    }
  }

  return devices;
}

/**
 * Broadcast active online devices list to all sockets
 */
async function broadcastOnlineDevices() {
  const allOnline = await getOnlineDevicesList(null);
  io.emit('online-devices-updated', { devices: allOnline });
}

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🚀 QuickShare Signaling & Relay Server is LIVE on port ${PORT}`);
  console.log(`📦 MongoDB Database: ${MONGODB_URI}`);
  console.log('======================================================');
  console.log(`📡 Localhost:     http://localhost:${PORT}`);
  const ips = getLocalIpAddresses();
  if (ips.length > 0) {
    console.log('📱 On your Mobile Phone (Expo Go), enter this Server URL:');
    ips.forEach((ip) => {
      console.log(`   👉 http://${ip}:${PORT}`);
    });
  } else {
    console.log('📱 Set your machine LAN IP address with port 4000 in the mobile app.');
  }
  console.log('======================================================\n');
});
