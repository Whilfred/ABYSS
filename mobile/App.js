import React, { useEffect } from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AuthProvider, useAuth } from './src/auth';
import { ThemeProvider, useTheme } from './src/ThemeContext'; 
import { initDB } from './src/db';
import { api } from './src/api';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatInfoScreen from './src/screens/ChatInfoScreen';
import GroupInfoScreen from './src/screens/GroupInfoScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import WalletScreen from './src/screens/WalletScreen';
import DepositScreen from './src/screens/DepositScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StoryViewerScreen from './src/screens/StoryViewerScreen';

// Configuration de l'affichage des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Fonction pour enregistrer le token push
async function registerForPushNotifications() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission de notification refusée');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    
    // Envoi au backend
    await api.post('/users/push-token', { token, platform: Platform.OS });
    console.log('Token push enregistré:', token);
  } catch (error) {
    console.log('Erreur lors de l\'enregistrement du token:', error);
  }
}

function Tabs() {
  const { colors } = useTheme(); 
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { 
        backgroundColor: colors.surface, 
        borderTopColor: colors.border,
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom,
      },
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { fontWeight: '800', color: colors.primary },
      tabBarIcon: ({ color, size }) => {
        let iconName;
        if (route.name === 'Accueil') iconName = 'home';
        else if (route.name === 'Discussions') iconName = 'chatbubbles';
        else if (route.name === 'Portefeuille') iconName = 'wallet';
        else iconName = 'person-circle';
        
        return <Ionicons name={iconName} color={color} size={size} />;
      },
    })}>
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Discussions" component={ChatsScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="Portefeuille" component={WalletScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme(); 

  // Enregistrer le token push dès que l'utilisateur est connecté
  useEffect(() => {
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);
  
  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg }
      }}
    >
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="ChatInfo" component={ChatInfoScreen} options={{ title: 'Infos de la discussion', headerBackTitle: 'Retour' }} />
          <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Infos du groupe' }} />
          <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Nouvelle discussion' }} />
          <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: 'Nouveau groupe' }} />
          <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: 'Déposer' }} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Retirer' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres' }} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ headerShown: false, animation: 'fade' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Créer un compte' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

function Navigation() {
  const { isDark, colors } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Root />
    </NavigationContainer>
  );
}

export default function App() {
  React.useEffect(() => {
    initDB();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
