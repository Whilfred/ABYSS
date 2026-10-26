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
    setSocket((old) => { old?.disconnect(); return io(SERVER_URL, { auth: { token }, transports: ['websocket'] }); });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('abyss_token');
        if (token) {
          setToken(token);
          const { data } = await api.get('/auth/me');
          start(token, data.user);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [start]);

  const authenticate = async (path, payload) => {
    const { data } = await api.post('/auth/' + path, payload);
    await SecureStore.setItemAsync('abyss_token', data.token);
    start(data.token, data.user);
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync('abyss_token');
    socket?.disconnect(); setSocket(null); setToken(null); setUser(null);
  };
  const refreshUser = async () => { const { data } = await api.get('/auth/me'); setUser(data.user); };

  return (
    <Ctx.Provider value={{ user, socket, loading, login: (p) => authenticate('login', p), register: (p) => authenticate('register', p), logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}
