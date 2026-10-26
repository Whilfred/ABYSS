import React, { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Avatar, Button, Chip, Input } from '../components/UI';
import { api, errMsg } from '../api';
import { colors } from '../theme';

export default function NewGroupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [sel, setSel] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = q.replace('@', '').trim();
      if (s.length < 2) return setRes([]);
      api.get('/users/search', { params: { q: s } }).then((r) => setRes(r.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const toggle = (u) => setSel((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));
  const create = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/conversations/group', { name, usernames: sel.map((u) => u.username) });
      navigation.replace('Chat', { id: data.id, title: name, type: 'group' });
    } catch (e) { Alert.alert('Erreur', errMsg(e)); } finally { setLoading(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
      <Input label="Nom du groupe" value={name} onChangeText={setName} autoCapitalize="sentences" />
      <ScrollView horizontal style={{ maxHeight: 44, marginBottom: 8 }}>
        {sel.map((u) => <Chip key={u.id} active label={`@${u.username} ✕`} onPress={() => toggle(u)} />)}
      </ScrollView>
      <Input value={q} onChangeText={setQ} placeholder="Ajouter des membres (nom d'utilisateur)" />
      <FlatList data={res} keyExtractor={(u) => u.id} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => toggle(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Avatar name={item.display_name} size={40} />
            <Text style={{ marginLeft: 12, flex: 1, color: colors.text }}>{item.display_name} · @{item.username}</Text>
            <Text style={{ color: colors.primary, fontSize: 20 }}>{sel.some((x) => x.id === item.id) ? '✓' : '+'}</Text>
          </TouchableOpacity>)} />
      <Button title="Créer le groupe" onPress={create} loading={loading} disabled={name.trim().length < 2 || !sel.length} />
    </View>
  );
}
