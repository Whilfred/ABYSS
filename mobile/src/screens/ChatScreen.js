import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, errMsg, fcfa } from '../api';
import { useAuth } from '../auth';
import MoneyModal from '../components/MoneyModal';
import PinModal from '../components/PinModal';
import { colors } from '../theme';

const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function Bubble({ m, mine, isGroup, delivered, read, onPay, onDecline }) {
  const isMoney = m.type === 'money';
  const isReq = m.type === 'money_request';
  const bg = mine ? colors.primary : colors.bubbleOther;
  const fg = mine ? '#fff' : colors.text;
  const sub = mine ? 'rgba(255,255,255,0.75)' : colors.muted;
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginVertical: 3, marginHorizontal: 10 }}>
      <View style={{ backgroundColor: bg, borderRadius: 16, padding: 10, borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4 }}>
        {isGroup && !mine ? <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 2 }}>{m.sender_name}</Text> : null}
        {isMoney || isReq ? (
          <View style={{ minWidth: 190 }}>
            <Text style={{ color: sub, fontWeight: '600', fontSize: 12 }}>{isMoney ? (mine ? 'ARGENT ENVOYÉ' : 'ARGENT REÇU') : 'DEMANDE D\'ARGENT'}</Text>
            <Text style={{ color: fg, fontSize: 24, fontWeight: '800', marginVertical: 4 }}>{fcfa(m.meta?.amount)}</Text>
            {m.body ? <Text style={{ color: fg }}>{m.body}</Text> : null}
            {isReq && m.meta?.status !== 'pending' ? (
              <Text style={{ color: sub, marginTop: 4, fontWeight: '700' }}>{m.meta.status === 'paid' ? '✓ Payée' : '✕ Refusée'}</Text>) : null}
            {isReq && m.meta?.status === 'pending' && !mine ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity onPress={() => onPay(m)} style={{ backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginRight: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Payer</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDecline(m)} style={{ backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 }}>
                  <Text style={{ color: colors.danger, fontWeight: '700' }}>Refuser</Text></TouchableOpacity>
              </View>) : null}
            {isReq && m.meta?.status === 'pending' && mine ? <Text style={{ color: sub, marginTop: 4 }}>En attente…</Text> : null}
            {isMoney ? <Text style={{ color: sub, fontSize: 11, marginTop: 4 }}>Réf. {m.meta?.reference}</Text> : null}
          </View>
        ) : <Text style={{ color: fg, fontSize: 16 }}>{m.body}</Text>}
        <Text style={{ color: sub, fontSize: 11, alignSelf: 'flex-end', marginTop: 3 }}>
          {hhmm(m.created_at)}{mine ? (read ? '  ✓✓' : '  ✓') : ''}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { id, title, type, peerUsername, peerName } = route.params;
  const { user, socket } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [reads, setReads] = useState({});
  const [text, setText] = useState('');
  const [money, setMoney] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [pinErr, setPinErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isGroup = type === 'group';

  useEffect(() => {
    navigation.setOptions({ title, headerRight: !isGroup ? () => (
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => setMoney('request')} style={{ marginRight: 18 }}><Ionicons name="download-outline" size={24} color={colors.primary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setMoney('send')}><Ionicons name="cash-outline" size={26} color={colors.primary} /></TouchableOpacity>
      </View>) : undefined });
  }, [navigation, title, isGroup]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/conversations/${id}/messages`);
    setMsgs(data.messages);
    setReads(Object.fromEntries(data.reads.map((r) => [r.user_id, r.last_read_at])));
  }, [id]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (m) => {
      if (m.conversation_id !== id) return;
      setMsgs((p) => (p.some((x) => x.id === m.id) ? p : [m, ...p]));
      if (m.sender_id !== user.id) api.post(`/conversations/${id}/read`).catch(() => {});
    };
    const onUpd = (m) => { if (m.conversation_id === id) setMsgs((p) => p.map((x) => (x.id === m.id ? m : x))); };
    const onRead = (e) => { if (e.conversation_id === id) setReads((p) => ({ ...p, [e.user_id]: e.at })); };
    socket.on('message:new', onNew); socket.on('message:update', onUpd); socket.on('conversation:read', onRead);
    return () => { socket.off('message:new', onNew); socket.off('message:update', onUpd); socket.off('conversation:read', onRead); };
  }, [socket, id, user.id]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try { await api.post(`/conversations/${id}/messages`, { body }); }
    catch (e) { setText(body); Alert.alert('Erreur', errMsg(e)); }
  };

  const isRead = (m) => Object.entries(reads).some(([uid, at]) => uid !== user.id && new Date(at) >= new Date(m.created_at));

  const pay = async (pin) => {
    setBusy(true); setPinErr('');
    try { await api.post(`/wallet/requests/${payFor.meta.request_id}/pay`, { pin }); setPayFor(null); }
    catch (e) { setPinErr(errMsg(e)); } finally { setBusy(false); }
  };
  const decline = (m) => Alert.alert('Refuser la demande ?', fcfa(m.meta.amount), [
    { text: 'Non', style: 'cancel' },
    { text: 'Refuser', style: 'destructive', onPress: () => api.post(`/wallet/requests/${m.meta.request_id}/decline`).catch((e) => Alert.alert('Erreur', errMsg(e))) }]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList inverted data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => (
          <Bubble m={item} mine={item.sender_id === user.id} isGroup={isGroup} read={isRead(item)}
            onPay={(m) => { setPinErr(''); setPayFor(m); }} onDecline={decline} />)} />
      <View style={{ flexDirection: 'row', padding: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={colors.muted} multiline
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 120, fontSize: 16 }} />
        <TouchableOpacity onPress={send} disabled={!text.trim()} style={{ marginLeft: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.5 }}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <MoneyModal visible={!!money} mode={money} onClose={() => setMoney(null)} conversationId={id} peerUsername={peerUsername} peerName={peerName} />
      <PinModal visible={!!payFor} loading={busy} error={pinErr} onCancel={() => setPayFor(null)} onSubmit={pay}
        title={`Payer ${payFor ? fcfa(payFor.meta.amount) : ''}`} />
    </KeyboardAvoidingView>
  );
}
