import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Hash, Clipboard, Zap, XCircle } from 'lucide-react-native';
import * as ClipboardModule from 'expo-clipboard';

export default function PinCodeInput({ code, onChangeCode, onSubmit, isLoading, onCancel }) {
  const inputRef = useRef(null);
  const digits = code.padEnd(4, ' ').split('').slice(0, 4);

  const handlePaste = async () => {
    try {
      const text = await ClipboardModule.getStringAsync();
      const clean = text.replace(/[^0-9]/g, '').slice(0, 4);
      if (clean) {
        onChangeCode(clean);
        if (clean.length === 4 && onSubmit) {
          onSubmit(clean);
        }
      }
    } catch (_) {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.topIconCircle}>
        <Hash size={32} color="#C084FC" />
      </View>

      <Text style={styles.heading}>Enter 4-Digit Code</Text>
      <Text style={styles.instruction}>
        Enter the sender's 4-digit temporary code or their permanent room number:
      </Text>

      {/* Hidden/Overlay Native Input for robust keyboard handling */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={styles.boxesRow}
      >
        {digits.map((digit, index) => {
          const isFilled = digit.trim().length > 0;
          const isCurrent = code.length === index;

          return (
            <View
              key={index}
              style={[
                styles.pinBox,
                isFilled ? styles.filledBox : null,
                isCurrent ? styles.activeBox : null,
              ]}
            >
              <Text style={styles.digitText}>{digit.trim() ? digit : ''}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(text) => {
          const numeric = text.replace(/[^0-9]/g, '').slice(0, 4);
          onChangeCode(numeric);
          if (numeric.length === 4 && onSubmit) {
            onSubmit(numeric);
          }
        }}
        keyboardType="number-pad"
        maxLength={4}
        style={styles.hiddenInput}
        autoFocus
      />

      {/* Quick Paste from Clipboard button */}
      <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} activeOpacity={0.7}>
        <Clipboard size={14} color="#C084FC" />
        <Text style={styles.pasteBtnText}>Paste from Clipboard</Text>
      </TouchableOpacity>

      {/* Connect Button */}
      <TouchableOpacity
        style={[
          styles.connectBtn,
          code.length === 4 && !isLoading ? styles.btnActive : styles.btnDisabled,
        ]}
        disabled={code.length !== 4 || isLoading}
        onPress={() => onSubmit(code)}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="#0F172A" />
        ) : (
          <>
            <Zap size={16} color="#0F172A" />
            <Text style={styles.connectBtnText}>Connect & Start Transfer</Text>
          </>
        )}
      </TouchableOpacity>

      {onCancel ? (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <XCircle size={16} color="#94A3B8" />
          <Text style={styles.cancelText}>Cancel & Go Back</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  topIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  instruction: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  pinBox: {
    width: 58,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledBox: {
    borderColor: '#C084FC',
    backgroundColor: 'rgba(192, 132, 252, 0.05)',
  },
  activeBox: {
    borderColor: '#A855F7',
    borderWidth: 2.5,
  },
  digitText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#C084FC',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 20,
  },
  pasteBtnText: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '700',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  btnActive: {
    backgroundColor: '#C084FC',
  },
  btnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  connectBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
