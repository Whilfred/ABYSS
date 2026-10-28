import React, { useState, useLayoutEffect } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { useTheme } from '../ThemeContext';
import { SERVER_URL } from '../config';

const softShadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 };

const AVATAR_SIZE = 88;

/* ------------------------------------------------------------------ */
/*  Composants définis HORS de l'écran : sinon ils sont recréés à       */
/*  chaque frappe et le clavier se ferme dans les champs du PIN.        */
/* ------------------------------------------------------------------ */

function Section({ title, footer, children, P }) {
  return (
    <View style={{ marginTop: 24, marginHorizontal: 16 }}>
      {title ? <Text style={{ color: P.ink, fontSize: 16, fontWeight: '800', marginBottom: 10, marginLeft: 4 }}>{title}</Text> : null}
      <View style={{ backgroundColor: P.card, borderRadius: 22, overflow: 'hidden', ...softShadow }}>{children}</View>
      {footer ? <Text style={{ color: P.muted, fontSize: 13, lineHeight: 18, marginTop: 8, marginHorizontal: 6 }}>{footer}</Text> : null}
    </View>
  );
}

// Icône cerclée : contour fin, ni carré coloré ni aplat
function Ring({ icon, color, size = 38 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

function Row({ icon, label, value, onPress, right, last, danger, P }) {
  const tone = danger ? P.bad : P.link;
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
      <Ring icon={icon} color={tone} />
      <View
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 14, paddingVertical: 14, paddingRight: 16,
          borderBottomWidth: last ? 0 : 1, borderBottomColor: P.line,
        }}
      >
        <View style={{ flex: 1 }}>
          {value !== undefined ? <Text style={{ color: P.muted, fontSize: 12 }}>{label}</Text> : null}
          <Text style={{ color: danger ? P.bad : P.ink, fontSize: 16, fontWeight: value !== undefined ? '600' : '600', marginTop: value !== undefined ? 1 : 0 }}>
            {value !== undefined ? (value || '—') : label}
          </Text>
        </View>
        {right}
      </View>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ */

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  // Couleurs directement issues du thème de la plateforme (bleu par défaut)
  const P = {
    page: colors.bg,
    card: colors.surface,
    ink: colors.text,
    muted: colors.muted,
    line: colors.border,
    primary: colors.primary,
    link: colors.primary,
    ok: colors.success || '#12B76A',
    bad: colors.danger || '#F04438',
  };
  const headerHeight = useHeaderHeight();

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
      headerTitle: '',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: P.page },
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ marginRight: 16, padding: 4 }}>
          <Ionicons name="settings-outline" size={24} color={P.link} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, P]);

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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.page }} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {/* Carte d'identité : anneaux concentriques comme des ondes dans l'eau */}
        <View style={{ marginHorizontal: 16, marginTop: 4, backgroundColor: P.primary, borderRadius: 28, overflow: 'hidden', ...softShadow, shadowOpacity: 0.18 }}>
          {[260, 190, 120].map((s, i) => (
            <View
              key={s}
              style={{
                position: 'absolute', right: -s / 2 + 20, top: -s / 2 + 30, width: s, height: s, borderRadius: s / 2,
                borderWidth: 1.5, borderColor: `rgba(255,255,255,${0.12 - i * 0.025})`,
              }}
            />
          ))}

          <View style={{ padding: 22, flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar} activeOpacity={0.85}>
              <View style={{ padding: 3, borderRadius: (AVATAR_SIZE + 6) / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }}>
                <Avatar name={user.display_name} size={AVATAR_SIZE} uri={user.avatar_url ? SERVER_URL + user.avatar_url : null} />
                {uploadingAvatar ? (
                  <View style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: AVATAR_SIZE / 2, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </View>
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: P.primary }}>
                <Ionicons name="camera" size={14} color={P.primary} />
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={{ color: '#fff', fontSize: 23, fontWeight: '800' }} numberOfLines={2}>{user.display_name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginTop: 3 }}>@{user.username}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 6 }}>{c.flag} {c.name}</Text>
            </View>
          </View>
        </View>

        {/* Portefeuille : l'action principale */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Portefeuille')}
          activeOpacity={0.85}
          style={{ marginHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: P.card, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, ...softShadow }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: P.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: P.ink, fontSize: 17, fontWeight: '800' }}>Mon portefeuille</Text>
            <Text style={{ color: P.muted, fontSize: 13, marginTop: 2 }}>Envoyer, recevoir, retirer</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={P.primary} />
        </TouchableOpacity>

        {/* Informations */}
        <Section title="Informations" P={P}>
          <Row icon="call-outline" label="Téléphone" value={user.phone} P={P} />
          <Row icon="at" label="Nom d'utilisateur" value={`@${user.username}`} P={P} />
          <Row icon="flag-outline" label="Pays" value={`${c.flag} ${c.name}`} last P={P} />
        </Section>

        {/* Sécurité */}
        <Section
          title="Sécurité"
          footer={user.has_pin ? 'Le code PIN protège vos envois et vos retraits.' : "Créez un code PIN pour envoyer ou retirer de l'argent."}
          P={P}
        >
          <Row
            icon="lock-closed-outline"
            label="Code PIN du portefeuille"
            onPress={() => setPinOpen((o) => !o)}
            last={!pinOpen}
            P={P}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: user.has_pin ? P.ok : P.bad, marginRight: 6 }} />
                <Text style={{ color: user.has_pin ? P.ok : P.bad, fontSize: 14, fontWeight: '600', marginRight: 6 }}>
                  {user.has_pin ? 'Activé' : 'Non défini'}
                </Text>
                <Ionicons name={pinOpen ? 'chevron-up' : 'chevron-down'} size={18} color={P.muted} />
              </View>
            }
          />
          {pinOpen ? (
            <View style={{ padding: 16 }}>
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
        <Section title="Compte" P={P}>
          <Row
            icon="settings-outline"
            label="Paramètres"
            onPress={() => navigation.navigate('Settings')}
            P={P}
            right={<Ionicons name="chevron-forward" size={18} color={P.muted} />}
          />
          <Row icon="log-out-outline" label="Se déconnecter" onPress={confirmLogout} danger last P={P} />
        </Section>

        <Text style={{ textAlign: 'center', color: P.muted, fontSize: 12, marginTop: 28 }}>ABYSS · Version 1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
