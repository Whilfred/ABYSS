import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Text, TouchableOpacity, View, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, fcfa } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext';
import { SERVER_URL } from '../config';

// Aperçu du dernier message : une icône + un texte
const preview = (c) => {
  if (c.last_type === 'money') return { icon: 'cash-outline', text: fcfa(c.last_meta?.amount) };
  if (c.last_type === 'money_request') return { icon: 'hand-left-outline', text: 'Demande de ' + fcfa(c.last_meta?.amount) };
  if (c.last_type === 'image') return { icon: 'image-outline', text: 'Photo' };
  if (c.last_type === 'file') return { icon: 'document-text-outline', text: c.last_file_name || 'Document' };
  if (c.last_type === 'sticker') return { icon: 'happy-outline', text: 'Sticker' };
  return { icon: null, text: c.body || 'Nouvelle discussion' };
};

const timeOf = (d) => {
  if (!d) return '';
  const t = new Date(d);
  const now = new Date();
  if (t.toDateString() === now.toDateString()) {
    return t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = now - t;
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return t.toLocaleDateString('fr-FR', { weekday: 'short' });
  }
  return t.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const AVATAR = 56;

export default function ChatsScreen({ navigation }) {
  const { socket } = useAuth();
  const { colors } = useTheme();

  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(() => api.get('/conversations').then((r) => setChats(r.data)).catch(() => {}), []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', load);
    return () => socket.off('message:new', load);
  }, [socket, load]);

  const openMenu = useCallback(() => {
    if (Platform.OS === 'ios')
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Nouvelle discussion', 'Nouveau groupe', 'Annuler'], cancelButtonIndex: 2 },
        (i) => { if (i === 0) navigation.navigate('NewChat'); if (i === 1) navigation.navigate('NewGroup'); });
    else Alert.alert('Nouveau', '', [
      { text: 'Nouvelle discussion', onPress: () => navigation.navigate('NewChat') },
      { text: 'Nouveau groupe', onPress: () => navigation.navigate('NewGroup') },
      { text: 'Annuler', style: 'cancel' }]);
  }, [navigation]);

  // En-tête plat, façon Telegram
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 20 },
      headerTitleAlign: 'center',
      headerRight: null,
    });
  }, [navigation, colors]);

  const filteredChats = chats.filter((c) => {
    const title = c.type === 'group' ? c.name : c.peer?.display_name || '';
    return title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Barre de recherche plate, arrondie, grise */}
      <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, color: colors.text, fontSize: 16 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(c) => String(c.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 90, paddingHorizontal: 32 }}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.muted} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>
              {search ? 'Aucun résultat' : 'Aucune discussion'}
            </Text>
            <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 6, fontSize: 15, lineHeight: 21 }}>
              {search ? 'Essayez un autre nom.' : "Commencez une conversation pour échanger et envoyer de l'argent."}
            </Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const title = c.type === 'group' ? c.name : c.peer?.display_name || '—';
          const hasUnread = c.unread > 0;
          const pv = preview(c);

          return (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => navigation.navigate('Chat', { id: c.id, title, type: c.type, peerUsername: c.peer?.username, peerName: c.peer?.display_name })}
              style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, backgroundColor: colors.surface }}
            >
              <Avatar
                name={title}
                size={AVATAR}
                uri={
                  c.type === 'group'
                    ? (c.avatar_url ? SERVER_URL + c.avatar_url : null)
                    : (c.peer?.avatar_url ? SERVER_URL + c.peer.avatar_url : null)
                }
              />

              {/* Contenu + séparateur fin aligné après l'avatar */}
              <View
                style={{
                  flex: 1,
                  marginLeft: 12,
                  paddingRight: 14,
                  paddingVertical: 10,
                  minHeight: 72,
                  justifyContent: 'center',
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {c.type === 'group' && (
                    <Ionicons name="people" size={15} color={colors.text} style={{ marginRight: 5 }} />
                  )}
                  <Text style={{ flex: 1, fontWeight: '600', fontSize: 16, color: colors.text }} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={{ color: hasUnread ? colors.primary : colors.muted, fontSize: 13, marginLeft: 8 }}>
                    {timeOf(c.last_at)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  {pv.icon ? (
                    <Ionicons name={pv.icon} size={15} color={colors.muted} style={{ marginRight: 4 }} />
                  ) : null}
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 15 }}>
                    {pv.text}
                  </Text>
                  {hasUnread && (
                    <View style={{ backgroundColor: colors.primary, borderRadius: 11, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8, paddingHorizontal: 6 }}>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{c.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Bouton flottant, comme Telegram */}
      <TouchableOpacity
        onPress={openMenu}
        activeOpacity={0.85}
        style={{
          position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29,
          backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
        }}
      >
        <Ionicons name="pencil" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
