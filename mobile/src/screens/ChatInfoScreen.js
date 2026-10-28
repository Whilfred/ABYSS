import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errMsg, fcfa } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../auth';

// Petit bouton d'action carré (icône + texte), comme sur un profil Telegram
function ActionTile({ icon, text, color, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ width: 92, alignItems: 'center', backgroundColor: colors.bg, borderRadius: 14, paddingVertical: 10, marginHorizontal: 5 }}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={{ color, fontWeight: '600', fontSize: 12, marginTop: 4 }} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  );
}

// Titre de section en couleur d'accent
function SectionTitle({ children, colors }) {
  return (
    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: 8, marginLeft: 4 }}>{children}</Text>
  );
}

export default function ChatInfoScreen({ route, navigation }) {
  const { id, title, type, peerUsername, peerName } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const success = colors.success || '#2E9E3E';
  const danger = colors.danger || '#E53935';

  const [msgs, setMsgs] = useState([]);
  const [peer, setPeer] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    // Charger les messages
    api.get(`/conversations/${id}/messages`).then((r) => setMsgs(r.data.messages)).catch(() => {});

    // Charger les infos du contact (avatar) + état de blocage
    if (type !== 'group' && peerUsername) {
      api.get(`/users/${peerUsername}`).then((res) => {
        setPeer(res.data);
        api.get(`/moderation/blocked/${res.data.id}`).then((r) => setIsBlocked(r.data.is_blocked)).catch(() => {});
      }).catch(() => {});
    }
  }, [id, type, peerUsername]);

  const images = msgs.filter((m) => m.type === 'image');
  const files = msgs.filter((m) => m.type === 'file');
  const links = msgs.filter((m) => m.type === 'text' && m.body && m.body.match(/(https?:\/\/[^\s]+)/g));

  let sentAmount = 0;
  let receivedAmount = 0;
  msgs.forEach((m) => {
    if (m.type === 'money') {
      if (m.sender_id === user.id) sentAmount += Number(m.meta?.amount || 0);
      else receivedAmount += Number(m.meta?.amount || 0);
    }
  });

  const handleBlock = async () => {
    if (!peer) return;
    try {
      if (isBlocked) {
        await api.post('/moderation/unblock', { user_id: peer.id });
        setIsBlocked(false);
        Alert.alert('Succès', 'Utilisateur débloqué.');
      } else {
        Alert.alert('Bloquer cet utilisateur ?', 'Il ne pourra plus vous envoyer de messages.', [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Bloquer', style: 'destructive',
            onPress: async () => {
              try {
                await api.post('/moderation/block', { user_id: peer.id });
                setIsBlocked(true);
                Alert.alert('Succès', 'Utilisateur bloqué.');
              } catch (e) { Alert.alert('Erreur', errMsg(e)); }
            },
          },
        ]);
      }
    } catch (e) { Alert.alert('Erreur', errMsg(e)); }
  };

  const handleReport = async (reason) => {
    if (!peer) return;
    try {
      await api.post('/moderation/report', { user_id: peer.id, reason });
      setShowReport(false);
      Alert.alert('Merci', 'Votre signalement a été transmis.');
    } catch (e) { Alert.alert('Erreur', errMsg(e)); }
  };

  const card = { backgroundColor: colors.surface, borderRadius: 16 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* En-tête du profil */}
      <View style={{ backgroundColor: colors.surface, paddingTop: 24, paddingBottom: 18, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Avatar
          name={title}
          size={96}
          uri={peer?.avatar_url ? SERVER_URL + peer.avatar_url : null}
        />
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 12, color: colors.text }}>{title}</Text>
        {type !== 'group' && peerUsername ? (
          <Text style={{ color: colors.muted, marginTop: 3, fontSize: 14 }}>@{peerUsername}</Text>
        ) : null}

        {/* Actions rapides */}
        <View style={{ flexDirection: 'row', marginTop: 18 }}>
          <ActionTile
            icon="chatbubble-ellipses"
            text="Message"
            color={colors.primary}
            colors={colors}
            onPress={() => navigation.navigate('Chat', { id, title, type, peerUsername, peerName })}
          />
          {type !== 'group' && (
            <>
              <ActionTile
                icon={isBlocked ? 'lock-open' : 'ban'}
                text={isBlocked ? 'Débloquer' : 'Bloquer'}
                color={danger}
                colors={colors}
                onPress={handleBlock}
              />
              <ActionTile
                icon="flag"
                text="Signaler"
                color={colors.muted}
                colors={colors}
                onPress={() => setShowReport(true)}
              />
            </>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 12 }}>

        {/* Transactions */}
        {type !== 'group' && (
          <View style={{ marginTop: 20 }}>
            <SectionTitle colors={colors}>Transactions</SectionTitle>
            <View style={{ ...card, flexDirection: 'row', paddingVertical: 14 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: danger + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up" size={20} color={danger} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Envoyé</Text>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 1 }} numberOfLines={1}>{fcfa(sentAmount)}</Text>
                </View>
              </View>
              <View style={{ width: 0.5, backgroundColor: colors.border }} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: success + '1F', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-down" size={20} color={success} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Reçu</Text>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 1 }} numberOfLines={1}>{fcfa(receivedAmount)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Photos */}
        <View style={{ marginTop: 22 }}>
          <SectionTitle colors={colors}>Photos ({images.length})</SectionTitle>
          <View style={{ ...card, padding: images.length === 0 ? 14 : 10 }}>
            {images.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 14 }}>Aucune photo partagée.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {images.map((img) => (
                  <TouchableOpacity key={img.id} activeOpacity={0.85} onPress={() => setFullImage(SERVER_URL + img.file_url)}>
                    <Image source={{ uri: SERVER_URL + img.file_url }} style={{ width: 96, height: 96, borderRadius: 12, marginRight: 8 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Documents */}
        <View style={{ marginTop: 22 }}>
          <SectionTitle colors={colors}>Documents ({files.length})</SectionTitle>
          <View style={{ ...card, overflow: 'hidden' }}>
            {files.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 14, padding: 14 }}>Aucun document partagé.</Text>
            ) : (
              files.map((f, i) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: colors.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '1F', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="document-text" size={22} color={colors.primary} />
                  </View>
                  <Text style={{ marginLeft: 12, flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{f.file_name}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Liens */}
        <View style={{ marginTop: 22 }}>
          <SectionTitle colors={colors}>Liens partagés ({links.length})</SectionTitle>
          <View style={{ ...card, overflow: 'hidden' }}>
            {links.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 14, padding: 14 }}>Aucun lien partagé.</Text>
            ) : (
              links.map((l, i) => {
                const url = l.body.match(/(https?:\/\/[^\s]+)/g)[0];
                return (
                  <TouchableOpacity
                    key={l.id}
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(url).catch(() => {})}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: i === 0 ? 0 : 0.5, borderTopColor: colors.border }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '1F', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="link" size={20} color={colors.primary} />
                    </View>
                    <Text style={{ marginLeft: 12, flex: 1, color: colors.primary, fontSize: 14 }} numberOfLines={1}>{url}</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </View>

      {/* Photo en grand */}
      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10, padding: 6 }}
            onPress={() => setFullImage(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {fullImage && <Image source={{ uri: fullImage }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Signalement */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowReport(false)} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Pourquoi signalez-vous cet utilisateur ?</Text>
            {['Spam / Publicité', 'Harcèlement', 'Contenu inapproprié', 'Arnaque / Fraude', 'Autre'].map((reason) => (
              <TouchableOpacity key={reason} onPress={() => handleReport(reason)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>{reason}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowReport(false)} style={{ marginTop: 14, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 15 }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
