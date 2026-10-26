import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Avatar, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { colors } from '../theme';

export default function NewChatScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = q.replace('@', '').trim();
      if (s.length < 2) return setRes([]);
      api.get('/users/search', { params: { q: s } }).then((r) => setRes(r.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const open = async (u) => {
    try {
      const { data } = await api.post('/conversations/direct', { username: u.username });
      navigation.replace('Chat', { id: data.id, title: u.display_name, type: 'direct', peerUsername: u.username, peerName: u.display_name });
    } catch (e) { Alert.alert('Erreur', errMsg(e)); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
      <Input value={q} onChangeText={setQ} placeholder="Rechercher par nom d'utilisateur" autoFocus />
      <FlatList data={res} keyExtractor={(u) => u.id} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={q.length >= 2 ? <Text style={{ color: colors.muted, textAlign: 'center' }}>Aucun résultat</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => open(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Avatar name={item.display_name} size={44} />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{item.display_name}</Text>
              <Text style={{ color: colors.muted }}>@{item.username}</Text>
            </View>
          </TouchableOpacity>)} />
    </View>
  );
}
