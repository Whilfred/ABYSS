import React, { useState, useLayoutEffect } from 'react';
import { Alert, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { useTheme } from '../ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const digits = (set) => (t) => set(t.replace(/\D/g, '').slice(0, 4));

  // Modification ici : on s'assure que le bouton s'affiche bien
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Profil', // On force le titre
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Settings')} 
          style={{ marginRight: 16, padding: 4 }} // Un peu de padding pour faciliter le clic
        >
          <Ionicons name="settings-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const save = async () => {
    if (pin !== confirm) return Alert.alert('PIN', 'Les deux codes ne correspondent pas.');
    setLoading(true);
    try {
      await api.post('/wallet/pin', { pin, current_pin: current });
      await refreshUser(); setCurrent(''); setPin(''); setConfirm('');
      Alert.alert('PIN', 'Votre code PIN est enregistré.');
    } catch (e) { Alert.alert('PIN', errMsg(e)); } finally { setLoading(false); }
  };
  
  const c = byCode(user.country);

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ backgroundColor: colors.bg }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Avatar name={user.display_name} size={80} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 10 }}>{user.display_name}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>@{user.username}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{c.flag} {c.name} · {user.phone}</Text>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
        🔒 {user.has_pin ? 'Changer le code PIN' : 'Créer le code PIN du portefeuille'}
      </Text>
      
      {user.has_pin ? (
        <Input label="PIN actuel" value={current} onChangeText={digits(setCurrent)} keyboardType="number-pad" secureTextEntry />
      ) : null}
      
      <Input label="Nouveau PIN (4 chiffres)" value={pin} onChangeText={digits(setPin)} keyboardType="number-pad" secureTextEntry />
      <Input label="Confirmer le PIN" value={confirm} onChangeText={digits(setConfirm)} keyboardType="number-pad" secureTextEntry />
      
      <Button 
        title="Enregistrer le PIN" 
        onPress={save} 
        loading={loading} 
        disabled={pin.length !== 4 || confirm.length !== 4 || (user.has_pin && current.length !== 4)} 
      />

      {/* Bouton de déconnexion */}
      <TouchableOpacity 
        onPress={logout} 
        style={{ 
          marginTop: 30, 
          backgroundColor: colors.surface, 
          padding: 16, 
          borderRadius: 12, 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Se déconnecter</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}
