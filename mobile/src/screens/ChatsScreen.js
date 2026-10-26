import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, fcfa } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/UI';
import { colors } from '../theme';

const preview = (c) => {
  if (c.last_type === 'money') return '💸 ' + fcfa(c.last_meta?.amount);
  if (c.last_type === 'money_request') return '🙏 Demande de ' + fcfa(c.last_meta?.amount);
  return c.body || 'Nouvelle discussion';
};
const timeOf = (d) => {
  if (!d) return '';
  const t = new Date(d); const now = new Date();
  return t.toDateString() === now.toDateString()
    ? t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : t.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

export default function ChatsScreen({ navigation }) {
  const { socket } = useAuth();
  const [chats, setChats] = useState([]);
  const load = useCallback(() => api.get('/conversations').then((r) => setChats(r.data)).catch(() => {}), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', load);
    return () => socket.off('message:new', load);
  }, [socket, load]);

  useLayoutEffect(() => {
    const menu = () => {
      if (Platform.OS === 'ios')
        ActionSheetIOS.showActionSheetWithOptions({ options: ['Nouvelle discussion', 'Nouveau groupe', 'Annuler'], cancelButtonIndex: 2 },
          (i) => { if (i === 0) navigation.navigate('NewChat'); if (i === 1) navigation.navigate('NewGroup'); });
      else Alert.alert('Nouveau', '', [
        { text: 'Nouvelle discussion', onPress: () => navigation.navigate('NewChat') },
        { text: 'Nouveau groupe', onPress: () => navigation.navigate('NewGroup') },
        { text: 'Annuler', style: 'cancel' }]);
    };
    navigation.setOptions({ headerRight: () => (
      <TouchableOpacity onPress={menu} style={{ marginRight: 16 }}><Ionicons name="create-outline" size={26} color={colors.primary} /></TouchableOpacity>) });
  }, [navigation]);

  return (
    <FlatList data={chats} keyExtractor={(c) => c.id} style={{ backgroundColor: '#fff' }}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 80, paddingHorizontal: 30 }}>
        Aucune discussion. Touchez ✏️ pour écrire à quelqu'un via son nom d'utilisateur.</Text>}
      renderItem={({ item: c }) => {
        const title = c.type === 'group' ? c.name : c.peer?.display_name || '—';
        return (
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => navigation.navigate('Chat', { id: c.id, title, type: c.type, peerUsername: c.peer?.username, peerName: c.peer?.display_name })}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Avatar name={title} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{title}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>{preview(c)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{timeOf(c.last_at)}</Text>
              {c.unread > 0 && (
                <View style={{ backgroundColor: colors.primary, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 6 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{c.unread}</Text>
                </View>)}
            </View>
          </TouchableOpacity>
        );
      }} />
  );
}
