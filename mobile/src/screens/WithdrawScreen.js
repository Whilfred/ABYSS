import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Chip, Input } from '../components/UI';
import PinModal from '../components/PinModal';
import { api, errMsg, fcfa } from '../api';
import { useAuth } from '../auth';
import { COUNTRIES, byCode } from '../countries';
import { colors } from '../theme';

export default function WithdrawScreen({ navigation }) {
  const { user } = useAuth();
  const [country, setCountry] = useState(user.country);
  const c = byCode(country);
  const [provider, setProvider] = useState(c.providers[0]);
  const [local, setLocal] = useState('');
  const [amount, setAmount] = useState('');
  const [feeRate, setFeeRate] = useState(0.01);
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/wallet/countries').then((r) => setFeeRate(r.data.withdraw_fee_rate)).catch(() => {}); }, []);
  useEffect(() => { setProvider(byCode(country).providers[0]); }, [country]);

  const amt = parseInt(amount || '0', 10);
  const fee = Math.ceil(amt * feeRate);
  const phone = c.dial + local.replace(/\D/g, '');

  const submit = async (pin) => {
    setLoading(true); setErr('');
    try {
      await api.post('/wallet/withdraw', { country, provider, phone, amount: amt, pin });
      setPinOpen(false);
      Alert.alert('Retrait envoyé', `${fcfa(amt)} envoyés vers ${provider} (${phone}).`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { setErr(errMsg(e)); } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }} style={{ backgroundColor: '#fff' }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.muted, fontWeight: '600', marginBottom: 8 }}>Pays de retrait</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {COUNTRIES.map((x) => <Chip key={x.code} label={`${x.flag} ${x.name}`} active={country === x.code} onPress={() => setCountry(x.code)} />)}
      </View>
      <Text style={{ color: colors.muted, fontWeight: '600', marginVertical: 8 }}>Opérateur</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {c.providers.map((p) => <Chip key={p} label={p} active={provider === p} onPress={() => setProvider(p)} />)}
      </View>
      <Input label={`Numéro bénéficiaire (${c.dial})`} value={local} onChangeText={setLocal} keyboardType="phone-pad" placeholder="70 00 00 00" />
      <Input label="Montant (FCFA)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="10000" />
      {amt >= 500 ? (
        <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 14 }}>
          <Text style={{ color: colors.text }}>Frais : {fcfa(fee)}</Text>
          <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>Total débité : {fcfa(amt + fee)}</Text>
        </View>) : null}
      <Button title="Continuer" onPress={() => { setErr(''); setPinOpen(true); }} disabled={amt < 500 || local.replace(/\D/g, '').length < 8} />
      <PinModal visible={pinOpen} loading={loading} error={err} onCancel={() => setPinOpen(false)} onSubmit={submit} title={`Confirmer le retrait de ${fcfa(amt)}`} />
    </ScrollView>
  );
}
