import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, errMsg } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext'; 
import { useAuth } from '../auth';

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
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadData = () => {
    Promise.all([
      api.get(`/conversations/${id}/info`),
      api.get(`/conversations/${id}/members`),
      api.get(`/conversations/${id}/messages`)
    ]).then(([infoRes, membersRes, msgsRes]) => {
      setGroupInfo(infoRes.data);
      setMembers(membersRes.data);
      setMsgs(msgsRes.data.messages);
    }).catch((e) => {
      Alert.alert('Erreur', errMsg(e));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  const isCreator = groupInfo?.creator?.username === user.username;

  // Changer la photo du groupe
  const changeGroupAvatar = async () => {
    if (!isCreator) return;
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
          name: 'group_avatar.jpg',
          type: 'image/jpeg',
        });

        const uploadRes = await api.post('/upload', formData, { 
          headers: { 'Content-Type': 'multipart/form-data' } 
        });

        await api.post(`/conversations/${id}/avatar`, { avatar_url: uploadRes.data.url });
        loadData(); // Recharger pour voir la nouvelle photo
        Alert.alert('Succès', 'Photo du groupe mise à jour !');
      }
    } catch (e) {
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const quitGroup = () => {
    Alert.alert(
      'Quitter le groupe',
      'Voulez-vous vraiment quitter ce groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: async () => {
            try {
              await api.post(`/conversations/${id}/leave`);
              navigation.navigate('Tabs');
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

  // Filtrer les médias
  const images = msgs.filter(m => m.type === 'image');
  const files = msgs.filter(m => m.type === 'file');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* En-tête du groupe */}
      <View style={{ backgroundColor: colors.surface, padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        
        <TouchableOpacity onPress={changeGroupAvatar} disabled={!isCreator || uploadingAvatar} activeOpacity={0.8}>
          {groupInfo?.avatar_url ? (
            <Image 
              source={{ uri: SERVER_URL + groupInfo.avatar_url }} 
              style={{ width: 90, height: 90, borderRadius: 45, marginBottom: 12 }} 
            />
          ) : (
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="people" size={45} color="#fff" />
            </View>
          )}
          
          {isCreator && (
            <View style={{ 
              position: 'absolute', bottom: 8, right: 0, 
              backgroundColor: colors.primary, borderRadius: 16, 
              padding: 6, borderWidth: 2, borderColor: colors.surface 
            }}>
              <Ionicons name={uploadingAvatar ? "hourglass" : "camera"} size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{groupInfo?.name || title}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Groupe · {members.length} membre{members.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Créateur du groupe */}
      {groupInfo?.creator && (
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 14, borderRadius: 16 }}>
            <Avatar 
              name={groupInfo.creator.display_name} 
              size={44} 
              uri={groupInfo.creator.avatar_url ? SERVER_URL + groupInfo.creator.avatar_url : null} 
            />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>Créé par</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {groupInfo.creator.display_name}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Médias partagés */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 }}>
          Photos ({images.length})
        </Text>
        {images.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucune photo partagée.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map(img => (
              <Image 
                key={img.id} 
                source={{ uri: SERVER_URL + img.file_url }} 
                style={{ width: 100, height: 100, borderRadius: 12, marginRight: 10 }} 
              />
            ))}
          </ScrollView>
        )}

        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 10 }}>
          Documents ({files.length})
        </Text>
        {files.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucun document partagé.</Text>
        ) : (
          files.slice(0, 5).map(f => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 }}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={{ marginLeft: 10, flex: 1, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{f.file_name}</Text>
            </View>
          ))
        )}
      </View>

      {/* Liste des membres */}
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
          Membres ({members.length})
        </Text>
        
        <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
          {members.map((member, index) => {
            const isMe = member.id === user.id;
            const isOnline = member.online;
            
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
                  <Text style={{ fontSize: 12, color: isOnline ? colors.success : colors.muted, marginTop: 4, fontWeight: isOnline ? '700' : '400' }}>
                    {isOnline ? '● En ligne' : formatLastSeen(member.last_seen)}
                  </Text>
                </View>

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
