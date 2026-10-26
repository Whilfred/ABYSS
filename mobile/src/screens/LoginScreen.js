import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Input } from '../components/UI';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const go = async () => {
    setLoading(true);
    try { await login({ identifier, password }); } catch (e) { Alert.alert('Connexion', errMsg(e)); } finally { setLoading(false); }
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <Text style={{ fontSize: 44, fontWeight: '900', color: colors.primary, letterSpacing: 4 }}>ABYSS</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>Discutez. Envoyez de l'argent. Simplement.</Text>
        </View>
        <Input label="Nom d'utilisateur ou téléphone" value={identifier} onChangeText={setIdentifier} placeholder="@pseudo ou +226…" />
        <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Se connecter" onPress={go} loading={loading} disabled={!identifier || !password} />
        <Button title="Créer un compte" variant="ghost" onPress={() => navigation.navigate('Register')} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
