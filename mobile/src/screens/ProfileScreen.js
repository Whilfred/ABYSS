import React, { useState, useLayoutEffect } from 'react';
import { Alert, ScrollView, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { useTheme } from '../ThemeContext';
import { SERVER_URL } from '../config';

const COVER_HEIGHT = 160;
const AVATAR_SIZE = 112;

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  const success = colors.success || '#12B76A';

  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const digits = (set) => (t) => set(t.replace(/\D/g, '').slice(0, 4));
  const c = byCode(user.country);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: user.display_name,
      headerShadowVisible: false,
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginRight: 16, padding: 4 }}>
          <Ionicons name="settings-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors, user.display_name]);

  const changeAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1],
      });
      if (result.canceled) return;
      setUploadingAvatar(true);
      const file = result.assets[0];
      const formData = new FormData();
      formData.append('fichier', {
        uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });
      const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.post('/users/avatar', { avatar_url: uploadRes.data.url });
      await refreshUser();
    } catch (e) {
      Alert.alert('Photo de profil', errMsg(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const savePin = async () => {
    if (pin !== confirm) return Alert.alert('Code PIN', 'Les deux codes ne correspondent pas.');
    setLoading(true);
    try {
      await api.post('/wallet/pin', { pin, current_pin: current });
      await refreshUser();
      setCurrent(''); setPin(''); setConfirm(''); setPinOpen(false);
      Alert.alert('Code PIN', 'Votre code PIN est enregistré.');
    } catch (e) {
      Alert.alert('Code PIN', errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert('Se déconnecter', 'Voulez-vous vraiment quitter ABYSS sur cet appareil ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: logout },
    ]);

  // --- Petits composants internes ---
  const Section = ({ title, children }) => (
    <View style={{ marginTop: 22, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 10 }}>{title}</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden' }}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, value, onPress, right, last, danger }) => (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
      }}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: danger ? colors.danger + '1A' : colors.primary + '1A',
      }}>
        <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 16, fontWeight: '600' }}>{label}</Text>
        {value ? <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{value}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Couverture */}
      <View style={{ height: COVER_HEIGHT, backgroundColor: colors.primary, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -50, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.10)' }} />
        <View style={{ position: 'absolute', right: 70, bottom: -90, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', left: -40, bottom: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(0,0,0,0.08)' }} />
      </View>

      {/* Avatar à cheval sur la couverture */}
      <View style={{ paddingHorizontal: 16, marginTop: -(AVATAR_SIZE / 2) }}>
        <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar} activeOpacity={0.85} style={{ alignSelf: 'flex-start' }}>
          <View style={{ padding: 4, backgroundColor: colors.bg, borderRadius: (AVATAR_SIZE + 8) / 2 }}>
            <Avatar
              name={user.display_name}
              size={AVATAR_SIZE}
              uri={user.avatar_url ? SERVER_URL + user.avatar_url : null}
            />
          </View>
          <View style={{
            position: 'absolute', bottom: 6, right: 2, width: 34, height: 34, borderRadius: 17,
            backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.bg,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={uploadingAvatar ? 'hourglass-outline' : 'camera'} size={17} color={colors.text} />
          </View>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginTop: 10 }}>{user.display_name}</Text>
        <Text style={{ fontSize: 16, color: colors.muted, marginTop: 2 }}>@{user.username}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Ionicons name="location-sharp" size={16} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 15, marginLeft: 4 }}>{c.flag} {c.name}</Text>
        </View>
      </View>

      {/* Actions principales */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 18, gap: 10 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Portefeuille')}
          activeOpacity={0.85}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10 }}
        >
          <Ionicons name="wallet" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Mon portefeuille</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={changeAvatar}
          activeOpacity={0.85}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, paddingVertical: 12, borderRadius: 10 }}
        >
          <Ionicons name="pencil" size={17} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>Changer la photo</Text>
        </TouchableOpacity>
      </View>

      {/* Informations */}
      <Section title="Informations">
        <Row icon="person-outline" label="Nom d'utilisateur" value={`@${user.username}`} />
        <Row icon="call-outline" label="Téléphone" value={user.phone} />
        <Row icon="flag-outline" label="Pays" value={`${c.flag} ${c.name}`} last />
      </Section>

      {/* Sécurité */}
      <Section title="Sécurité">
        <Row
          icon="lock-closed-outline"
          label="Code PIN du portefeuille"
          value={user.has_pin ? 'Protège vos envois et retraits' : 'À créer pour envoyer ou retirer de l\'argent'}
          onPress={() => setPinOpen((o) => !o)}
          last={!pinOpen}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                backgroundColor: (user.has_pin ? success : colors.danger) + '1F',
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6,
              }}>
                <Text style={{ color: user.has_pin ? success : colors.danger, fontWeight: '700', fontSize: 12 }}>
                  {user.has_pin ? 'Activé' : 'Non défini'}
                </Text>
              </View>
              <Ionicons name={pinOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </View>
          }
        />
        {pinOpen ? (
          <View style={{ padding: 14 }}>
            {user.has_pin ? (
              <Input label="PIN actuel" value={current} onChangeText={digits(setCurrent)} keyboardType="number-pad" secureTextEntry />
            ) : null}
            <Input label="Nouveau PIN (4 chiffres)" value={pin} onChangeText={digits(setPin)} keyboardType="number-pad" secureTextEntry />
            <Input label="Confirmer le PIN" value={confirm} onChangeText={digits(setConfirm)} keyboardType="number-pad" secureTextEntry />
            <Button
              title={user.has_pin ? 'Modifier le PIN' : 'Créer le PIN'}
              onPress={savePin}
              loading={loading}
              disabled={pin.length !== 4 || confirm.length !== 4 || (user.has_pin && current.length !== 4)}
            />
          </View>
        ) : null}
      </Section>

      {/* Compte */}
      <Section title="Compte">
        <Row icon="settings-outline" label="Paramètres" onPress={() => navigation.navigate('Settings')}
          right={<Ionicons name="chevron-forward" size={20} color={colors.muted} />} />
        <Row icon="log-out-outline" label="Se déconnecter" onPress={confirmLogout} danger last />
      </Section>

      <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 26 }}>ABYSS · Version 1.0.0</Text>
    </ScrollView>
  );
}
