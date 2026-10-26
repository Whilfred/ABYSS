import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Input } from '../components/UI';
import { api, errMsg, fcfa } from '../api';
import { useAuth } from '../auth';
import { byCode } from '../countries';
import { colors } from '../theme';

export default function DepositScreen({ navigation }) {
  const { user } = useAuth();
  const c = byCode(user.country);
  const [provider, setProvider] = useState(c.providers[0]);
  const [phone, setPhone] = useState(user.phone);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const amt = parseInt(amount || '0', 10);
  const go = async () => {
    setLoading(true);
    try {
      await api.post('/wallet/deposit', { country: c.code, provider, phone, amount: amt });
      Alert.alert('Dépôt effectué', `${fcfa(amt)} ajoutés à votre portefeuille.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('Dépôt', errMsg(e)); } finally { setLoading(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ backgroundColor: '#fff' }}>
      <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 8 }}>Opérateur ({c.flag} {c.name})</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        {c.providers.map((p) => <Chip key={p} label={p} active={provider === p} onPress={() => setProvider(p)} />)}
      </View>
      <Input label="Numéro Mobile Money" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Input label="Montant (FCFA)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="10000" />
      <Button title={`Déposer ${amt ? fcfa(amt) : ''}`} onPress={go} loading={loading} disabled={amt < 500} />
      <Text style={{ color: colors.muted, marginTop: 14, fontSize: 12 }}>Minimum 500 FCFA. Mode sandbox : le dépôt est simulé tant qu'un partenaire de paiement n'est pas branché.</Text>
    </ScrollView>
  );
}
