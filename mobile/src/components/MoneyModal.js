import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, ScrollView, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from './UI';
import PinModal from './PinModal';
import { api, errMsg, fcfa } from '../api';
import { useTheme } from '../ThemeContext';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];

// Hauteur du clavier : fiable sur Android et iOS, même dans un Modal
function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setH(e.endCoordinates?.height || 0)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setH(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);
  return h;
}

export default function MoneyModal({ visible, mode, onClose, conversationId, peerUsername, peerName }) {
  const { colors } = useTheme();
  const kb = useKeyboardHeight();
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

  const onBackdrop = () => {
    if (kb > 0) Keyboard.dismiss();
    else onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* paddingBottom = hauteur du clavier : la carte monte au-dessus du clavier */}
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,27,63,0.5)', paddingBottom: kb }}>
        <TouchableWithoutFeedback onPress={onBackdrop}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>

        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '100%' }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 20 }}
          >
            {/* Petite poignée */}
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.muted, opacity: 0.35, marginBottom: 12 }} />

            {/* En-tête du modal */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                  {mode === 'send' ? "Envoyer de l'argent" : "Demander de l'argent"}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  À {peerName} (@{peerUsername})
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: 10 }}>
                <Ionicons name="close" size={26} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              <Input label="Montant (FCFA)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="5000" />

              {/* Montants rapides */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                {QUICK_AMOUNTS.map((v) => {
                  const active = amt === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setAmount(String(v))}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, marginBottom: 6,
                        backgroundColor: active ? colors.primary : 'transparent',
                        borderWidth: 1, borderColor: active ? colors.primary : colors.muted + '55',
                      }}
                    >
                      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{fcfa(v)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Pour le déjeuner…" maxLength={100} />

              {error && !pinOpen ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text> : null}

              <Button
                title={mode === 'send' ? `Continuer${amt ? ' · ' + fcfa(amt) : ''}` : 'Envoyer la demande'}
                disabled={amt < 100}
                loading={loading && mode === 'request'}
                onPress={() => (mode === 'send' ? setPinOpen(true) : submit())}
              />
            </View>
          </ScrollView>
        </View>
      </View>

      <PinModal visible={pinOpen} loading={loading} error={error} onCancel={() => setPinOpen(false)} onSubmit={submit}
        title={`Confirmer l'envoi de ${fcfa(amt)}`} />
    </Modal>
  );
}
