import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, TextInput, Alert, Animated, Platform } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api, errMsg } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../auth';

const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥'];

// --- ANIMATION DES RÉACTIONS ---
function FloatingReaction({ emoji, startX, startY, onComplete }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 150;
    const randomRotate = (Math.random() - 0.5) * 90;

    Animated.parallel([
      Animated.timing(translateY, { toValue: -250 - Math.random() * 100, duration: 1500, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: randomX, duration: 1500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 2, friction: 4, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: randomRotate, duration: 1500, useNativeDriver: true }),
    ]).start(() => onComplete());
  }, []);

  const spin = rotate.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: startX, top: startY,
        transform: [{ translateY }, { translateX }, { scale }, { rotate: spin }],
        opacity, zIndex: 999,
      }}
    >
      <Text style={{ fontSize: 60 }}>{emoji}</Text>
    </Animated.View>
  );
}

// --- VIDÉO DANS LE FIL ---
function FeedVideo({ uri, isVisible, isScreenFocused }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (isVisible && isScreenFocused) player.play();
    else player.pause();
  }, [isVisible, isScreenFocused, player]);

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 340 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const [stories, setStories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [activeReactions, setActiveReactions] = useState([]);
  const [uploadingStory, setUploadingStory] = useState(false);

  const loadStories = useCallback(() => {
    return api.get('/stories').then(r => setStories(r.data)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  };

  const addStory = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ['images', 'videos'], 
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled) {
        setUploadingStory(true);
        const file = result.assets[0];
        
        const isVideo = file.type === 'video';
        const fileName = file.fileName || (isVideo ? `video_${Date.now()}.mp4` : `image_${Date.now()}.jpg`);
        const mimeType = file.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: fileName,
          type: mimeType,
        });

        await api.post('/stories', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });
        
        await loadStories();
        Alert.alert('Succès', 'Votre story a été publiée !');
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Erreur', "L'envoi a échoué. Vérifiez que le serveur est réveillé ou que le fichier n'est pas trop lourd.");
    } finally {
      setUploadingStory(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setVisibleIndex(viewableItems[0].index);
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const reactToStory = async (storyId, emoji, event) => {
    const { pageX, pageY } = event.nativeEvent;
    const newReaction = { id: Date.now() + Math.random(), emoji, x: pageX - 30, y: pageY - 30 };
    setActiveReactions(prev => [...prev, newReaction]);

    try {
      await api.post(`/stories/${storyId}/react`, { emoji });
    } catch (e) {
      console.log(errMsg(e));
    }
  };

  const sendDirectMessage = async (username) => {
    if (!messageText.trim()) return;
    setSendingMsg(true);
    try {
      const convRes = await api.post('/conversations/direct', { username });
      await api.post(`/conversations/${convRes.data.id}/messages`, { body: messageText, type: 'text' });
      setMessageText('');
      Alert.alert('Message envoyé', 'Votre message a été envoyé dans la conversation.');
    } catch (e) {
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setSendingMsg(false);
    }
  };

  const renderItem = ({ item, index }) => {
    const isVideo = item.media_type === 'video';
    const isMyStory = item.user_id === user?.id;
    const canSend = !!messageText.trim() && !sendingMsg;

    return (
      <View style={{ flexDirection: 'row', paddingHorizontal: 10, marginBottom: 10, alignItems: 'flex-end' }}>
        <View style={{ marginRight: 8, marginBottom: 2 }}>
          <Avatar
            name={item.display_name}
            size={38}
            uri={item.avatar_url ? SERVER_URL + item.avatar_url : null}
          />
        </View>

        <View style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          overflow: 'hidden',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
            <Text style={{ flex: 1, fontWeight: '700', color: colors.primary, fontSize: 15 }} numberOfLines={1}>
              {isMyStory ? 'Vous' : item.display_name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('StoryViewer', { stories, initialIndex: index })}
          >
            {isVideo ? (
              <FeedVideo
                uri={SERVER_URL + item.media_url}
                isVisible={index === visibleIndex}
                isScreenFocused={isFocused}
              />
            ) : (
              <Image
                source={{ uri: SERVER_URL + item.media_url }}
                style={{ width: '100%', height: 340 }}
                resizeMode="cover"
              />
            )}
            {isVideo && (
              <View style={{ position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Ionicons name="videocam" size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>Vidéo</Text>
              </View>
            )}
          </TouchableOpacity>

          {!isMyStory && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 8 }}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={(e) => reactToStory(item.id, emoji, e)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
                    backgroundColor: colors.primary + '1F', marginRight: 6, marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isMyStory ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 }}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Répondre…"
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1, backgroundColor: colors.bg, borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 8, color: colors.text, fontSize: 15, maxHeight: 80,
                }}
                multiline
              />
              <TouchableOpacity
                onPress={() => sendDirectMessage(item.username)}
                disabled={!canSend}
                style={{
                  marginLeft: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
                  alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.45,
                }}
              >
                <Ionicons name="send" size={17} color="#fff" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Votre story</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>ABYSS</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 1 }}>
              {stories.length} {stories.length > 1 ? 'stories' : 'story'}
            </Text>
          </View>
          <TouchableOpacity onPress={loadStories} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="refresh" size={23} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {activeReactions.map(r => (
        <FloatingReaction
          key={r.id}
          emoji={r.emoji}
          startX={r.x}
          startY={r.y}
          onComplete={() => setActiveReactions(prev => prev.filter(item => item.id !== r.id))}
        />
      ))}

      <FlatList
        data={stories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 90, paddingHorizontal: 32 }}>
            <Ionicons name="images-outline" size={64} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 14, textAlign: 'center', fontSize: 16, lineHeight: 22 }}>
              Aucune story pour le moment.{'\n'}Revenez plus tard !
            </Text>
          </View>
        }
        renderItem={renderItem}
      />

      {/* --- BOUTON FLOTTANT POUR AJOUTER UNE STORY --- */}
      <TouchableOpacity
        onPress={addStory}
        disabled={uploadingStory}
        style={{
          position: 'absolute',
          right: 20,
          bottom: Math.max(insets.bottom, 20) + 10,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
        }}
      >
        <Ionicons name={uploadingStory ? "hourglass" : "add"} size={32} color="#fff" />
      </TouchableOpacity>

    </View>
  );
}
