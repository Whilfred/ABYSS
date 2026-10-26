import React from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../auth';

export default function SettingsScreen() {
  const { isDark, colors, toggleTheme } = useTheme();
  const { logout } = useAuth();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: 20 }}>
      
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted, marginBottom: 10, textTransform: 'uppercase' }}>Apparence</Text>
      
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 16, marginLeft: 12, fontWeight: '600' }}>Mode Sombre</Text>
        </View>
        <Switch 
          value={isDark} 
          onValueChange={toggleTheme} 
          trackColor={{ false: colors.border, true: colors.primary }} 
          thumbColor="#fff"
        />
      </View>

      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.muted, marginBottom: 10, textTransform: 'uppercase' }}>Compte</Text>

      <TouchableOpacity 
        onPress={logout}
        style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
      >
        <Ionicons name="log-out" size={24} color={colors.danger} />
        <Text style={{ color: colors.danger, fontSize: 16, marginLeft: 12, fontWeight: '600' }}>Se déconnecter</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}
