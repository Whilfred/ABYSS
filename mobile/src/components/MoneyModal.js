import React, { useEffect, useState } from 'react';
import { Modal, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input } from './UI';
import PinModal from './PinModal';
import { api, errMsg, fcfa } from '../api';
import { colors } from '../theme';

// mode: 'send' | 'request'
export default function MoneyModal({ visible, mode, onClose, conversationId, peerUsername, peerName }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (visible) { setAmount(''); setNote(''); setError(''); setPinOpen(false); } }, [visible]);

  const amt = parseInt(amount || '0', 10);
  const submit = async (pin) => {
    setLoading(true); setError('');
    try {
      if (mode === 'send') await api.post('/wallet/transfer', { to_username: peerUsername, amount: amt, pin, note, conversationId });
      else await api.post('/wallet/requests', { conversationId, amount: amt, note });
      setPinOpen(false); onClose();
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,27,63,0.5)' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
            {mode === 'send' ? `Envoyer à ${peerName}` : `Demander à ${peerName}`}
          </Text>
          <Text style={{ color: colors.muted, marginBottom: 16 }}>@{peerUsername}</Text>
          <Input label="Montant (FCFA)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="5000" />
          <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Pour le déjeuner…" maxLength={100} />
          {error && !pinOpen ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text> : null}
          <Button title={mode === 'send' ? `Continuer${amt ? ' · ' + fcfa(amt) : ''}` : 'Envoyer la demande'}
            disabled={amt < 100} loading={loading && mode === 'request'}
            onPress={() => (mode === 'send' ? setPinOpen(true) : submit())} />
          <Button title="Fermer" variant="ghost" onPress={onClose} style={{ marginTop: 8 }} />
        </View>
      </KeyboardAvoidingView>
      <PinModal visible={pinOpen} loading={loading} error={error} onCancel={() => setPinOpen(false)} onSubmit={submit}
        title={`Confirmer l'envoi de ${fcfa(amt)}`} />
    </Modal>
  );
}
