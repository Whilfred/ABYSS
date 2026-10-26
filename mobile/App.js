import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth';
import { colors } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatInfoScreen from './src/screens/ChatInfoScreen'; // <-- AJOUT
import NewChatScreen from './src/screens/NewChatScreen';
import NewGroupScreen from './src/screens/NewGroupScreen';
import WalletScreen from './src/screens/WalletScreen';
import DepositScreen from './src/screens/DepositScreen';
import WithdrawScreen from './src/screens/WithdrawScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarActiveTintColor: colors.primary,
      headerTitleStyle: { fontWeight: '800', color: colors.primary },
      tabBarIcon: ({ color, size }) => (
        <Ionicons color={color} size={size}
          name={route.name === 'Discussions' ? 'chatbubbles' : route.name === 'Portefeuille' ? 'wallet' : 'person-circle'} />
      ),
    })}>
      <Tab.Screen name="Discussions" component={ChatsScreen} options={{ title: 'ABYSS' }} />
      <Tab.Screen name="Portefeuille" component={WalletScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="ChatInfo" component={ChatInfoScreen} options={{ title: 'Infos de la discussion', headerBackTitle: 'Retour' }} />
          <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'Nouvelle discussion' }} />
          <Stack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: 'Nouveau groupe' }} />
          <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: 'Déposer' }} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Retirer' }} />
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

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Root />
      </NavigationContainer>
    </AuthProvider>
  );
}
