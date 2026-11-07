import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Server, Lightbulb, XCircle, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';

export default function ServerUrlModal({ visible, currentUrl, onClose, onSave }) {
  const [url, setUrl] = useState(currentUrl || 'http://localhost:4000');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Always keep input synchronized with the currently loaded/saved server URL
  useEffect(() => {
    if (visible && currentUrl) {
      setUrl(currentUrl);
      setTestResult(null);
    }
  }, [visible, currentUrl]);

  const cleanUrlString = (raw) => {
    let clean = (raw || '').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  };

  const handleTestConnection = async () => {
    if (!url || !url.trim()) return;
    const target = cleanUrlString(url);

    setTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const startTime = Date.now();

    try {
      const res = await fetch(`${target}/api/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          success: true,
          message: `Reachable! (${elapsed}ms) • ${data.message || 'Relay Server Active'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}`,
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      setTestResult({
        success: false,
        message: isTimeout
          ? 'Timeout (4.5s). Ensure phone is on same Wi-Fi and firewall port 4000 is open.'
          : `Unreachable: ${err.message || 'Network request failed'}. Check Wi-Fi & IP.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (url && url.trim()) {
      const clean = cleanUrlString(url);
      onSave(clean);
      onClose();
    }
  };

  const handleSetLocalhost = () => {
    setUrl('http://localhost:4000');
    setTestResult(null);
  };

  const isLocalhostOnMobile = Platform.OS !== 'web' && (url.includes('localhost') || url.includes('127.0.0.1'));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Server size={20} color="#38BDF8" />
            </View>
            <View style={styles.headerCol}>
              <Text style={styles.title}>Relay Server Connection</Text>
              <Text style={styles.subtitle}>
                Configure your Raspberry Pi or computer's local IP address.
              </Text>
            </View>
          </View>

          {isLocalhostOnMobile ? (
            <View style={styles.warningBox}>
              <AlertCircle size={15} color="#F87171" style={styles.tipIcon} />
              <Text style={styles.warningText}>
                <Text style={styles.bold}>"localhost" points to your phone!</Text> Replace it with your computer or Raspberry Pi's LAN IP address (e.g. <Text style={styles.bold}>http://192.168.1.X:4000</Text>).
              </Text>
            </View>
          ) : (
            <View style={styles.tipBox}>
              <Lightbulb size={16} color="#FBBF24" style={styles.tipIcon} />
              <Text style={styles.tipText}>
                On mobile, enter your machine's LAN IP address (e.g.{' '}
                <Text style={styles.bold}>http://192.168.1.X:4000</Text>). Ensure both devices are on the same Wi-Fi!
              </Text>
            </View>
          )}

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={url}
              onChangeText={(val) => {
                setUrl(val);
                setTestResult(null);
              }}
              placeholder="http://192.168.1.X:4000"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {url && url.length > 0 ? (
              <TouchableOpacity onPress={() => { setUrl(''); setTestResult(null); }} style={styles.inputClearBtn}>
                <XCircle size={18} color="#64748B" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Test Connection Button & Result Banner */}
          <View style={styles.testRow}>
            <TouchableOpacity
              style={[styles.testBtn, testing && styles.testBtnDisabled]}
              onPress={handleTestConnection}
              disabled={testing || !url.trim()}
              activeOpacity={0.7}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <>
                  <RefreshCw size={13} color="#38BDF8" />
                  <Text style={styles.testBtnText}>Test Connection</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.presetRow}>
              <Text style={styles.presetLabel}>Quick:</Text>
              <TouchableOpacity onPress={handleSetLocalhost} style={styles.presetPill}>
                <Text style={styles.presetPillText}>localhost:4000</Text>
              </TouchableOpacity>
            </View>
          </View>

          {testResult && (
            <View style={[styles.resultBanner, testResult.success ? styles.resultSuccess : styles.resultError]}>
              {testResult.success ? (
                <CheckCircle2 size={14} color="#4ADE80" />
              ) : (
                <AlertCircle size={14} color="#F87171" />
              )}
              <Text style={[styles.resultText, testResult.success ? styles.resultTextSuccess : styles.resultTextError]}>
                {testResult.message}
              </Text>
            </View>
          )}

          <View style={styles.currentActiveRow}>
            <ShieldCheck size={12} color="#38BDF8" />
            <Text style={styles.currentActiveText} numberOfLines={1}>
              Active: {currentUrl || 'http://localhost:4000'}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <CheckCircle2 size={16} color="#0F172A" />
              <Text style={styles.saveBtnText}>Save & Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCol: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  tipBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 17,
    flex: 1,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipText: {
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 17,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 40,
    color: '#F8FAFC',
    fontSize: 14,
  },
  inputClearBtn: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  testBtnDisabled: {
    opacity: 0.6,
  },
  testBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  resultSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  resultError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resultText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  resultTextSuccess: {
    color: '#4ADE80',
    fontWeight: '600',
  },
  resultTextError: {
    color: '#FCA5A5',
    fontWeight: '500',
  },
  currentActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  currentActiveText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  presetLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  presetPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  presetPillText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
});
