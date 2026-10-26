import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Avatar, Button, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const digits = (set) => (t) => set(t.replace(/\D/g, '').slice(0, 4));
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
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ backgroundColor: '#fff' }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Avatar name={user.display_name} size={80} />
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 10 }}>{user.display_name}</Text>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>@{user.username}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{c.flag} {c.name} · {user.phone}</Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
        🔒 {user.has_pin ? 'Changer le code PIN' : 'Créer le code PIN du portefeuille'}
      </Text>
      {user.has_pin ? <Input label="PIN actuel" value={current} onChangeText={digits(setCurrent)} keyboardType="number-pad" secureTextEntry /> : null}
      <Input label="Nouveau PIN (4 chiffres)" value={pin} onChangeText={digits(setPin)} keyboardType="number-pad" secureTextEntry />
      <Input label="Confirmer le PIN" value={confirm} onChangeText={digits(setConfirm)} keyboardType="number-pad" secureTextEntry />
      <Button title="Enregistrer le PIN" onPress={save} loading={loading} disabled={pin.length !== 4 || confirm.length !== 4 || (user.has_pin && current.length !== 4)} />
      <Button title="Se déconnecter" variant="ghost" onPress={logout} style={{ marginTop: 28 }} />
    </ScrollView>
  );
}
