import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg, fcfa } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext'; 
import { useAuth } from '../auth';

export default function ChatInfoScreen({ route, navigation }) {
  const { id, title, type, peerUsername, peerName } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [msgs, setMsgs] = useState([]);
  const [peer, setPeer] = useState(null); // <-- NOUVEAU : Stocke les infos du contact
  const [isBlocked, setIsBlocked] = useState(false);
  const [fullImage, setFullImage] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    // Charger les messages
    api.get(`/conversations/${id}/messages`).then((r) => setMsgs(r.data.messages)).catch(() => {});
    
    // Charger les infos du contact (pour l'avatar)
    if (type !== 'group' && peerUsername) {
      api.get(`/users/${peerUsername}`).then((res) => {
        setPeer(res.data);
        // Vérifier le blocage en même temps
        api.get(`/moderation/blocked/${res.data.id}`).then((r) => setIsBlocked(r.data.is_blocked)).catch(() => {});
      }).catch(() => {});
    }
  }, [id, type, peerUsername]);

  const images = msgs.filter(m => m.type === 'image');
  const files = msgs.filter(m => m.type === 'file');
  const links = msgs.filter(m => m.type === 'text' && m.body && m.body.match(/(https?:\/\/[^\s]+)/g));
  
  let sentAmount = 0;
  let receivedAmount = 0;
  msgs.forEach(m => {
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
          { text: 'Bloquer', style: 'destructive', onPress: async () => {
              await api.post('/moderation/block', { user_id: peer.id });
              setIsBlocked(true);
              Alert.alert('Succès', 'Utilisateur bloqué.');
            }
          }
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* En-tête du profil */}
      <View style={{ backgroundColor: colors.surface, padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        
        {/* MODIFIÉ : On affiche l'avatar du peer si on l'a */}
        <Avatar 
          name={title} 
          size={80} 
          uri={peer?.avatar_url ? SERVER_URL + peer.avatar_url : null} 
        />
        
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 12, color: colors.text }}>{title}</Text>
        {type !== 'group' && <Text style={{ color: colors.muted, marginTop: 4 }}>@{peerUsername}</Text>}
        
        {type !== 'group' && (
          <View style={{ flexDirection: 'row', marginTop: 15 }}>
            <TouchableOpacity 
              onPress={handleBlock}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isBlocked ? colors.danger : colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: isBlocked ? colors.danger : colors.border }}
            >
              <Ionicons name={isBlocked ? "lock-open" : "ban"} size={16} color={isBlocked ? '#fff' : colors.danger} />
              <Text style={{ color: isBlocked ? '#fff' : colors.danger, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>{isBlocked ? 'Débloquer' : 'Bloquer'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setShowReport(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="flag" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: '600', marginLeft: 6, fontSize: 13 }}>Signaler</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
          onPress={() => navigation.navigate('Chat', { id, title, type, peerUsername, peerName })}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Envoyer un message</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      {type !== 'group' && (
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Transactions</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, backgroundColor: colors.surface, padding: 15, borderRadius: 12, marginRight: 8, alignItems: 'center' }}>
              <Ionicons name="arrow-up-circle" size={24} color={colors.danger} />
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>Envoyé</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 2 }}>{fcfa(sentAmount)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surface, padding: 15, borderRadius: 12, marginLeft: 8, alignItems: 'center' }}>
              <Ionicons name="arrow-down-circle" size={24} color={colors.success} />
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>Reçu</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 2 }}>{fcfa(receivedAmount)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Photos */}
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Photos ({images.length})</Text>
        {images.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucune photo partagée.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map(img => (
              <TouchableOpacity key={img.id} onPress={() => setFullImage(SERVER_URL + img.file_url)}>
                <Image source={{ uri: SERVER_URL + img.file_url }} style={{ width: 100, height: 100, borderRadius: 12, marginRight: 10 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Documents */}
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Documents ({files.length})</Text>
        {files.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucun document partagé.</Text>
        ) : (
          files.map(f => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 }}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={{ marginLeft: 10, flex: 1, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{f.file_name}</Text>
            </View>
          ))
        )}
      </View>

      {/* Liens */}
      <View style={{ marginTop: 20, paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Liens partagés ({links.length})</Text>
        {links.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucun lien partagé.</Text>
        ) : (
          links.map(l => {
            const url = l.body.match(/(https?:\/\/[^\s]+)/g)[0];
            return (
              <TouchableOpacity key={l.id} onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 }}>
                <Ionicons name="link" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 10, flex: 1, color: colors.primary, textDecorationLine: 'underline' }} numberOfLines={1}>{url}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Modale Image en grand */}
      <Modal visible={!!fullImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setFullImage(null)}>
            <Ionicons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {fullImage && <Image source={{ uri: fullImage }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </View>
      </Modal>

      {/* Modale de Signalement */}
      <Modal visible={showReport} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 15 }}>Pourquoi signalez-vous cet utilisateur ?</Text>
            {['Spam / Publicité', 'Harcèlement', 'Contenu inapproprié', 'Arnaque / Fraude', 'Autre'].map(reason => (
              <TouchableOpacity key={reason} onPress={() => handleReport(reason)} style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowReport(false)} style={{ marginTop: 15, alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
