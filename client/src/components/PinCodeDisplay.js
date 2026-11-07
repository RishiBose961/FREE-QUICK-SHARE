import React, { useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Radio, Copy, CheckCircle2, XCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

export default function PinCodeDisplay({ pinCode, onCancel }) {
  const digits = pinCode ? pinCode.split('') : ['-', '-', '-', '-'];
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (pinCode) {
      try {
        await Clipboard.setStringAsync(pinCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_) {}
    }
  };

  return (
    <View style={styles.container}>
      {/* Header icon badge */}
      <View style={styles.topIconCircle}>
        <Radio size={32} color="#38BDF8" />
      </View>

      <Text style={styles.heading}>Room PIN Created</Text>
      <Text style={styles.instruction}>
        Share this 4-digit code with the receiver device or have them enter it in "Receive Files":
      </Text>

      {/* 4 Digit Boxes */}
      <View style={styles.boxesRow}>
        {digits.map((digit, index) => (
          <View key={index} style={styles.pinBox}>
            <Text style={styles.digitText}>{digit}</Text>
          </View>
        ))}
      </View>

      {/* Quick Copy Button */}
      <TouchableOpacity
        style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        {copied ? (
          <CheckCircle2 size={16} color="#22C55E" />
        ) : (
          <Copy size={16} color="#38BDF8" />
        )}
        <Text style={[styles.copyBtnText, copied && styles.copyBtnTextSuccess]}>
          {copied ? 'Code Copied to Clipboard!' : 'Copy Code to Clipboard'}
        </Text>
      </TouchableOpacity>

      {/* Waiting Radar Indicator */}
      <View style={styles.waitingContainer}>
        <ActivityIndicator size="small" color="#38BDF8" />
        <Text style={styles.waitingText}>Waiting for receiver to connect...</Text>
      </View>

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
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
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
    marginBottom: 18,
  },
  pinBox: {
    width: 58,
    height: 68,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  digitText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38BDF8',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    marginBottom: 16,
  },
  copyBtnSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  copyBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  copyBtnTextSuccess: {
    color: '#4ADE80',
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  waitingText: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
