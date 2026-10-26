import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, fcfa } from '../api';
import { useAuth } from '../auth';
import { Button } from '../components/UI';
import { colors } from '../theme';

const label = (t, me) => {
  if (t.type === 'deposit') return `Dépôt · ${t.provider}`;
  if (t.type === 'withdraw') return `Retrait · ${t.provider}`;
  return t.from_user === me ? `Envoyé à ${t.to_name}` : `Reçu de ${t.from_name}`;
};

export default function WalletScreen({ navigation }) {
  const { user, socket } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState([]);
  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([api.get('/wallet'), api.get('/wallet/transactions')]);
      setBalance(w.data.balance); setTxs(t.data);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!socket) return;
    socket.on('wallet:update', load);
    return () => socket.off('wallet:update', load);
  }, [socket, load]);

  return (
    <FlatList data={txs} keyExtractor={(t) => t.id} style={{ backgroundColor: '#fff' }}
      ListHeaderComponent={
        <View style={{ padding: 16 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 20, padding: 22 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>Solde disponible</Text>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', marginVertical: 8 }}>{fcfa(balance)}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <TouchableOpacity onPress={() => navigation.navigate('Deposit')} style={{ flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, alignItems: 'center', marginRight: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>Déposer</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Withdraw')} style={{ flex: 1, backgroundColor: colors.primaryDark, padding: 12, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Retirer</Text></TouchableOpacity>
            </View>
          </View>
          {!user.has_pin ? (
            <View style={{ backgroundColor: '#FFF4E5', padding: 12, borderRadius: 12, marginTop: 14 }}>
              <Text style={{ color: '#8A5300' }}>🔒 Créez votre code PIN dans l'onglet Profil pour pouvoir envoyer ou retirer de l'argent.</Text>
            </View>) : null}
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 22 }}>Historique</Text>
        </View>}
      ListEmptyComponent={<Text style={{ textAlign: 'center', color: colors.muted, marginTop: 20 }}>Aucune transaction</Text>}
      renderItem={({ item: t }) => {
        const incoming = t.type === 'deposit' || (t.type === 'transfer' && t.to_user === user.id);
        return (
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{label(t, user.id)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                {new Date(t.created_at).toLocaleString('fr-FR')} · {t.reference}{t.status !== 'success' ? ` · ${t.status}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '800', color: incoming ? colors.success : colors.text }}>{incoming ? '+' : '−'}{fcfa(t.amount)}</Text>
              {Number(t.fee) > 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>frais {fcfa(t.fee)}</Text> : null}
            </View>
          </View>);
      }} />
  );
}
