import React, { useState, useLayoutEffect } from 'react';
import { Alert, ScrollView, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // <-- IMPORT
import { Avatar, Button, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { useTheme } from '../ThemeContext';
import { SERVER_URL } from '../config'; // <-- IMPORT

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const digits = (set) => (t) => set(t.replace(/\D/g, '').slice(0, 4));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Profil',
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Settings')} 
          style={{ marginRight: 16, padding: 4 }}
        >
          <Ionicons name="settings-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // --- NOUVELLE FONCTION : Changer la photo de profil ---
  const changeAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images'], 
        quality: 0.6,
        allowsEditing: true,
        aspect: [1, 1]
      });

      if (!result.canceled) {
        setUploadingAvatar(true);
        const file = result.assets[0];
        const formData = new FormData();
        formData.append('fichier', {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: 'avatar.jpg',
          type: 'image/jpeg',
        });

        // 1. Upload de l'image
        const uploadRes = await api.post('/upload', formData, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });

        // 2. Sauvegarde de l'URL dans le profil
        await api.post('/users/avatar', { avatar_url: uploadRes.data.url });
        
        // 3. Recharger les infos de l'utilisateur pour afficher la nouvelle photo
        await refreshUser(); 
        Alert.alert('Succès', 'Photo de profil mise à jour !');
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        
        {/* Avatar Cliquable */}
        <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar} activeOpacity={0.8}>
          <Avatar 
            name={user.display_name} 
            size={90} 
            uri={user.avatar_url ? SERVER_URL + user.avatar_url : null} 
          />
          <View style={{ 
            position: 'absolute', bottom: 0, right: 0, 
            backgroundColor: colors.primary, borderRadius: 16, 
            padding: 6, borderWidth: 2, borderColor: colors.bg 
          }}>
            <Ionicons name={uploadingAvatar ? "hourglass" : "camera"} size={16} color="#fff" />
          </View>
        </TouchableOpacity>

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

      <TouchableOpacity 
        onPress={logout} 
        style={{ 
          marginTop: 30, backgroundColor: colors.surface, padding: 16, borderRadius: 12, 
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: colors.border
        }}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
        <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Se déconnecter</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}
