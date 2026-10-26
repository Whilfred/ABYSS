import axios from 'axios';
import { SERVER_URL } from './config';
export const api = axios.create({ baseURL: SERVER_URL + '/api', timeout: 15000 });
let token = null;
export const setToken = (t) => { token = t; };
api.interceptors.request.use((c) => { if (token) c.headers.Authorization = 'Bearer ' + token; return c; });
export const errMsg = (e) => e?.response?.data?.error || 'Erreur réseau. Vérifiez votre connexion.';
export const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
