import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Dimensions, TextInput, Alert, Platform, Animated } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api, errMsg } from '../api';
import { SERVER_URL } from '../config';
import { Avatar } from '../components/UI';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../auth';

const { width } = Dimensions.get('window');
const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥'];

// --- COMPOSANT D'ANIMATION POUR LES REACTIONS ---
function FloatingReaction({ emoji, startX, startY, onComplete }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Trajectoire aléatoire pour l'effet "cinéma"
    const randomX = (Math.random() - 0.5) * 150; // Entre -75 et +75
    const randomRotate = (Math.random() - 0.5) * 90; // Entre -45 et +45 degrés

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -250 - Math.random() * 100, // Monte de 250 à 350px
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 2, // Grossit jusqu'à 2x
        friction: 4,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: randomRotate,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []);

  const spin = rotate.interpolate({
    inputRange: [-45, 45],
    outputRange: ['-45deg', '45deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        transform: [{ translateY }, { translateX }, { scale }, { rotate: spin }],
        opacity,
        zIndex: 999,
      }}
    >
      <Text style={{ fontSize: 60 }}>{emoji}</Text>
    </Animated.View>
  );
}

// --- COMPOSANT POUR UNE VIDÉO DANS LE FIL ---
function FeedVideo({ uri, isVisible, isScreenFocused }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
  });

  useEffect(() => {
    if (isVisible && isScreenFocused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, isScreenFocused, player]);

  return (
    <VideoView 
      player={player} 
      style={{ width: '100%', height: 350 }} 
      contentFit="cover" 
      nativeControls={false}
    />
  );
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  
  const [stories, setStories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [activeReactions, setActiveReactions] = useState([]); // <-- State pour les animations

  const loadStories = useCallback(() => {
    api.get('/stories').then(r => setStories(r.data)).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const reactToStory = async (storyId, emoji, event) => {
    // Récupérer la position du clic
    const { pageX, pageY } = event.nativeEvent;
    
    // Créer une nouvelle réaction animée
    const newReaction = {
      id: Date.now() + Math.random(),
      emoji,
      x: pageX - 30, // Centrer l'emoji
      y: pageY - 30,
    };
    
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
    
    return (
      <View style={{ 
        backgroundColor: colors.surface, 
        marginBottom: 15, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border,
        paddingBottom: 10
      }}>
        {/* En-tête de la story (Avatar + Nom + Heure) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
          <Avatar 
            name={item.display_name} 
            size={44} 
            uri={item.avatar_url ? SERVER_URL + item.avatar_url : null} 
          />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }}>{item.display_name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* Média de la story (Image ou Vidéo) */}
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
              style={{ width: '100%', height: 350, resizeMode: 'cover' }} 
            />
          )}
        </TouchableOpacity>

        {/* Barre de réactions (seulement si ce n'est pas ma story) */}
        {!isMyStory && (
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-around', 
            paddingVertical: 12, 
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border
          }}>
            {REACTIONS.map(emoji => (
              <TouchableOpacity 
                key={emoji} 
                onPress={(e) => reactToStory(item.id, emoji, e)} // <-- Passer l'événement
                style={{ 
                  padding: 8, 
                  borderRadius: 20,
                  backgroundColor: colors.bg,
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pied de la story (Voir la story) */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {isMyStory ? 'Votre story' : 'Appuyez pour voir en grand'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>

        {/* Barre de message rapide */}
        {!isMyStory && (
          <View style={{ flexDirection: 'row', padding: 10, alignItems: 'center' }}>
            <TextInput 
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Répondre à la story..."
              placeholderTextColor={colors.muted}
              style={{ 
                flex: 1, 
                backgroundColor: colors.bg, 
                borderRadius: 20, 
                paddingHorizontal: 15, 
                paddingVertical: 10, 
                color: colors.text,
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: 80
              }}
              multiline
            />
            <TouchableOpacity 
              onPress={() => sendDirectMessage(item.username)}
              disabled={!messageText.trim() || sendingMsg}
              style={{ 
                marginLeft: 10, 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: colors.primary, 
                alignItems: 'center', 
                justifyContent: 'center',
                opacity: messageText.trim() ? 1 : 0.5
              }}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* En-tête de l'accueil */}
      <View style={{ 
        padding: 15, 
        backgroundColor: colors.surface, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>ABYSS</Text>
          <TouchableOpacity onPress={loadStories}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 15, color: colors.muted, marginTop: 4, fontWeight: '500' }}>
          Les stories de vos contacts
        </Text>
      </View>

      {/* --- RENDU DES ANIMATIONS --- */}
      {activeReactions.map(r => (
        <FloatingReaction 
          key={r.id} 
          emoji={r.emoji} 
          startX={r.x} 
          startY={r.y} 
          onComplete={() => {
            setActiveReactions(prev => prev.filter(item => item.id !== r.id));
          }}
        />
      ))}

      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="images-outline" size={60} color={colors.border} />
            <Text style={{ color: colors.muted, marginTop: 15, textAlign: 'center', fontSize: 16 }}>
              Aucune story pour le moment.{'\n'}Revenez plus tard !
            </Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}
