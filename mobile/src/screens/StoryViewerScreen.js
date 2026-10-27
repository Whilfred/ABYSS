import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video'; 
import { useEvent } from 'expo'; 
import { api, errMsg } from '../api';
import { SERVER_URL } from '../config';
import { useAuth } from '../auth'; 
import { useTheme } from '../ThemeContext';

const { width, height } = Dimensions.get('window');
const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥'];

// --- COMPOSANT D'ANIMATION DE L'EMOJI ---
function FloatingEmoji({ emoji, onComplete }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200, // Monte de 200px
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0, // Disparaît
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.5, // Grossit
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      bottom: 100,
      alignSelf: 'center',
      transform: [{ translateY }, { scale }],
      opacity,
      zIndex: 100,
    }}>
      <Text style={{ fontSize: 60 }}>{emoji}</Text>
    </Animated.View>
  );
}

function StoryVideo({ uri, onFinish }) {
  const player = useVideoPlayer(uri, (player) => {
    player.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      onFinish();
    });
    return () => subscription.remove();
  }, [player, onFinish]);

  return (
    <VideoView 
      player={player} 
      style={{ width, height }} 
      contentFit="contain" 
      nativeControls={false}
    />
  );
}

export default function StoryViewerScreen({ route, navigation }) {
  const { stories, initialIndex } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth(); 
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [activeEmoji, setActiveEmoji] = useState(null); // <-- Emoji en cours d'animation
  const [viewsCount, setViewsCount] = useState(0); 

  const currentStory = stories[currentIndex];
  const isMine = currentStory?.user_id === user?.id;

  useEffect(() => {
    if (currentStory && !isMine) {
      api.post(`/stories/${currentStory.id}/view`).catch(() => {});
    }
    if (currentStory && isMine) {
      api.get(`/stories/${currentStory.id}/views`)
        .then(r => setViewsCount(r.data.length))
        .catch(() => {});
    }
  }, [currentIndex, currentStory, isMine]);

  useEffect(() => {
    let timer;
    if (currentStory?.media_type === 'image') {
      setProgress(0);
      timer = setInterval(() => {
        setProgress(p => {
          if (p >= 1) {
            clearInterval(timer);
            nextStory();
            return 0;
          }
          return p + 0.02; 
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [currentIndex, currentStory]);

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.goBack();
    }
  };

  const prevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const reactToStory = async (emoji) => {
    try {
      // On lance l'animation immédiatement (optimistic UI)
      setActiveEmoji({ emoji, id: Date.now() });
      
      // On envoie la requête en arrière-plan
      await api.post(`/stories/${currentStory.id}/react`, { emoji });
    } catch (e) {
      // Si erreur, on peut l'afficher, mais l'animation a déjà eu lieu
      console.log('Erreur réaction:', errMsg(e));
    }
  };

  if (!currentStory) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Barre de progression */}
      <View style={{ flexDirection: 'row', position: 'absolute', top: 50, left: 10, right: 10, zIndex: 10 }}>
        {stories.map((_, i) => (
          <View key={i} style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2, borderRadius: 2 }}>
            <View style={{ 
              width: i === currentIndex ? `${progress * 100}%` : i < currentIndex ? '100%' : '0%', 
              height: '100%', backgroundColor: '#fff', borderRadius: 2 
            }} />
          </View>
        ))}
      </View>

      {/* En-tête */}
      <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 70, left: 15, right: 15, zIndex: 10, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image 
            source={{ uri: currentStory.avatar_url ? SERVER_URL + currentStory.avatar_url : 'https://ui-avatars.com/api/?name=' + currentStory.display_name }} 
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} 
          />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{currentStory.display_name}</Text>
        </View>

        {isMine && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 }}>
            <Ionicons name="eye" size={16} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 5, fontWeight: '700' }}>{viewsCount}</Text>
          </View>
        )}
      </View>

      {/* Bouton Fermer */}
      <TouchableOpacity style={{ position: 'absolute', top: 70, right: 15, zIndex: 10 }} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Média (Image ou Vidéo) */}
      {currentStory.media_type === 'image' ? (
        <Image source={{ uri: SERVER_URL + currentStory.media_url }} style={{ width, height, resizeMode: 'contain' }} />
      ) : (
        <StoryVideo uri={SERVER_URL + currentStory.media_url} onFinish={nextStory} />
      )}

      {/* Zones de clic */}
      <TouchableOpacity style={{ position: 'absolute', left: 0, top: 100, bottom: 100, width: width / 3 }} onPress={prevStory} />
      <TouchableOpacity style={{ position: 'absolute', right: 0, top: 100, bottom: 100, width: width / 3 }} onPress={nextStory} />

      {/* Animation de l'emoji qui monte */}
      {activeEmoji && (
        <FloatingEmoji 
          key={activeEmoji.id} 
          emoji={activeEmoji.emoji} 
          onComplete={() => setActiveEmoji(null)} 
        />
      )}

      {/* Barre de réactions */}
      {!isMine && (
        <View style={{ 
          position: 'absolute', bottom: 40, left: 0, right: 0, 
          flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 10 
        }}>
          {REACTIONS.map(emoji => (
            <TouchableOpacity 
              key={emoji} 
              onPress={() => reactToStory(emoji)}
              style={{ 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                width: 50, height: 50, borderRadius: 25, 
                alignItems: 'center', justifyContent: 'center', 
                marginHorizontal: 6 
              }}
            >
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

    </View>
  );
}
