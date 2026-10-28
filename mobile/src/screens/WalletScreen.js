import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api, fcfa } from '../api';
import { useAuth } from '../auth';
import { useTheme } from '../ThemeContext';

const label = (t, me) => {
  if (t.type === 'deposit') return `Dépôt · ${t.provider}`;
  if (t.type === 'withdraw') return `Retrait · ${t.provider}`;
  return t.from_user === me ? `Envoyé à ${t.to_name}` : `Reçu de ${t.from_name}`;
};

const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const dayLabel = (d) => {
  const date = new Date(d);
  const now = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yest.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

const STATUS = {
  pending: { text: 'En attente', color: '#E08A00' },
  failed: { text: 'Échec', color: '#D32F2F' },
};

export default function WalletScreen({ navigation }) {
  const { user, socket } = useAuth();
  const { colors } = useTheme();
  const success = colors.success || '#2E9E3E';

  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const header = (
    <View style={{ padding: 12, paddingBottom: 4 }}>
      {/* Carte de solde */}
      <View style={{ backgroundColor: colors.primary, borderRadius: 22, padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginLeft: 6, fontSize: 14 }}>Solde disponible</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 8, marginBottom: 16 }}>{fcfa(balance)}</Text>

        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Deposit')}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 14, marginRight: 8 }}
          >
            <Ionicons name="arrow-down-circle" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', marginLeft: 6 }}>Déposer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Withdraw')}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)', paddingVertical: 12, borderRadius: 14 }}
          >
            <Ionicons name="arrow-up-circle" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>Retirer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Avertissement PIN */}
      {!user.has_pin ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4E5', padding: 12, borderRadius: 14, marginTop: 12 }}>
          <Ionicons name="lock-closed" size={20} color="#8A5300" />
          <Text style={{ color: '#8A5300', flex: 1, marginLeft: 10, fontSize: 13, lineHeight: 18 }}>
            Créez votre code PIN dans l'onglet Profil pour pouvoir envoyer ou retirer de l'argent.
          </Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 20, marginLeft: 4 }}>Historique</Text>
    </View>
  );

  return (
    <FlatList
      data={txs}
      keyExtractor={(t) => String(t.id)}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32 }}>
          <Ionicons name="receipt-outline" size={56} color={colors.muted} />
          <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 10, fontSize: 15 }}>Aucune transaction</Text>
        </View>
      }
      renderItem={({ item: t, index }) => {
        const incoming = t.type === 'deposit' || (t.type === 'transfer' && t.to_user === user.id);
        const tint = incoming ? success : colors.primary;
        const prev = txs[index - 1];
        const showDay = !prev || !sameDay(prev.created_at, t.created_at);
        const st = t.status !== 'success' ? (STATUS[t.status] || { text: t.status, color: colors.muted }) : null;

        return (
          <View>
            {showDay ? (
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
                {dayLabel(t.created_at)}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, backgroundColor: colors.surface }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={incoming ? 'arrow-down' : 'arrow-up'} size={20} color={tint} />
              </View>

              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingRight: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', fontSize: 15, color: colors.text }} numberOfLines={1}>{label(t, user.id)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {hhmm(t.created_at)}{t.reference ? ` · ${t.reference}` : ''}
                    </Text>
                    {st ? (
                      <View style={{ backgroundColor: st.color + '22', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 }}>
                        <Text style={{ color: st.color, fontSize: 11, fontWeight: '700' }}>{st.text}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: incoming ? success : colors.text }}>
                    {incoming ? '+' : '−'}{fcfa(t.amount)}
                  </Text>
                  {Number(t.fee) > 0 ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>frais {fcfa(t.fee)}</Text> : null}
                </View>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}
