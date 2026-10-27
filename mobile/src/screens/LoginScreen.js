import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View, Image } from 'react-native';
import { Button, Input } from '../components/UI';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { useTheme } from '../ThemeContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const go = async () => {
    setLoading(true);
    try { await login({ identifier, password }); } 
    catch (e) { Alert.alert('Connexion', errMsg(e)); } 
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          {/* LOGO DE L'APPLICATION */}
          <Image 
            source={require('../../assets/logo.jpg')} 
            style={{ width: 140, height: 140, resizeMode: 'contain', marginBottom: 10 }} 
          />
          <Text style={{ color: colors.muted, marginTop: 6, fontSize: 15, textAlign: 'center' }}>
            Discutez. Envoyez de l'argent. Simplement.
          </Text>
        </View>

        <Input label="Nom d'utilisateur ou téléphone" value={identifier} onChangeText={setIdentifier} placeholder="@pseudo ou +226…" />
        <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        
        <Button title="Se connecter" onPress={go} loading={loading} disabled={!identifier || !password} />
        <Button title="Créer un compte" variant="ghost" onPress={() => navigation.navigate('Register')} style={{ marginTop: 10 }} />
      
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
