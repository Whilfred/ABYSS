import React from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

export function Button({ title, onPress, loading, disabled, variant = 'solid', style }) {
  const solid = variant === 'solid';
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} activeOpacity={0.8}
      style={[{ backgroundColor: solid ? colors.primary : colors.surface, paddingVertical: 14, borderRadius: 12,
        alignItems: 'center', opacity: disabled ? 0.5 : 1 }, style]}>
      {loading ? <ActivityIndicator color={solid ? '#fff' : colors.primary} />
        : <Text style={{ color: solid ? '#fff' : colors.primary, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Input({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: colors.muted, marginBottom: 6, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} autoCapitalize="none"
        style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }, style]} {...props} />
    </View>
  );
}

export function Avatar({ name = '?', size = 48 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8, marginBottom: 8,
      backgroundColor: active ? colors.primary : colors.surface }}>
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
