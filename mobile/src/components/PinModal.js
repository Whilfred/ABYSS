import React, { useEffect, useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { Button } from './UI';
import { colors } from '../theme';

export default function PinModal({ visible, title = 'Entrez votre code PIN', onCancel, onSubmit, loading, error }) {
  const [pin, setPin] = useState('');
  useEffect(() => { if (visible) setPin(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,27,63,0.5)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{title}</Text>
          <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad"
            secureTextEntry maxLength={4} autoFocus textAlign="center"
            style={{ fontSize: 32, letterSpacing: 16, marginVertical: 18, backgroundColor: colors.surface, borderRadius: 12, padding: 12 }} />
          {error ? <Text style={{ color: colors.danger, textAlign: 'center', marginBottom: 10 }}>{error}</Text> : null}
          <Button title="Confirmer" onPress={() => onSubmit(pin)} loading={loading} disabled={pin.length !== 4} />
          <Button title="Annuler" variant="ghost" onPress={onCancel} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
  );
}
