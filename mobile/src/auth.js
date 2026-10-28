import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { io } from 'socket.io-client';
import { api, setToken } from './api';
import { SERVER_URL } from './config';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

  const start = useCallback((token, u) => {
    setToken(token);
    setUser(u);
    setSocket((old) => { 
      old?.disconnect(); 
      return io(SERVER_URL, { auth: { token }, transports: ['websocket'] }); 
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // 1. On récupère le token sauvegardé et les infos utilisateur en cache
        const token = await SecureStore.getItemAsync('abyss_token');
        const cachedUser = await SecureStore.getItemAsync('abyss_user');

        if (token) {
          setToken(token);
          
          // On connecte l'utilisateur IMMÉDIATEMENT avec le cache (pour éviter l'écran de chargement)
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
            setSocket(io(SERVER_URL, { auth: { token }, transports: ['websocket'] }));
            setLoading(false); 
          }

          // 2. On vérifie en arrière-plan si le token est toujours valide
          try {
            const { data } = await api.get('/auth/me');
            start(token, data.user);
            await SecureStore.setItemAsync('abyss_user', JSON.stringify(data.user)); // Mise à jour du cache
          } catch (e) {
            // Si le serveur répond 401 (Non autorisé), le token est vraiment expiré
            if (e.response && e.response.status === 401) {
              await SecureStore.deleteItemAsync('abyss_token');
              await SecureStore.deleteItemAsync('abyss_user');
              setToken(null);
              setUser(null);
            } else {
              // Si c'est une erreur réseau (Render endormi, pas d'internet), on GARDE l'utilisateur connecté !
              console.log('Serveur injoignable, on garde la session locale.');
            }
          }
        }
      } catch (err) {
        console.log('Erreur de restauration de session', err);
      } finally { 
        setLoading(false); 
      }
    })();
  }, [start]);

  const authenticate = async (path, payload) => {
    const { data } = await api.post('/auth/' + path, payload);
    await SecureStore.setItemAsync('abyss_token', data.token);
    await SecureStore.setItemAsync('abyss_user', JSON.stringify(data.user)); // On sauvegarde les infos
    start(data.token, data.user);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('abyss_token');
    await SecureStore.deleteItemAsync('abyss_user');
    socket?.disconnect(); 
    setSocket(null); 
    setToken(null); 
    setUser(null);
  };

  const refreshUser = async () => { 
    const { data } = await api.get('/auth/me'); 
    setUser(data.user); 
    await SecureStore.setItemAsync('abyss_user', JSON.stringify(data.user));
  };

  return (
    <Ctx.Provider value={{ user, socket, loading, login: (p) => authenticate('login', p), register: (p) => authenticate('register', p), logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}
