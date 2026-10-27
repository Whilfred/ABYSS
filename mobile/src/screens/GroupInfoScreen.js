import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext'; 
import { useAuth } from '../auth';

// Fonction pour formater la dernière visite
const formatLastSeen = (date) => {
  if (!date) return 'En ligne';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  
  if (diff < 60000) return 'Vu à l\'instant';
  if (diff < 3600000) return `Vu il y a ${Math.floor(diff / 60000)} min`;
  if (d.toDateString() === now.toDateString()) return `Vu à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return `Vu le ${d.toLocaleDateString('fr-FR')}`;
};

export default function GroupInfoScreen({ route, navigation }) {
  const { id, title } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger les infos du groupe et les membres
    Promise.all([
      api.get(`/conversations/${id}/info`),
      api.get(`/conversations/${id}/members`)
    ]).then(([infoRes, membersRes]) => {
      setGroupInfo(infoRes.data);
      setMembers(membersRes.data);
    }).catch((e) => {
      Alert.alert('Erreur', errMsg(e));
    }).finally(() => setLoading(false));
  }, [id]);

  const quitGroup = () => {
    Alert.alert(
      'Quitter le groupe',
      'Voulez-vous vraiment quitter ce groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: async () => {
            try {
              // On suppose que la route pour quitter existe côté backend
              await api.post(`/conversations/${id}/leave`);
              navigation.navigate('Tabs'); // Retour à l'accueil
            } catch (e) {
              Alert.alert('Erreur', errMsg(e));
            }
        }}
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* En-tête du groupe */}
      <View style={{ backgroundColor: colors.surface, padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ 
          width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, 
          alignItems: 'center', justifyContent: 'center', marginBottom: 12 
        }}>
          <Ionicons name="people" size={45} color="#fff" />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{groupInfo?.name || title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Groupe · {members.length} membre{members.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Liste des membres */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
          Membres ({members.length})
        </Text>
        
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
          {members.map((member, index) => {
            const isMe = member.id === user.id;
            const isOnline = member.online; // On utilise le champ online renvoyé par le backend
            
            return (
              <View 
                key={member.id} 
                style={{ 
                  flexDirection: 'row', alignItems: 'center', padding: 14,
                  borderBottomWidth: index < members.length - 1 ? 1 : 0, 
                  borderBottomColor: colors.border 
                }}
              >
                <Avatar 
                  name={member.display_name} 
                  size={48} 
                  uri={member.avatar_url ? SERVER_URL + member.avatar_url : null} 
                />
                
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {member.display_name} {isMe && <Text style={{ color: colors.muted, fontWeight: '400' }}>(Vous)</Text>}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                    @{member.username}
                  </Text>
                  
                  {/* Statut en ligne ou dernière visite */}
                  <Text style={{ fontSize: 12, color: isOnline ? colors.success : colors.muted, marginTop: 4, fontWeight: isOnline ? '700' : '400' }}>
                    {isOnline ? '● En ligne' : formatLastSeen(member.last_seen)}
                  </Text>
                </View>

                {/* Optionnel : Bouton pour envoyer un message direct (si ce n'est pas moi) */}
                {!isMe && (
                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        const res = await api.post('/conversations/direct', { username: member.username });
                        navigation.navigate('Chat', { 
                          id: res.data.id, 
                          title: member.display_name, 
                          type: 'direct', 
                          peerUsername: member.username, 
                          peerName: member.display_name 
                        });
                      } catch (e) { Alert.alert('Erreur', errMsg(e)); }
                    }}
                    style={{ padding: 10 }}
                  >
                    <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Bouton Quitter */}
      <View style={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity 
          onPress={quitGroup}
          style={{ 
            backgroundColor: colors.surface, 
            padding: 16, 
            borderRadius: 16, 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.danger + '40'
          }}
        >
          <Ionicons name="exit-outline" size={22} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 16 }}>Quitter le groupe</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}
