import React, { useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, RefreshControl,
  TextInput, Alert, Animated, Platform, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Dimensions
} from 'react-native';
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

const { width } = Dimensions.get('window');
const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥'];

const fullUrl = (u) => (u ? (u.startsWith('http') ? u : SERVER_URL + u) : null);

// --- ANIMATION DES RÉACTIONS ---
function FloatingReaction({ emoji, startX, startY, onComplete }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 120;
    const randomRotate = (Math.random() - 0.5) * 60;

    Animated.parallel([
      Animated.timing(translateY, { toValue: -220 - Math.random() * 80, duration: 1200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: randomX, duration: 1200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.8, friction: 5, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: randomRotate, duration: 1200, useNativeDriver: true }),
    ]).start(() => onComplete());
  }, []);

  const spin = rotate.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: startX, top: startY,
        transform: [{ translateY }, { translateX }, { scale }, { rotate: spin }],
        opacity, zIndex: 9999,
      }}
    >
      <Text style={{ fontSize: 50 }}>{emoji}</Text>
    </Animated.View>
  );
}

// --- MEDIA PLEIN ÉCRAN (Vidéo & Image) ---
function FullMedia({ uri, isVideo, isVisible, isScreenFocused }) {
  if (isVideo) {
    const player = useVideoPlayer(uri, (p) => { p.loop = true; });
    useEffect(() => {
      if (isVisible && isScreenFocused) player.play();
      else player.pause();
    }, [isVisible, isScreenFocused, player]);

    // Qualité vidéo intacte. Cover pour occuper l'espace.
    return (
      <VideoView
        player={player}
        style={{ width: '100%', height: 550 }}
        contentFit="cover" 
        nativeControls={false}
      />
    );
  }

  // Image affichée en entier (contain) sur fond noir, taille augmentée
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', height: 550, backgroundColor: '#000' }}
      resizeMode="contain" 
    />
  );
}

// --- BULLE DE STORY ---
function StoryBubble({ label, uri, name, colors, ring = true, plus = false, onPress, onPlusPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ alignItems: 'center', marginRight: 14, width: 76 }}>
      <View>
        <View style={{ padding: 3, borderRadius: 40, borderWidth: 2.5, borderColor: ring ? colors.primary : 'transparent' }}>
          <View style={{ padding: 2, borderRadius: 40, backgroundColor: colors.bg }}>
            <Avatar name={name} size={60} uri={uri} />
          </View>
        </View>
        {plus && (
          <TouchableOpacity
            onPress={onPlusPress}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              position: 'absolute', right: 2, bottom: 2,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.primary,
              borderWidth: 2.5, borderColor: colors.bg,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, marginTop: 5, textAlign: 'center' }}>
        {label}
      </Text>
    </TouchableOpacity>
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
  const [messageText, setMessageText] = useState({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [activeReactions, setActiveReactions] = useState([]);
  const [uploadingStory, setUploadingStory] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadStories = useCallback(() => {
    return api.get('/stories').then((r) => setStories(r.data)).catch(() => {});
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
        quality: 1, // Meilleure qualité pour les images
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High, // Meilleure qualité pour les vidéos
        allowsEditing: false, // Pas de rognage
      });

      if (!result.canceled) {
        setUploadingStory(true);
        const file = result.assets[0];
        const uri = file.uri;
        const extension = uri.split('.').pop().toLowerCase();
        let mimeType = 'image/jpeg';
        let fileName = `story_${Date.now()}.jpg`;

        if (['mp4', 'mov', 'm4v'].includes(extension)) {
          mimeType = 'video/mp4';
          fileName = `story_${Date.now()}.mp4`;
        } else if (extension === 'png') {
          mimeType = 'image/png';
          fileName = `story_${Date.now()}.png`;
        } else if (extension === 'gif') {
          mimeType = 'image/gif';
          fileName = `story_${Date.now()}.gif`;
        }

        const formData = new FormData();
        formData.append('media', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
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
      console.log('ERREUR UPLOAD:', e.response?.data || e.message);
      Alert.alert('Erreur', "L'envoi a échoué.");
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
    const newReaction = { id: Date.now() + Math.random(), emoji, x: pageX - 25, y: pageY - 25 };
    setActiveReactions((prev) => [...prev, newReaction]);

    try {
      await api.post(`/stories/${storyId}/react`, { emoji });
    } catch (e) {
      console.log(errMsg(e));
    }
  };

  const sendDirectMessage = async (storyId, username) => {
    const text = messageText[storyId];
    if (!text || !text.trim()) return;
    setSendingMsg(true);
    try {
      const convRes = await api.post('/conversations/direct', { username });
      await api.post(`/conversations/${convRes.data.id}/messages`, { body: text, type: 'text' });
      setMessageText((prev) => ({ ...prev, [storyId]: '' }));
      Alert.alert('Envoyé', 'Votre réponse a été transmise.');
    } catch (e) {
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setSendingMsg(false);
    }
  };

  const openViewer = (storyIndex) => navigation.navigate('StoryViewer', { stories, initialIndex: storyIndex });

  const renderFeedItem = ({ item, index }) => {
    const isVideo = item.media_type === 'video';
    const isMyStory = item.user_id === user?.id;
    const currentInputText = messageText[item.id] || '';
    const canSend = !!currentInputText.trim() && !sendingMsg;

    const mediaUri = fullUrl(item.media_url);
    const avatarUri = fullUrl(item.avatar_url);

    return (
      <View style={{ marginBottom: 14, backgroundColor: colors.bg }}>
        {/* En-tête (Avatar, Nom, Heure) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => openViewer(index)}>
            <View style={{ padding: 2, borderRadius: 24, borderWidth: 2, borderColor: colors.primary }}>
              <Avatar name={item.display_name} size={32} uri={avatarUri} />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: '700', color: colors.text, fontSize: 14 }} numberOfLines={1}>
              {isMyStory ? 'Vous' : item.display_name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 1 }}>
              {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* Média Plein Écran */}
        <TouchableOpacity activeOpacity={0.95} onPress={() => openViewer(index)}>
          <FullMedia
            uri={mediaUri}
            isVideo={isVideo}
            isVisible={index === visibleIndex}
            isScreenFocused={isFocused}
          />
          {isVideo && (
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, padding: 6 }}>
              <Ionicons name="videocam" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Barre d'actions (Réactions) */}
        {!isMyStory ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8 }}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={(e) => reactToStory(item.id, emoji, e)}
                activeOpacity={0.6}
                hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 26 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12 }}>
            <Ionicons name="eye-outline" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 6 }}>Votre story</Text>
          </View>
        )}

        {/* Zone de texte / Réponse */}
        {!isMyStory && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6 }}>
            <Avatar name={user?.display_name || 'Moi'} size={26} uri={fullUrl(user?.avatar_url)} />
            <TextInput
              value={currentInputText}
              onChangeText={(text) => setMessageText((prev) => ({ ...prev, [item.id]: text }))}
              placeholder="Ajouter une réponse…"
              placeholderTextColor={colors.muted}
              style={{ flex: 1, marginLeft: 10, paddingVertical: 8, color: colors.text, fontSize: 14 }}
            />
            {sendingMsg && canSend === false && currentInputText ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity
                onPress={() => sendDirectMessage(item.id, item.username)}
                disabled={!canSend}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ opacity: canSend ? 1 : 0 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Envoyer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // Groupes de stories par utilisateur (rangée du haut)
  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) acc[story.user_id] = [];
    acc[story.user_id].push(story);
    return acc;
  }, {});
  const storyGroups = Object.values(groupedStories);
  const myFirstIndex = stories.findIndex((s) => s.user_id === user?.id);
  const otherGroups = storyGroups.filter((g) => g[0].user_id !== user?.id);

  const renderTray = () => (
    <View style={{ paddingTop: 12, paddingBottom: 12, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <StoryBubble
          label="Votre story"
          name={user?.display_name || 'Moi'}
          uri={fullUrl(user?.avatar_url)}
          colors={colors}
          ring={myFirstIndex >= 0}
          plus
          onPress={() => (myFirstIndex >= 0 ? openViewer(myFirstIndex) : addStory())}
          onPlusPress={addStory}
        />
        {otherGroups.map((group) => {
          const first = group[0];
          return (
            <StoryBubble
              key={first.user_id}
              label={(first.display_name || '').split(' ')[0]}
              name={first.display_name}
              uri={fullUrl(first.avatar_url)}
              colors={colors}
              onPress={() => openViewer(stories.findIndex((s) => s.user_id === first.user_id))}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Barre du haut (ABYSS + icônes ajout/refresh) */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12) + 4,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: colors.bg,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
          zIndex: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: 1.5 }}>ABYSS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={addStory} disabled={uploadingStory} style={{ marginRight: 18 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {uploadingStory ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="add-circle-outline" size={27} color={colors.text} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={loadStories} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="reload" size={23} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {activeReactions.map((r) => (
        <FloatingReaction
          key={r.id}
          emoji={r.emoji}
          startX={r.x}
          startY={r.y}
          onComplete={() => setActiveReactions((prev) => prev.filter((item) => item.id !== r.id))}
        />
      ))}

      <FlatList
        data={stories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={renderTray}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 32 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera-outline" size={46} color={colors.text} />
            </View>
            <Text style={{ color: colors.text, marginTop: 20, textAlign: 'center', fontSize: 20, fontWeight: '800' }}>Partagez une photo</Text>
            <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
              Publiez une photo ou une vidéo pour lancer votre fil.
            </Text>
            <TouchableOpacity onPress={addStory} activeOpacity={0.8} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Publier une story</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderFeedItem}
      />

      {/* Floating Action Button (FAB) : Gros bouton + en bas */}
      <TouchableOpacity
        onPress={addStory}
        disabled={uploadingStory}
        activeOpacity={0.85}
        style={{
          position: 'absolute', right: 20, bottom: Math.max(insets.bottom, 20) + 10,
          width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
        }}
      >
        {uploadingStory ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={34} color="#fff" />}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
