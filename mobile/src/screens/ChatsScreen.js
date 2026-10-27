import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Text, TouchableOpacity, View, TextInput, ScrollView, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, fcfa, errMsg } from '../api';
import { useAuth } from '../auth';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext';
import { SERVER_URL } from '../config';

const preview = (c) => {
  if (c.last_type === 'money') return '💸 ' + fcfa(c.last_meta?.amount);
  if (c.last_type === 'money_request') return '🙏 Demande de ' + fcfa(c.last_meta?.amount);
  if (c.last_type === 'image') return '📷 Photo';
  if (c.last_type === 'file') return '📄 ' + (c.last_file_name || 'Document');
  if (c.last_type === 'sticker') return '🖼️ Sticker';
  return c.body || 'Nouvelle discussion';
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

export default function ChatsScreen({ navigation }) {
  const { socket, user } = useAuth();
  const { colors } = useTheme();
  
  const [chats, setChats] = useState([]);
  const [stories, setStories] = useState([]);
  const [search, setSearch] = useState('');
  const [uploadingStory, setUploadingStory] = useState(false);

  const load = useCallback(() => api.get('/conversations').then((r) => setChats(r.data)).catch(() => {}), []);
  const loadStories = useCallback(() => api.get('/stories').then((r) => setStories(r.data)).catch(() => {}), []);
  
  useFocusEffect(useCallback(() => { 
    load(); 
    loadStories();
  }, [load, loadStories]));

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
    navigation.setOptions({ 
      headerRight: () => (
        <TouchableOpacity onPress={menu} style={{ marginRight: 16 }}>
          <Ionicons name="create-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ) 
    });
  }, [navigation, colors]);

  const addStory = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images', 'videos'], 
        quality: 1,
        allowsEditing: true,
      });

      if (!result.canceled) {
        setUploadingStory(true);
        const file = result.assets[0];
        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: file.fileName || (file.type === 'video' ? 'story.mp4' : 'story.jpg'),
          type: file.mimeType || (file.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        });

        await api.post('/stories', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        await loadStories();
        Alert.alert('Succès', 'Votre story a été publiée !');
      }
    } catch (e) {
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setUploadingStory(false);
    }
  };

  const viewStory = (index) => {
    navigation.navigate('StoryViewer', { stories, initialIndex: index });
  };

  const filteredChats = chats.filter(c => {
    const title = c.type === 'group' ? c.name : c.peer?.display_name || '';
    return title.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* --- SECTION STORIES --- */}
      <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          
          <TouchableOpacity 
            onPress={addStory} 
            disabled={uploadingStory}
            style={{ alignItems: 'center', marginRight: 15 }}
          >
            <View style={{ 
              width: 64, height: 64, borderRadius: 32, 
              backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, 
              alignItems: 'center', justifyContent: 'center' 
            }}>
              <Ionicons name={uploadingStory ? "hourglass" : "add"} size={30} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 12, marginTop: 5, fontWeight: '600' }}>Ma story</Text>
          </TouchableOpacity>

          {stories.map((story, index) => (
            <TouchableOpacity 
              key={story.id} 
              onPress={() => viewStory(index)}
              style={{ alignItems: 'center', marginRight: 15 }}
            >
              <View style={{ 
                width: 64, height: 64, borderRadius: 32, 
                borderWidth: 3, borderColor: colors.primary, 
                padding: 2 
              }}>
                <Avatar 
                  name={story.display_name} 
                  size={54} 
                  uri={story.avatar_url ? SERVER_URL + story.avatar_url : null} 
                />
              </View>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 5, maxWidth: 64 }} numberOfLines={1}>
                {story.display_name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Barre de recherche */}
      <View style={{ padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput 
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une discussion..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: colors.text, fontSize: 15 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList 
        data={filteredChats} 
        keyExtractor={(c) => c.id} 
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 30 }}>
            <Ionicons name="chatbubbles-outline" size={60} color={colors.border} />
            <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 16, fontSize: 16 }}>
              {search ? 'Aucune discussion trouvée.' : 'Aucune discussion. Touchez ✏️ pour écrire à quelqu\'un.'}
            </Text>
          </View>
        }
        renderItem={({ item: c }) => {
          const title = c.type === 'group' ? c.name : c.peer?.display_name || '—';
          const hasUnread = c.unread > 0;
          
          return (
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Chat', { id: c.id, title, type: c.type, peerUsername: c.peer?.username, peerName: c.peer?.display_name })}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                padding: 14, 
                backgroundColor: hasUnread ? colors.surface : colors.bg,
                borderBottomWidth: 1, 
                borderBottomColor: colors.border 
              }}
            >
              <View>
                {/* MODIFIÉ : Utilisation de c.avatar_url pour les groupes */}
                <Avatar 
                  name={title} 
                  size={54} 
                  uri={
                    c.type === 'group' 
                      ? (c.avatar_url ? SERVER_URL + c.avatar_url : null) 
                      : (c.peer?.avatar_url ? SERVER_URL + c.peer.avatar_url : null)
                  } 
                />
                {c.type === 'group' && (
                  <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.surface, borderRadius: 10, padding: 2 }}>
                    <Ionicons name="people" size={14} color={colors.primary} />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text, marginBottom: 4 }} numberOfLines={1}>
                  {title}
                </Text>
                <Text numberOfLines={1} style={{ color: hasUnread ? colors.text : colors.muted, fontSize: 14, fontWeight: hasUnread ? '600' : '400' }}>
                  {preview(c)}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                <Text style={{ color: hasUnread ? colors.primary : colors.muted, fontSize: 12, fontWeight: hasUnread ? '700' : '400' }}>
                  {timeOf(c.last_at)}
                </Text>
                {hasUnread && (
                  <View style={{ backgroundColor: colors.primary, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginTop: 6, paddingHorizontal: 6 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{c.unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }} 
      />
    </View>
  );
}
