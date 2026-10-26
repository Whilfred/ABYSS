import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { colors } from '../theme';

export default function ChatInfoScreen({ route, navigation }) {
  const { id, title, type, peerUsername, peerName } = route.params;
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    api.get(`/conversations/${id}/messages`).then((r) => setMsgs(r.data.messages)).catch(() => {});
  }, [id]);

  const images = msgs.filter(m => m.type === 'image');
  const files = msgs.filter(m => m.type === 'file');
  const links = msgs.filter(m => m.type === 'text' && m.body && m.body.match(/(https?:\/\/[^\s]+)/g));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F4F6F9' }}>
      
      {/* En-tête du profil */}
      <View style={{ backgroundColor: '#fff', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Avatar name={title} size={80} />
        <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 12, color: colors.text }}>{title}</Text>
        {type !== 'group' && <Text style={{ color: colors.muted, marginTop: 4 }}>@{peerUsername}</Text>}
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
          onPress={() => navigation.navigate('Chat', { id, title, type, peerUsername, peerName })}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600', marginLeft: 8 }}>Envoyer un message</Text>
        </TouchableOpacity>
      </View>

      {/* Section Médias (Photos) */}
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Photos ({images.length})</Text>
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
      </View>

      {/* Section Documents */}
      <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Documents ({files.length})</Text>
        {files.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucun document partagé.</Text>
        ) : (
          files.map(f => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8 }}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={{ marginLeft: 10, flex: 1, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{f.file_name}</Text>
            </View>
          ))
        )}
      </View>

      {/* Section Liens */}
      <View style={{ marginTop: 20, paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Liens partagés ({links.length})</Text>
        {links.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>Aucun lien partagé.</Text>
        ) : (
          links.map(l => {
            const url = l.body.match(/(https?:\/\/[^\s]+)/g)[0];
            return (
              <TouchableOpacity key={l.id} onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                <Ionicons name="link" size={20} color={colors.primary} />
                <Text style={{ marginLeft: 10, flex: 1, color: colors.primary, textDecorationLine: 'underline' }} numberOfLines={1}>{url}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
