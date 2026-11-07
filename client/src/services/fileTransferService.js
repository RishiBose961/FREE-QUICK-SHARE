import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { socketService } from './socketService';

// 36 KB binary slice corresponds to 48 KB base64 string
const BINARY_SLICE_SIZE = 36 * 1024;
const CHUNK_SIZE = 48 * 1024;

/**
 * Robust base64 to Blob conversion for Web browsers
 */
function base64ToBlob(base64Data, contentType = 'application/octet-stream') {
  const cleanBase64 = base64Data
    .replace(/[\r\n\s]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = cleanBase64.length % 4;
  const padded = pad ? cleanBase64 + '='.repeat(4 - pad) : cleanBase64;
  const byteCharacters = atob(padded);
  const bytes = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    bytes[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

/**
 * Universal file-to-base64 reader.
 * Handles Web Blob URLs, native file:// paths (including paths outside Expo Go sandbox),
 * and Android content:// schemes safely.
 */
async function readUriAsBase64(uri, fileName = 'temp_file') {
  // Method 1: Fetch + Blob + FileReader
  // In React Native, fetch() and FileReader can read local file:/// URIs that are outside
  // Expo Go's FileSystem scoped experience sandbox.
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const parts = reader.result.split(',');
          resolve(parts.length > 1 ? parts[1] : parts[0]);
        } else {
          reject(new Error('FileReader returned non-string result'));
        }
      };
      reader.onerror = (e) => reject(new Error('FileReader error: ' + e));
      reader.readAsDataURL(blob);
    });

    if (base64 && base64.length > 0) {
      return base64;
    }
  } catch (fetchErr) {
    console.warn('[Transfer] fetch+FileReader attempt notice:', fetchErr.message);
  }

  // Method 2: Native FileSystem readAsStringAsync
  if (Platform.OS !== 'web' && FileSystem && FileSystem.readAsStringAsync) {
    let targetUri = uri;

    // On Android, content:// URIs can be copied into cacheDirectory first
    if (targetUri.startsWith('content://')) {
      try {
        const cacheDir = (FileSystem.cacheDirectory || '').replace(/\/?$/, '/');
        const safeTempPath = `${cacheDir}cache_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await FileSystem.copyAsync({ from: targetUri, to: safeTempPath });
        targetUri = safeTempPath;
      } catch (copyErr) {
        console.warn('[Transfer] Content copy notice in readUriAsBase64:', copyErr.message);
      }
    }

    return await FileSystem.readAsStringAsync(targetUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  throw new Error('Unable to read file content.');
}

class FileTransferService {
  constructor() {
    this.activeReceives = new Map(); // id -> { metadata, chunks, receivedCount, status }
    this.listeners = new Set();
    this.sendQueue = []; // Queue of file payloads to send sequentially
    this.isProcessingQueue = false;
    this.currentTransferId = null;
    this.setupSocketListeners();
  }

  /**
   * Clear any remaining pending items from the queue (e.g. on disconnect)
   */
  clearQueue() {
    if (this.sendQueue.length > 0) {
      console.log(`[Transfer Queue] Clearing ${this.sendQueue.length} queued items`);
      for (const item of this.sendQueue) {
        this.notifyListeners({
          type: 'send-error',
          item: {
            id: item.id,
            status: 'failed',
            error: 'Session ended',
          },
        });
      }
      this.sendQueue = [];
    }
    this.isProcessingQueue = false;
    this.currentTransferId = null;
  }

  /**
   * Enqueue one or multiple files for sequential transmission
   */
  enqueueFiles(filePayloads) {
    if (!filePayloads || filePayloads.length === 0) return [];

    const enqueuedItems = [];

    // 1. Prepare items and assign unique transfer IDs
    for (const payload of filePayloads) {
      const transferId =
        payload.id ||
        `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const isFirstAndIdle =
        !this.isProcessingQueue &&
        enqueuedItems.length === 0 &&
        this.sendQueue.length === 0;

      const queueItem = {
        ...payload,
        id: transferId,
        progress: 0,
        status: isFirstAndIdle ? 'transferring' : 'queued',
        direction: 'outgoing',
      };

      this.sendQueue.push(queueItem);
      enqueuedItems.push(queueItem);
    }

    // 2. Notify UI in reverse order so item 0 (the first one) appears at the top of feed
    for (let i = enqueuedItems.length - 1; i >= 0; i--) {
      const item = enqueuedItems[i];
      this.notifyListeners({
        type: 'send-start',
        item: {
          id: item.id,
          name: item.name,
          size: item.size || 0,
          type: item.type || 'file',
          mimeType: item.mimeType,
          progress: 0,
          status: item.status,
          direction: 'outgoing',
          localUri: item.uri,
          dataUri:
            item.type === 'image' && item.preloadedBase64
              ? `data:${item.mimeType};base64,${item.preloadedBase64}`
              : null,
        },
      });
    }

    // 3. Process queue
    this.processQueue();

    return enqueuedItems;
  }

  /**
   * Sequential queue worker: pulls items one by one and streams them over socket
   */
  async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.sendQueue.length > 0) {
      const currentItem = this.sendQueue.shift();
      this.currentTransferId = currentItem.id;

      // Update item status to 'transferring'
      this.notifyListeners({
        type: 'send-progress',
        item: {
          id: currentItem.id,
          progress: 0,
          status: 'transferring',
        },
      });

      try {
        await this.executeSendFile(currentItem);
      } catch (err) {
        console.error(`[Transfer Queue] Error sending ${currentItem.name}:`, err);
        // executeSendFile already notifies 'send-error', continue with next item
      }

      // Small buffer between queued files to allow socket buffer flush
      if (this.sendQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    this.currentTransferId = null;
    this.isProcessingQueue = false;

    this.notifyListeners({
      type: 'queue-complete',
      remaining: 0,
    });
  }

  setupSocketListeners() {
    // When incoming file transfer metadata arrives
    socketService.on('receive-chunk-metadata', (metadata) => {
      console.log(
        `[Transfer] Incoming ${metadata.type || 'file'} metadata: ${metadata.name} (${metadata.size} bytes, ${metadata.totalChunks} chunks)`
      );
      this.activeReceives.set(metadata.id, {
        metadata,
        chunks: new Array(metadata.totalChunks),
        receivedCount: 0,
        startTime: Date.now(),
        status: 'transferring',
      });

      this.notifyListeners({
        type: 'receive-start',
        item: {
          id: metadata.id,
          name: metadata.name,
          size: metadata.size,
          type: metadata.type || 'file', // 'image' | 'video' | 'file'
          mimeType: metadata.mimeType,
          progress: 0,
          status: 'transferring',
          direction: 'incoming',
        },
      });
    });

    // When an individual chunk arrives
    socketService.on('receive-chunk', async (payload) => {
      const { id, chunkIndex, chunk, totalChunks } = payload;
      const active = this.activeReceives.get(id);
      if (!active) return;

      active.chunks[chunkIndex] = chunk;
      active.receivedCount += 1;

      const progress = Math.min(100, Math.round((active.receivedCount / totalChunks) * 100));

      this.notifyListeners({
        type: 'receive-progress',
        item: {
          id,
          progress,
          status: 'transferring',
        },
      });

      // If all chunks received, assemble and save file
      if (active.receivedCount >= totalChunks) {
        await this.assembleAndSaveFile(id);
      }
    });

    // Fallback completion signal
    socketService.on('receive-transfer-complete', async ({ id }) => {
      const active = this.activeReceives.get(id);
      if (active && active.status !== 'completed') {
        await this.assembleAndSaveFile(id);
      }
    });
  }

  async assembleAndSaveFile(id) {
    const active = this.activeReceives.get(id);
    if (!active || active.status === 'completed') return;

    active.status = 'completed';

    try {
      const isImage = active.metadata.type === 'image';
      const isVideo = active.metadata.type === 'video';
      const rawName =
        active.metadata.name ||
        (isVideo ? `video_${Date.now()}.mp4` : isImage ? `image_${Date.now()}.jpg` : `file_${Date.now()}`);

      let safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (isVideo && !safeName.includes('.')) {
        safeName += '.mp4';
      } else if (isImage && !safeName.includes('.')) {
        safeName += '.jpg';
      }

      const mimeType =
        active.metadata.mimeType ||
        (isVideo ? 'video/mp4' : isImage ? 'image/jpeg' : 'application/octet-stream');

      let fileUri = null;
      let dataUri = null;

      if (Platform.OS === 'web') {
        // Web: Assemble as Blob ObjectURL for in-browser playback, preview and download
        const fullBase64 = active.chunks.join('');
        const blob = base64ToBlob(fullBase64, mimeType);
        fileUri = URL.createObjectURL(blob);
        if (isImage) {
          dataUri = fileUri;
        }
        console.log(`[Transfer] Assembled file as Web ObjectURL: ${fileUri}`);
      } else {
        // Native Mobile (Android & iOS): Save to device cache in controlled batches
        const baseDir = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '').replace(
          /\/?$/,
          '/'
        );
        fileUri = `${baseDir}${Date.now()}_${safeName}`;
        console.log(`[Transfer] Saving assembled file to ${fileUri}...`);

        // Clean previous temp file if exists
        await FileSystem.deleteAsync(fileUri, { idempotent: true });

        // Batch write chunks in slices of 20 to avoid large memory allocations
        const BATCH_SIZE = 20;
        for (let i = 0; i < active.chunks.length; i += BATCH_SIZE) {
          const batchString = active.chunks.slice(i, i + BATCH_SIZE).join('');
          await FileSystem.writeAsStringAsync(fileUri, batchString, {
            encoding: FileSystem.EncodingType.Base64,
            append: i > 0,
          });
        }

        if (isImage) {
          dataUri = fileUri;
        }
      }

      this.notifyListeners({
        type: 'receive-complete',
        item: {
          id,
          name: safeName,
          size: active.metadata.size,
          type: active.metadata.type,
          mimeType,
          progress: 100,
          status: 'completed',
          localUri: fileUri,
          dataUri,
        },
      });

      // Cleanup memory
      this.activeReceives.delete(id);
    } catch (err) {
      console.error(`[Transfer] Error assembling file:`, err);
      this.notifyListeners({
        type: 'receive-error',
        item: {
          id,
          status: 'failed',
          error: err.message,
        },
      });
    }
  }

  /**
   * Pick and send any document/file. Supports multiple file selection in queue.
   */
  async pickAndSendDocument(roomCode) {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: false,
      type: '*/*',
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const filePayloads = result.assets.map((asset, index) => {
      const fileName = asset.name || `file_${Date.now()}_${index + 1}`;
      const rawMime = asset.mimeType || 'application/octet-stream';

      // Auto-detect media type
      let detectedType = 'file';
      const lowerName = fileName.toLowerCase();
      if (
        rawMime.startsWith('video/') ||
        lowerName.endsWith('.mp4') ||
        lowerName.endsWith('.mov') ||
        lowerName.endsWith('.mkv') ||
        lowerName.endsWith('.webm') ||
        lowerName.endsWith('.3gp') ||
        lowerName.endsWith('.avi') ||
        lowerName.endsWith('.m4v')
      ) {
        detectedType = 'video';
      } else if (
        rawMime.startsWith('image/') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.gif') ||
        lowerName.endsWith('.webp')
      ) {
        detectedType = 'image';
      }

      return {
        uri: asset.uri,
        name: fileName,
        size: asset.size || 0,
        mimeType:
          detectedType === 'video' && rawMime === 'application/octet-stream'
            ? 'video/mp4'
            : rawMime,
        type: detectedType,
        domFile: asset.file || null,
        roomCode,
      };
    });

    return this.enqueueFiles(filePayloads);
  }

  /**
   * Pick and send one or multiple Images in transmission queue
   */
  async pickAndSendImage(roomCode) {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permission to access photos and media is required');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      allowsEditing: false,
      quality: 0.9,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const filePayloads = result.assets.map((asset, index) => {
      let ext = '.jpg';
      if (asset.uri) {
        const parts = asset.uri.split('?')[0].split('.');
        if (parts.length > 1) {
          const candidate = parts.pop().toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(candidate)) {
            ext = `.${candidate}`;
          }
        }
      }

      const fileName =
        asset.fileName ||
        (asset.file && asset.file.name) ||
        `photo_${Date.now()}_${index + 1}${ext}`;

      const rawMime = asset.mimeType || (asset.file && asset.file.type);
      let mimeType = rawMime;
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.gif') mimeType = 'image/gif';
        else if (ext === '.webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }

      return {
        uri: asset.uri,
        name: fileName,
        size: asset.fileSize || (asset.file && asset.file.size) || asset.size || 0,
        mimeType,
        type: 'image',
        domFile: asset.file || null,
        roomCode,
      };
    });

    return this.enqueueFiles(filePayloads);
  }

  /**
   * Capture photo directly with Camera and send/share to peer in queue
   */
  async captureAndSendCamera(roomCode) {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Camera permission is required to capture photos directly');
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const asset = result.assets[0];
    const fileName = asset.fileName || (asset.file && asset.file.name) || `photo_${Date.now()}.jpg`;

    return this.enqueueFiles([
      {
        uri: asset.uri,
        name: fileName,
        size: asset.fileSize || (asset.file && asset.file.size) || asset.size || 0,
        mimeType: asset.mimeType || (asset.file && asset.file.type) || 'image/jpeg',
        type: 'image',
        domFile: asset.file || null,
        roomCode,
      },
    ]);
  }

  /**
   * Pick and send one or multiple Videos in transmission queue
   */
  async pickAndSendVideo(roomCode) {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Permission to access photos and videos is required');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      allowsEditing: false,
      quality: 1,
      shouldDownloadFromNetwork: true, // Handles iOS iCloud videos
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const filePayloads = result.assets.map((asset, index) => {
      let fileName =
        asset.fileName ||
        (asset.file && asset.file.name) ||
        `video_${Date.now()}_${index + 1}.mp4`;
      if (!fileName.includes('.')) {
        const ext =
          asset.mimeType === 'video/quicktime' || asset.uri?.toLowerCase().endsWith('.mov')
            ? '.mov'
            : '.mp4';
        fileName = `${fileName}${ext}`;
      }

      let mimeType = asset.mimeType || (asset.file && asset.file.type);
      if (!mimeType || mimeType === 'application/octet-stream') {
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.mov')) mimeType = 'video/quicktime';
        else if (lower.endsWith('.webm')) mimeType = 'video/webm';
        else if (lower.endsWith('.mkv')) mimeType = 'video/x-matroska';
        else if (lower.endsWith('.3gp')) mimeType = 'video/3gpp';
        else if (lower.endsWith('.avi')) mimeType = 'video/x-msvideo';
        else mimeType = 'video/mp4';
      }

      const fileSize = asset.fileSize || (asset.file && asset.file.size) || asset.size || 0;

      return {
        uri: asset.uri,
        name: fileName,
        size: fileSize,
        mimeType,
        type: 'video',
        domFile: asset.file || null,
        roomCode,
      };
    });

    return this.enqueueFiles(filePayloads);
  }

  /**
   * Universal send file method: enqueues the file to the transmission queue
   */
  async sendFile(fileOptions) {
    const enqueued = this.enqueueFiles([fileOptions]);
    return enqueued[0]?.id;
  }

  /**
   * Stream file chunks across the socket relay with memory-efficient streaming
   */
  async executeSendFile({ id, uri, name, size, mimeType, type, preloadedBase64, domFile, roomCode }) {
    const transferId = id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let activeUri = uri;

    // Ensure activeUri is in a readable location for Expo Go
    if (Platform.OS !== 'web' && activeUri) {
      const cacheDir = (FileSystem.cacheDirectory || '').replace(/\/?$/, '/');
      const docDir = (FileSystem.documentDirectory || '').replace(/\/?$/, '/');

      // Check if URI is outside Expo Go's allowed scoped directories
      const isContentUri = activeUri.startsWith('content://');
      const isOutsideExpoScope =
        activeUri.startsWith('file://') &&
        (!cacheDir || !activeUri.startsWith(cacheDir)) &&
        (!docDir || !activeUri.startsWith(docDir));

      if (isContentUri || isOutsideExpoScope) {
        try {
          const cleanName = (name || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
          const targetCache = `${cacheDir}shared_${Date.now()}_${cleanName}`;

          if (isContentUri) {
            console.log(`[Transfer] Copying content:// URI into scoped cache: ${targetCache}`);
            await FileSystem.copyAsync({ from: activeUri, to: targetCache });
            activeUri = targetCache;
          } else {
            // It is a file:// URI outside Expo Go scope (e.g. DocumentPicker cache)
            console.log(`[Transfer] Reading file outside Expo scope via fetch+FileReader: ${activeUri}`);
            const base64Data = await readUriAsBase64(activeUri, name);
            if (base64Data) {
              await FileSystem.writeAsStringAsync(targetCache, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              activeUri = targetCache;
              console.log(`[Transfer] Relocated file into scoped cache: ${targetCache}`);
            }
          }
        } catch (copyErr) {
          console.warn('[Transfer] Cache migration notice:', copyErr.message);
        }
      }
    }

    // Immediately display the card on sender UI for immediate visual feedback
    this.notifyListeners({
      type: 'send-start',
      item: {
        id: transferId,
        name,
        size: size || 0,
        type,
        mimeType,
        progress: 0,
        status: 'transferring',
        direction: 'outgoing',
        localUri: activeUri,
        dataUri: type === 'image' && preloadedBase64 ? `data:${mimeType};base64,${preloadedBase64}` : null,
      },
    });

    try {
      console.log(`[Transfer] Initiating streaming for ${name} (${type})...`);

      // STREAMING METHOD A: Native Mobile (Low-memory chunk streaming from disk)
      if (Platform.OS !== 'web' && activeUri && activeUri.startsWith('file://')) {
        let actualSize = size;
        if (!actualSize) {
          try {
            const info = await FileSystem.getInfoAsync(activeUri);
            if (info.exists && info.size) actualSize = info.size;
          } catch (_) {}
        }

        const binaryChunkSize = BINARY_SLICE_SIZE;
        const totalChunks = Math.max(1, Math.ceil((actualSize || 1) / binaryChunkSize));

        // Stream slices directly from disk using position and length
        let streamedSuccessfully = false;
        try {
          // Test read first chunk before sending metadata
          const firstChunk = await FileSystem.readAsStringAsync(activeUri, {
            encoding: FileSystem.EncodingType.Base64,
            position: 0,
            length: Math.min(binaryChunkSize, actualSize || binaryChunkSize),
          });

          // If the first chunk succeeded, this URI is readable by FileSystem!
          socketService.sendMetadata({
            id: transferId,
            name,
            size: actualSize || 0,
            mimeType,
            type,
            totalChunks,
            roomCode,
          });

          socketService.sendChunk({
            id: transferId,
            chunkIndex: 0,
            chunk: firstChunk,
            totalChunks,
            roomCode,
          });

          const firstProgress = Math.min(100, Math.round((1 / totalChunks) * 100));
          this.notifyListeners({
            type: 'send-progress',
            item: { id: transferId, progress: firstProgress, status: 'transferring' },
          });

          for (let i = 1; i < totalChunks; i++) {
            const position = i * binaryChunkSize;
            const length = Math.min(binaryChunkSize, actualSize - position);

            const chunk = await FileSystem.readAsStringAsync(activeUri, {
              encoding: FileSystem.EncodingType.Base64,
              position,
              length,
            });

            socketService.sendChunk({
              id: transferId,
              chunkIndex: i,
              chunk,
              totalChunks,
              roomCode,
            });

            const progress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
            this.notifyListeners({
              type: 'send-progress',
              item: { id: transferId, progress, status: 'transferring' },
            });

            if (i % 4 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 8));
            }
          }
          streamedSuccessfully = true;
        } catch (streamErr) {
          console.warn('[Transfer] Chunk-by-chunk disk read fallback:', streamErr.message);
        }

        if (streamedSuccessfully) {
          socketService.sendTransferComplete({ id: transferId, roomCode });
          this.notifyListeners({
            type: 'send-complete',
            item: { id: transferId, progress: 100, status: 'completed', localUri: activeUri },
          });
          console.log(`[Transfer] Completed streaming ${name}`);
          return transferId;
        }
      }

      // STREAMING METHOD B: Web (Low-memory slice streaming via Blob.slice & FileReader)
      if (Platform.OS === 'web') {
        let blob = domFile;
        if (!blob && activeUri) {
          const resp = await fetch(activeUri);
          blob = await resp.blob();
        }

        if (blob) {
          const actualSize = blob.size;
          const binaryChunkSize = BINARY_SLICE_SIZE;
          const totalChunks = Math.max(1, Math.ceil(actualSize / binaryChunkSize));

          socketService.sendMetadata({
            id: transferId,
            name,
            size: actualSize,
            mimeType,
            type,
            totalChunks,
            roomCode,
          });

          for (let i = 0; i < totalChunks; i++) {
            const start = i * binaryChunkSize;
            const end = Math.min(start + binaryChunkSize, actualSize);
            const slice = blob.slice(start, end);

            const chunk = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result;
                const b64 = typeof res === 'string' ? (res.includes(',') ? res.split(',')[1] : res) : '';
                resolve(b64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(slice);
            });

            socketService.sendChunk({
              id: transferId,
              chunkIndex: i,
              chunk,
              totalChunks,
              roomCode,
            });

            const progress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
            this.notifyListeners({
              type: 'send-progress',
              item: { id: transferId, progress, status: 'transferring' },
            });

            if (i % 4 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 8));
            }
          }

          socketService.sendTransferComplete({ id: transferId, roomCode });
          this.notifyListeners({
            type: 'send-complete',
            item: { id: transferId, progress: 100, status: 'completed', localUri: activeUri },
          });
          console.log(`[Transfer] Completed streaming ${name}`);
          return transferId;
        }
      }

      // STREAMING METHOD C: Universal In-Memory Fallback
      const base64Data = preloadedBase64 || (await readUriAsBase64(activeUri, name));
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Could not read file data. Please select another file.');
      }

      const actualSize = size || Math.round((base64Data.length * 3) / 4);
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

      socketService.sendMetadata({
        id: transferId,
        name,
        size: actualSize,
        mimeType,
        type,
        totalChunks,
        roomCode,
      });

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, base64Data.length);
        const chunk = base64Data.substring(start, end);

        socketService.sendChunk({
          id: transferId,
          chunkIndex: i,
          chunk,
          totalChunks,
          roomCode,
        });

        const progress = Math.min(100, Math.round(((i + 1) / totalChunks) * 100));
        this.notifyListeners({
          type: 'send-progress',
          item: { id: transferId, progress, status: 'transferring' },
        });

        if (i % 4 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
      }

      socketService.sendTransferComplete({ id: transferId, roomCode });
      this.notifyListeners({
        type: 'send-complete',
        item: { id: transferId, progress: 100, status: 'completed', localUri: activeUri },
      });

      console.log(`[Transfer] Completed sending ${name}`);
      return transferId;
    } catch (err) {
      console.error(`[Transfer] Error sending file:`, err);
      this.notifyListeners({
        type: 'send-error',
        item: { id: transferId, status: 'failed', error: err.message },
      });
      throw err;
    }
  }

  /**
   * Dedicated download method: direct browser download on Web, save/share prompt on Mobile
   */
  async downloadFile(localUri, fileName, mimeType = null) {
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = localUri;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Native Mobile (Android & iOS)
    let downloadUri = localUri;
    if (downloadUri && downloadUri.startsWith('content://')) {
      const baseDir = (FileSystem.cacheDirectory || '').replace(/\/?$/, '/');
      const safeName = (fileName || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
      const tempPath = `${baseDir}dl_${Date.now()}_${safeName}`;
      await FileSystem.copyAsync({ from: downloadUri, to: tempPath });
      downloadUri = tempPath;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      let resolvedMime = mimeType;
      if (!resolvedMime) {
        const lower = (fileName || '').toLowerCase();
        if (lower.endsWith('.mp4')) resolvedMime = 'video/mp4';
        else if (lower.endsWith('.mov')) resolvedMime = 'video/quicktime';
        else if (lower.endsWith('.webm')) resolvedMime = 'video/webm';
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) resolvedMime = 'image/jpeg';
        else if (lower.endsWith('.png')) resolvedMime = 'image/png';
        else if (lower.endsWith('.pdf')) resolvedMime = 'application/pdf';
        else resolvedMime = 'application/octet-stream';
      }

      await Sharing.shareAsync(downloadUri, {
        mimeType: resolvedMime,
        dialogTitle: fileName ? `Save ${fileName}` : 'Save / Download File',
      });
    }
  }

  /**
   * Open, share, play, or download a file with proper MIME types
   */
  async shareOrOpenFile(localUri, fileName, mimeType = null) {
    if (Platform.OS === 'web') {
      // Direct browser download
      const link = document.createElement('a');
      link.href = localUri;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Native Mobile (Android & iOS)
    let shareUri = localUri;

    // Ensure sharing uses local file:// path
    if (shareUri && shareUri.startsWith('content://')) {
      const baseDir = (FileSystem.cacheDirectory || '').replace(/\/?$/, '/');
      const tempPath = `${baseDir}share_${Date.now()}_${fileName || 'file'}`;
      await FileSystem.copyAsync({ from: shareUri, to: tempPath });
      shareUri = tempPath;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Determine accurate MIME type so native OS offers video players & gallery apps
    let resolvedMime = mimeType;
    if (!resolvedMime) {
      const lower = (fileName || '').toLowerCase();
      if (lower.endsWith('.mp4')) resolvedMime = 'video/mp4';
      else if (lower.endsWith('.mov')) resolvedMime = 'video/quicktime';
      else if (lower.endsWith('.webm')) resolvedMime = 'video/webm';
      else if (lower.endsWith('.mkv')) resolvedMime = 'video/x-matroska';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) resolvedMime = 'image/jpeg';
      else if (lower.endsWith('.png')) resolvedMime = 'image/png';
      else resolvedMime = 'application/octet-stream';
    }

    await Sharing.shareAsync(shareUri, {
      mimeType: resolvedMime,
      dialogTitle: fileName ? `Open or Share ${fileName}` : 'Open or Share File',
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const fileTransferService = new FileTransferService();
