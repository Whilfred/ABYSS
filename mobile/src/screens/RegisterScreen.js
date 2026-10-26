import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Input } from '../components/UI';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { COUNTRIES, byCode } from '../countries';
import { colors } from '../theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [country, setCountry] = useState('BF');
  const [f, setF] = useState({ display_name: '', username: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const c = byCode(country);
  const go = async () => {
    setLoading(true);
    try {
      await register({ ...f, country, username: f.username.replace('@', ''), phone: c.dial + f.phone.replace(/\D/g, '') });
    } catch (e) { Alert.alert('Inscription', errMsg(e)); } finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: '#fff' }}>
      <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 8 }}>Pays</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {COUNTRIES.map((x) => <Chip key={x.code} label={`${x.flag} ${x.name}`} active={country === x.code} onPress={() => setCountry(x.code)} />)}
      </View>
      <Input label="Nom affiché" value={f.display_name} onChangeText={set('display_name')} autoCapitalize="words" placeholder="Awa Traoré" />
      <Input label="Nom d'utilisateur unique" value={f.username} onChangeText={set('username')} placeholder="awa_t" />
      <Input label={`Téléphone (${c.dial})`} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="70 00 00 00" />
      <Input label="Mot de passe (6+ caractères)" value={f.password} onChangeText={set('password')} secureTextEntry />
      <Button title="Créer mon compte" onPress={go} loading={loading}
        disabled={!f.display_name || !f.username || !f.phone || f.password.length < 6} />
    </ScrollView>
  );
}
