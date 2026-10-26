import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, errMsg, fcfa } from '../api';
import { SERVER_URL } from '../config';
import { useAuth } from '../auth';
import MoneyModal from '../components/MoneyModal';
import PinModal from '../components/PinModal';
import { colors } from '../theme';

const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function Bubble({ m, mine, isGroup, read, onPay, onDecline }) {
  const isMoney = m.type === 'money';
  const isReq = m.type === 'money_request';
  const isImage = m.type === 'image';
  const isFile = m.type === 'file';
  
  const bg = mine ? colors.primary : colors.bubbleOther;
  const fg = mine ? '#fff' : colors.text;
  const sub = mine ? 'rgba(255,255,255,0.75)' : colors.muted;

  const downloadFile = async () => {
    try {
      const fileUri = FileSystem.documentDirectory + m.file_name;
      const { uri } = await FileSystem.downloadAsync(SERVER_URL + m.file_url, fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Téléchargé', 'Le fichier a été téléchargé dans ' + uri);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de télécharger le fichier.');
    }
  };

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginVertical: 4, marginHorizontal: 10 }}>
      <View style={{ 
        backgroundColor: bg, 
        borderRadius: 18, 
        padding: (isImage || isFile) ? 5 : 12, 
        borderBottomRightRadius: mine ? 4 : 18, 
        borderBottomLeftRadius: mine ? 18 : 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
      }}>
        {isGroup && !mine ? <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 4, marginLeft: 4 }}>{m.sender_name}</Text> : null}
        
        {isMoney || isReq ? (
          <View style={{ minWidth: 200, padding: 4 }}>
            <Text style={{ color: sub, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>{isMoney ? (mine ? 'ARGENT ENVOYÉ' : 'ARGENT REÇU') : 'DEMANDE D\'ARGENT'}</Text>
            <Text style={{ color: fg, fontSize: 26, fontWeight: '900', marginVertical: 6 }}>{fcfa(m.meta?.amount)}</Text>
            {m.body ? <Text style={{ color: fg, marginBottom: 8 }}>{m.body}</Text> : null}
            {isReq && m.meta?.status !== 'pending' ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: isReq && m.meta.status === 'paid' ? '#E8F5E9' : '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: m.meta.status === 'paid' ? '#2E7D32' : '#C62828', fontWeight: '700', fontSize: 12 }}>{m.meta.status === 'paid' ? '✓ Payée' : '✕ Refusée'}</Text>
              </View>) : null}
            {isReq && m.meta?.status === 'pending' && !mine ? (
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <TouchableOpacity onPress={() => onPay(m)} style={{ backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginRight: 8 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Payer</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDecline(m)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 }}>
                  <Text style={{ color: fg, fontWeight: '700' }}>Refuser</Text></TouchableOpacity>
              </View>) : null}
            {isReq && m.meta?.status === 'pending' && mine ? <Text style={{ color: sub, marginTop: 4, fontStyle: 'italic' }}>En attente…</Text> : null}
            {isMoney ? <Text style={{ color: sub, fontSize: 11, marginTop: 6 }}>Réf. {m.meta?.reference}</Text> : null}
          </View>
        ) : isImage ? (
          <View>
            <Image source={{ uri: SERVER_URL + m.file_url }} style={{ width: 240, height: 240, borderRadius: 14 }} resizeMode="cover" />
            {m.body ? <Text style={{ color: fg, marginTop: 6, marginHorizontal: 6, marginBottom: 2 }}>{m.body}</Text> : null}
          </View>
        ) : isFile ? (
          <TouchableOpacity onPress={downloadFile} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, minWidth: 220 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : '#E8EFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text" size={24} color={fg} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ color: fg, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{m.file_name}</Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 2 }}>Appuyez pour ouvrir</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: fg, fontSize: 16, lineHeight: 22, paddingHorizontal: 4 }}>{m.body}</Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, marginRight: 4 }}>
          <Text style={{ color: sub, fontSize: 10, marginRight: 4 }}>
            {hhmm(m.created_at)}
          </Text>
          {mine && <Ionicons name={read ? "checkmark-done" : "checkmark"} size={14} color={read ? "#34B7F1" : sub} />}
        </View>
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
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false); 
  const isGroup = type === 'group';

  useEffect(() => {
    navigation.setOptions({ 
      title: '', // On vide le titre par défaut
      headerTitle: () => (
        <TouchableOpacity 
          style={{ alignItems: 'center' }} 
          onPress={() => navigation.navigate('ChatInfo', { id, title, type, peerUsername, peerName })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Appuyez pour les infos</Text>
        </TouchableOpacity>
      ),
      headerRight: !isGroup ? () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setMoney('request')} style={{ marginRight: 18 }}><Ionicons name="download-outline" size={24} color={colors.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setMoney('send')}><Ionicons name="cash-outline" size={26} color={colors.primary} /></TouchableOpacity>
        </View>) : undefined 
    });
  }, [navigation, title, isGroup, id, peerUsername, peerName]);

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
    try { await api.post(`/conversations/${id}/messages`, { body, type: 'text' }); }
    catch (e) { setText(body); Alert.alert('Erreur', errMsg(e)); }
  };

  const handleUpload = async (type) => {
    setShowAttach(false);
    try {
      let result;
      if (type === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      } else {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      }

      if (!result.canceled) {
        setUploading(true);
        const file = result.assets[0];
        const formData = new FormData();
        formData.append('fichier', {
          uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
          name: file.name || 'fichier',
          type: file.mimeType || (type === 'image' ? 'image/jpeg' : 'application/octet-stream'),
        });

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        await api.post(`/conversations/${id}/messages`, {
          type: type === 'image' ? 'image' : 'file',
          file_url: uploadRes.data.url,
          file_name: file.name || uploadRes.data.name,
        });
      }
    } catch (e) {
      Alert.alert('Erreur', errMsg(e));
    } finally {
      setUploading(false);
    }
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F4F6F9' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList inverted data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => (
          <Bubble m={item} mine={item.sender_id === user.id} isGroup={isGroup} read={isRead(item)}
            onPay={(m) => { setPinErr(''); setPayFor(m); }} onDecline={decline} />)} />
      
      {showAttach && (
        <View style={{ flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity onPress={() => handleUpload('image')} style={{ alignItems: 'center', marginRight: 30 }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8EFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
              <Ionicons name="image" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 12 }}>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => handleUpload('file')} style={{ alignItems: 'center' }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8EFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
              <Ionicons name="document" size={24} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 12 }}>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', padding: 10, alignItems: 'flex-end', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border }}>
        <TouchableOpacity onPress={() => setShowAttach(!showAttach)} style={{ marginRight: 10, marginBottom: 10 }}>
          <Ionicons name={showAttach ? "close-circle" : "add-circle"} size={32} color={colors.primary} />
        </TouchableOpacity>

        <TextInput value={text} onChangeText={setText} placeholder={uploading ? "Envoi en cours..." : "Message"} placeholderTextColor={colors.muted} multiline editable={!uploading}
          style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, maxHeight: 120, fontSize: 16 }} />
        
        <TouchableOpacity onPress={send} disabled={!text.trim() || uploading} style={{ marginLeft: 10, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: (text.trim() && !uploading) ? 1 : 0.5 }}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <MoneyModal visible={!!money} mode={money} onClose={() => setMoney(null)} conversationId={id} peerUsername={peerUsername} peerName={peerName} />
      <PinModal visible={!!payFor} loading={busy} error={pinErr} onCancel={() => setPayFor(null)} onSubmit={pay}
        title={`Payer ${payFor ? fcfa(payFor.meta.amount) : ''}`} />
    </KeyboardAvoidingView>
  );
}
