import React from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../ThemeContext'; // <-- IMPORT DU THEME

export function Button({ title, onPress, loading, disabled, variant = 'solid', style }) {
  const { colors } = useTheme();
  const solid = variant === 'solid';
  
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} activeOpacity={0.8}
      style={[{ backgroundColor: solid ? colors.primary : colors.surface, paddingVertical: 14, borderRadius: 12,
        alignItems: 'center', opacity: disabled ? 0.5 : 1, borderWidth: solid ? 0 : 1, borderColor: colors.border }, style]}>
      {loading ? <ActivityIndicator color={solid ? '#fff' : colors.primary} />
        : <Text style={{ color: solid ? '#fff' : colors.primary, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Input({ label, style, ...props }) {
  const { colors } = useTheme();
  
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: colors.muted, marginBottom: 6, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} autoCapitalize="none"
        style={[{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border }, style]} {...props} />
    </View>
  );
}

// --- MODIFIÉ : Prise en charge de la photo de profil ---
export function Avatar({ name = '?', size = 48, uri }) {
  const { colors } = useTheme();
  
  if (uri) {
    return (
      <Image 
        source={{ uri }} 
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }} 
      />
    );
  }
  
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8, marginBottom: 8,
      backgroundColor: active ? colors.primary : colors.surface, borderWidth: active ? 0 : 1, borderColor: colors.border }}>
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
