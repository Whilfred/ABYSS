import React, { useEffect, useState } from 'react';
import { Modal, Text, View, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from './UI';
import PinModal from './PinModal';
import { api, errMsg, fcfa } from '../api';
import { useTheme } from '../ThemeContext';

export default function MoneyModal({ visible, mode, onClose, conversationId, peerUsername, peerName }) {
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { 
    if (visible) { setAmount(''); setNote(''); setError(''); setPinOpen(false); } 
  }, [visible]);

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
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,27,63,0.5)' }}>
          
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }}>
              
              {/* En-tête du modal */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <View style={{ flex: 1 }}>
                  {/* Titre générique */}
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                    {mode === 'send' ? 'Envoyer de l\'argent' : 'Demander de l\'argent'}
                  </Text>
                  {/* Sous-titre avec le nom de la personne */}
                  <Text style={{ color: colors.muted, marginTop: 4 }}>
                    {mode === 'send' ? `À ${peerName}` : `À ${peerName}`} (@{peerUsername})
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: 10 }}>
                  <Ionicons name="close" size={26} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 16 }}>
                <Input label="Montant (FCFA)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="5000" />
                <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Pour le déjeuner…" maxLength={100} />
                
                {error && !pinOpen ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text> : null}
                
                <Button 
                  title={mode === 'send' ? `Continuer${amt ? ' · ' + fcfa(amt) : ''}` : 'Envoyer la demande'}
                  disabled={amt < 100} 
                  loading={loading && mode === 'request'}
                  onPress={() => (mode === 'send' ? setPinOpen(true) : submit())} 
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <PinModal visible={pinOpen} loading={loading} error={error} onCancel={() => setPinOpen(false)} onSubmit={submit}
        title={`Confirmer l'envoi de ${fcfa(amt)}`} />
    </Modal>
  );
}
