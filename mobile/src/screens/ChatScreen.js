import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, useWindowDimensions, View, Image } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, errMsg, fcfa } from '../api';
import { SERVER_URL } from '../config';
import { useAuth } from '../auth';
import { useTheme } from '../ThemeContext';
import MoneyModal from '../components/MoneyModal';
import PinModal from '../components/PinModal';
import { saveMessagesToLocal, getLocalMessages } from '../db';

/* ------------------------------------------------------------------ */
/*  Palette façon Telegram (modifiez ici pour ajuster les couleurs)    */
/* ------------------------------------------------------------------ */
const TG = {
  light: {
    chatBg: '#D5E1C8',
    incoming: '#FFFFFF',
    outgoing: '#EFFDDE',
    text: '#000000',
    meta: '#A0ACB6',
    metaOut: '#5DC452',
    check: '#4FAE4E',
    bar: '#FFFFFF',
    input: '#FFFFFF',
    pill: 'rgba(60,80,50,0.38)',
    divider: 'rgba(0,0,0,0.08)',
    link: '#3390EC',
  },
  dark: {
    chatBg: '#0E1621',
    incoming: '#182533',
    outgoing: '#2B5278',
    text: '#FFFFFF',
    meta: '#6D7F8F',
    metaOut: '#7DA8D3',
    check: '#6AB3F3',
    bar: '#17212B',
    input: '#17212B',
    pill: 'rgba(24,37,51,0.75)',
    divider: 'rgba(255,255,255,0.1)',
    link: '#6AB3F3',
  },
};

const NAME_COLORS = ['#E17076', '#7BC862', '#E5CA77', '#65AADD', '#A695E7', '#EE7AAE', '#6EC9CB', '#FAA774'];
const nameColor = (s = '') => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};

const isDarkHex = (hex) => {
  if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

const hhmm = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayLabel = (d) => {
  const date = new Date(d);
  const now = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yest.toDateString()) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};
const sameGroup = (a, b) => !!a && !!b && a.sender_id === b.sender_id && sameDay(a.created_at, b.created_at);

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/* ------------------------------------------------------------------ */

const fullDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + hhmm(d);

/* ------------------------------------------------------------------ */
/*  Visionneuse photo plein écran                                      */
/* ------------------------------------------------------------------ */
function ImageViewer({ image, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => { if (image) setZoomed(false); }, [image]);
  if (!image) return null;

  const W = zoomed ? width * 2.5 : width;
  const H = zoomed ? height * 2.5 : height;

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) setZoomed((z) => !z);
    lastTap.current = now;
  };

  const share = async () => {
    setBusy(true);
    try {
      const ext = (image.uri.split('?')[0].split('.').pop() || 'jpg').slice(0, 4);
      const dest = FileSystem.cacheDirectory + 'photo_' + Date.now() + '.' + ext;
      const { uri } = await FileSystem.downloadAsync(image.uri, dest);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert('Téléchargé', uri);
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'enregistrer la photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          scrollEnabled={zoomed}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentOffset={zoomed ? { x: (W - width) / 2, y: 0 } : undefined}
        >
          <ScrollView
            nestedScrollEnabled
            scrollEnabled={zoomed}
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentOffset={zoomed ? { x: 0, y: (H - height) / 2 } : undefined}
          >
            <TouchableWithoutFeedback onPress={onTap}>
              <Image source={{ uri: image.uri }} style={{ width: W, height: H }} resizeMode="contain" />
            </TouchableWithoutFeedback>
          </ScrollView>
        </ScrollView>

        {/* Barre du haut */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 6 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            {image.sender ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{image.sender}</Text> : null}
            {image.date ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{fullDate(image.date)}</Text> : null}
          </View>
          <TouchableOpacity onPress={share} disabled={busy} style={{ padding: 6 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={26} color="#fff" />}
          </TouchableOpacity>
        </View>

        {!zoomed ? (
          <View style={{ position: 'absolute', bottom: insets.bottom + 16, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Appuyez deux fois pour zoomer</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DaySeparator({ date, t }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <View style={{ backgroundColor: t.pill, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{dayLabel(date)}</Text>
      </View>
    </View>
  );
}

function Meta({ m, mine, read, t, onImage }) {
  const color = onImage ? '#fff' : mine ? t.metaOut : t.meta;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color, fontSize: 11 }}>{hhmm(m.created_at)}</Text>
      {mine ? (
        <Ionicons
          name={read ? 'checkmark-done' : 'checkmark'}
          size={15}
          color={onImage ? '#fff' : t.check}
          style={{ marginLeft: 2 }}
        />
      ) : null}
    </View>
  );
}

function Bubble({ m, mine, isGroup, read, first, last, onPay, onDecline, onOpenImage, onLongPress, reaction, colors, t, peerName }) {
  const bubbleRef = useRef(null);

  const isMoney = m.type === 'money';
  const isReq = m.type === 'money_request';
  const isImage = m.type === 'image';
  const isFile = m.type === 'file';

  // Appui long : on mesure la bulle à l'écran puis on ouvre le menu
  const triggerMenu = () => {
    if (!onLongPress || !bubbleRef.current) return;
    bubbleRef.current.measureInWindow((x, y, w, h) => {
      onLongPress({ m, mine, first, last, x, y, w, h });
    });
  };

  const bg = mine ? t.outgoing : t.incoming;
  const fg = t.text;
  const sub = mine ? t.metaOut : t.meta;

  // Forme de la bulle : coin "queue" sur le dernier message d'un groupe
  const R = 17, small = 5, tail = 4;
  const sideTop = first ? R : small;
  const sideBottom = last ? tail : small;
  const radius = mine
    ? { borderTopLeftRadius: R, borderBottomLeftRadius: R, borderTopRightRadius: sideTop, borderBottomRightRadius: sideBottom }
    : { borderTopRightRadius: R, borderBottomRightRadius: R, borderTopLeftRadius: sideTop, borderBottomLeftRadius: sideBottom };

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

  const accent = isMoney ? (mine ? colors.primary : '#2E9E3E') : '#F59E0B';

  // Transfert d'argent : reçu façon ticket (texte différent pour l'expéditeur et le destinataire)
  if (isMoney) {
    const amount = fcfa(m.meta?.amount);
    const who = mine ? (peerName || 'le destinataire') : (m.sender_name || peerName || 'un contact');
    const isDarkT = t.text === '#FFFFFF';
    const col = mine ? '#3390EC' : '#2E9E3E';
    const colText = mine ? (isDarkT ? '#6AB3F3' : '#1F6FBF') : (isDarkT ? '#5FD06F' : '#1E7A2E');

    const Row = ({ label, value, selectable }) => (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
        <Text style={{ color: t.meta, fontSize: 12 }}>{label}</Text>
        <Text selectable={selectable} numberOfLines={1} style={{ color: fg, fontSize: 12, fontWeight: '700', marginLeft: 12, flexShrink: 1 }}>{value}</Text>
      </View>
    );

    return (
      <View
        style={{
          alignSelf: 'center',
          width: '80%',
          maxWidth: 310,
          marginVertical: 6,
          backgroundColor: t.incoming,
          borderRadius: 18,
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 3, elevation: 2,
        }}
      >
        {/* En-tête : icône, titre, montant, phrase */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={mine ? 'arrow-up' : 'arrow-down'} size={16} color="#fff" />
          </View>
          <Text style={{ color: colText, fontWeight: '800', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 }}>
            {mine ? 'Argent envoyé' : 'Argent reçu'}
          </Text>
          <Text style={{ color: fg, fontWeight: '800', fontSize: 24, lineHeight: 28, marginTop: 1 }}>{amount}</Text>
          <Text style={{ color: t.meta, fontSize: 12, marginTop: 1, textAlign: 'center' }}>
            {mine ? "Vous avez envoyé de l'argent" : 'Votre compte a été crédité'}
          </Text>
        </View>

        {/* Ligne pointillée avec encoches sur les côtés */}
        <View style={{ height: 14, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: -7, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: t.chatBg }} />
          <View style={{ position: 'absolute', right: -7, top: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: t.chatBg }} />
          <View style={{ marginHorizontal: 12, height: 1, overflow: 'hidden' }}>
            <View style={{ height: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: t.divider, borderRadius: 1 }} />
          </View>
        </View>

        {/* Détails */}
        <View style={{ paddingHorizontal: 18, paddingTop: 0, paddingBottom: 8 }}>
          <Row label={mine ? 'Destinataire' : 'Expéditeur'} value={who} />
          {m.body ? <Row label="Motif" value={m.body} /> : null}
          {m.meta?.reference ? <Row label="Référence" value={m.meta.reference} selectable /> : null}
          <Row label="Heure" value={hhmm(m.created_at)} />
        </View>
      </View>
    );
  }

  // Demande d'argent : carte centrée façon notification, des deux côtés
  if (isReq) {
    const amount = fcfa(m.meta?.amount);
    const who = mine ? (peerName || 'le destinataire') : (m.sender_name || peerName || 'un contact');
    const title = isMoney ? (mine ? 'Argent envoyé' : 'Argent reçu') : "Demande d'argent";
    const icon = isMoney ? (mine ? 'arrow-up' : 'arrow-down') : 'hand-left';
    const amountText = <Text style={{ color: accent, fontWeight: '800', fontSize: 19 }}>{amount}</Text>;
    const sentence = isMoney
      ? (mine
        ? <>Vous avez envoyé {amountText} à <Text style={{ fontWeight: '700' }}>{who}</Text></>
        : <>Votre compte a été crédité de {amountText} par <Text style={{ fontWeight: '700' }}>{who}</Text></>)
      : (mine
        ? <>Vous avez demandé {amountText} à <Text style={{ fontWeight: '700' }}>{who}</Text></>
        : <><Text style={{ fontWeight: '700' }}>{who}</Text> vous demande {amountText}</>);

    return (
      <View
        style={{
          alignSelf: 'center',
          width: '80%',
          maxWidth: 320,
          marginVertical: 6,
          backgroundColor: t.incoming,
          borderRadius: 20,
          overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
        }}
      >
        <View style={{ height: 5, backgroundColor: accent }} />
        <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color="#fff" />
          </View>
          <Text style={{ color: accent, fontWeight: '700', fontSize: 13, marginTop: 8 }}>{title}</Text>

          <Text style={{ color: fg, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 }}>{sentence}</Text>

          {m.body ? (
            <Text style={{ color: t.meta, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>« {m.body} »</Text>
          ) : null}

          {isReq && m.meta?.status !== 'pending' ? (
            <View style={{ marginTop: 10, backgroundColor: m.meta?.status === 'paid' ? 'rgba(76,175,80,0.18)' : 'rgba(229,57,53,0.16)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
              <Text style={{ color: m.meta?.status === 'paid' ? '#2E9E3E' : '#D32F2F', fontWeight: '700', fontSize: 12 }}>
                {m.meta?.status === 'paid' ? '✓ Payée' : '✕ Refusée'}
              </Text>
            </View>
          ) : null}

          {isReq && m.meta?.status === 'pending' && mine ? (
            <Text style={{ color: t.meta, fontStyle: 'italic', fontSize: 13, marginTop: 8 }}>En attente de paiement…</Text>
          ) : null}

          {isMoney && m.meta?.reference ? (
            <Text selectable style={{ color: t.meta, fontSize: 11, marginTop: 10 }}>Réf. {m.meta.reference}</Text>
          ) : null}

          <View style={{ marginTop: 6 }}>
            <Meta m={m} mine={mine} read={read} t={t} />
          </View>
        </View>

        {isReq && m.meta?.status === 'pending' && !mine ? (
          <View style={{ borderTopWidth: 1, borderTopColor: t.divider, flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => onPay(m)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: t.divider }}>
              <Text style={{ color: t.link, fontWeight: '700', fontSize: 15 }}>Payer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDecline(m)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}>
              <Text style={{ color: '#E53935', fontWeight: '700', fontSize: 15 }}>Refuser</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  const showAvatar = isGroup && !mine;
  const showName = isGroup && !mine && first;
  const imageNoCaption = isImage && !m.body;

  return (
    <View style={{ flexDirection: 'row', alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '84%', marginVertical: 1, marginHorizontal: 8 }}>
      {showAvatar ? (
        last ? (
          <Image
            source={{ uri: m.sender_avatar ? SERVER_URL + m.sender_avatar : 'https://ui-avatars.com/api/?background=random&color=fff&name=' + encodeURIComponent(m.sender_name || '?') }}
            style={{ width: 34, height: 34, borderRadius: 17, marginRight: 6, alignSelf: 'flex-end' }}
          />
        ) : (
          <View style={{ width: 40 }} />
        )
      ) : null}

      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
        <Pressable ref={bubbleRef} collapsable={false} onLongPress={triggerMenu} delayLongPress={280}>
          <View
            style={{
              backgroundColor: bg,
              ...radius,
              paddingHorizontal: isImage ? 3 : 10,
              paddingTop: isImage ? 3 : 6,
              paddingBottom: isImage ? 3 : 6,
              overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 1, elevation: 1,
            }}
          >
            {showName ? (
              <Text style={{ color: nameColor(m.sender_name), fontWeight: '700', fontSize: 14, marginBottom: 2, marginHorizontal: isImage ? 7 : 0, marginTop: isImage ? 3 : 0 }}>
                {m.sender_name}
              </Text>
            ) : null}

            {isImage ? (
              <View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={triggerMenu}
                  delayLongPress={280}
                  onPress={() => onOpenImage && onOpenImage({ uri: SERVER_URL + m.file_url, sender: mine ? 'Vous' : m.sender_name, date: m.created_at })}
                >
                  <Image source={{ uri: SERVER_URL + m.file_url }} style={{ width: 240, height: 240, borderRadius: 14 }} resizeMode="cover" />
                </TouchableOpacity>
                {imageNoCaption ? (
                  <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Meta m={m} mine={mine} read={read} t={t} onImage />
                  </View>
                ) : (
                  <>
                    <Text style={{ color: fg, fontSize: 16, marginTop: 6, marginHorizontal: 7 }}>{m.body}</Text>
                    <View style={{ alignSelf: 'flex-end', marginRight: 7, marginTop: 2, marginBottom: 2 }}>
                      <Meta m={m} mine={mine} read={read} t={t} />
                    </View>
                  </>
                )}
              </View>
            ) : isFile ? (
              <View style={{ minWidth: 230 }}>
                <TouchableOpacity onPress={downloadFile} onLongPress={triggerMenu} delayLongPress={280} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="document-text" size={24} color="#fff" />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{m.file_name}</Text>
                    <Text style={{ color: sub, fontSize: 13, marginTop: 2 }}>Appuyez pour ouvrir</Text>
                  </View>
                </TouchableOpacity>
                <View style={{ alignSelf: 'flex-end', marginTop: 2 }}>
                  <Meta m={m} mine={mine} read={read} t={t} />
                </View>
              </View>
            ) : (
              // Texte + heure : l'heure reste à droite sur la même ligne si ça rentre,
              // sinon elle passe automatiquement sous le texte (jamais de chevauchement)
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                <Text style={{ color: fg, fontSize: 16, lineHeight: 22, flexShrink: 1 }}>{m.body}</Text>
                <View style={{ marginLeft: 10, marginTop: 2, alignSelf: 'flex-end' }}>
                  <Meta m={m} mine={mine} read={read} t={t} />
                </View>
              </View>
            )}
          </View>
        </Pressable>

        {reaction ? (
          <View style={{ marginTop: -6, marginHorizontal: 8, backgroundColor: t.bar, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: t.divider }}>
            <Text style={{ fontSize: 14 }}>{reaction}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Menu d'appui long façon iOS / WhatsApp                             */
/*  Fond flouté + message mis en avant + réactions + actions           */
/* ------------------------------------------------------------------ */
function MessageMenu({ data, onClose, onReact, currentReaction, actions, bubbleProps, dark, t }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (data) {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
    }
  }, [data]);

  if (!data) return null;

  const { m, mine, first, last, y, h } = data;
  const BAR_H = 52;
  const ROW_H = 50;
  const menuH = actions.length * ROW_H;
  const topMin = insets.top + BAR_H + 16;
  const bottomMax = height - insets.bottom - 12;

  // Position verticale du message mis en avant (décalé si trop près des bords)
  let top = y;
  if (top + h + 8 + menuH > bottomMax) top = bottomMax - menuH - 8 - h;
  if (top < topMin) top = topMin;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const bubbleScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const side = mine ? { right: 12 } : { left: 12 };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.6)' }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Barre de réactions */}
      <Animated.View
        style={[
          {
            position: 'absolute', top: top - BAR_H - 8, height: BAR_H, flexDirection: 'row', alignItems: 'center',
            backgroundColor: t.bar, borderRadius: BAR_H / 2, paddingHorizontal: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
            opacity: anim, transform: [{ scale }],
          },
          side,
        ]}
      >
        {QUICK_REACTIONS.map((e) => (
          <TouchableOpacity
            key={e}
            onPress={() => { onReact(m, e); onClose(); }}
            style={{
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1,
              backgroundColor: currentReaction === e ? 'rgba(120,120,120,0.25)' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 26 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Message mis en avant (copie posée exactement au même endroit) */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: top - 1, transform: [{ scale: bubbleScale }] }}
      >
        <Bubble
          {...bubbleProps}
          m={m}
          mine={mine}
          first={first}
          last={last}
          reaction={null}
          onLongPress={null}
          onOpenImage={null}
          onPay={() => {}}
          onDecline={() => {}}
        />
      </Animated.View>

      {/* Actions */}
      <Animated.View
        style={[
          {
            position: 'absolute', top: top + h + 8, width: 240,
            backgroundColor: t.bar, borderRadius: 16, overflow: 'hidden',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
            opacity: anim, transform: [{ scale }],
          },
          side,
        ]}
      >
        {actions.map((a, i) => (
          <TouchableOpacity
            key={a.label}
            activeOpacity={0.6}
            onPress={() => { onClose(); setTimeout(a.onPress, 150); }}
            style={{
              height: ROW_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: t.divider,
            }}
          >
            <Text style={{ fontSize: 17, color: a.destructive ? '#E53935' : t.text }}>{a.label}</Text>
            <Ionicons name={a.icon} size={21} color={a.destructive ? '#E53935' : t.text} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { id, title, type, peerUsername, peerName } = route.params;
  const { user, socket } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const dark = isDarkHex(colors.bg);
  const t = dark ? TG.dark : TG.light;

  const [msgs, setMsgs] = useState([]);
  const [reads, setReads] = useState({});
  const [text, setText] = useState('');
  const [money, setMoney] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [pinErr, setPinErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [menu, setMenu] = useState(null);
  const [reactions, setReactions] = useState({});
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [peerAvatar, setPeerAvatar] = useState(null);
  const [groupAvatar, setGroupAvatar] = useState(null);
  const isGroup = type === 'group';

  // Suivi du clavier : on retire la marge "barre de navigation" quand il est ouvert
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKbOpen(true);
      setShowAttach(false);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!isGroup && peerUsername) {
      api.get(`/users/${peerUsername}`).then(r => {
        setLastSeen(r.data.last_seen);
        setIsOnline(r.data.last_seen === null);
        setPeerAvatar(r.data.avatar_url);
      }).catch(() => {});
    }
  }, [peerUsername, isGroup]);

  useEffect(() => {
    if (isGroup) {
      api.get(`/conversations/${id}/info`).then(r => {
        setGroupAvatar(r.data.avatar_url);
      }).catch(() => {});
    }
  }, [id, isGroup]);

  useEffect(() => {
    if (!socket || isGroup) return;
    const onPresence = (data) => {
      if (data.user_id && (data.user_id === peerUsername || data.user_id === peerName)) {
        setIsOnline(data.online);
        setLastSeen(data.last_seen);
      }
    };
    socket.on('user:presence', onPresence);
    return () => socket.off('user:presence', onPresence);
  }, [socket, isGroup, peerUsername, peerName]);

  useEffect(() => {
    const formatLastSeen = (date) => {
      if (!date) return 'vu récemment';
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return "vu à l'instant";
      if (diff < 3600000) return `vu il y a ${Math.floor(diff / 60000)} min`;
      if (d.toDateString() === now.toDateString()) return `vu à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      return `vu le ${d.toLocaleDateString('fr-FR')}`;
    };

    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => {
            if (isGroup) {
              navigation.navigate('GroupInfo', { id, title });
            } else {
              navigation.navigate('ChatInfo', { id, title, type, peerUsername, peerName });
            }
          }}
        >
          {isGroup ? (
            groupAvatar ? (
              <Image source={{ uri: SERVER_URL + groupAvatar }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
            ) : (
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="people" size={22} color="#fff" />
              </View>
            )
          ) : (
            <Image
              source={{ uri: peerAvatar ? SERVER_URL + peerAvatar : 'https://ui-avatars.com/api/?background=random&color=fff&name=' + encodeURIComponent(title || '?') }}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
            />
          )}

          <View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }} numberOfLines={1}>{title}</Text>
            <Text style={{ fontSize: 13, color: !isGroup && isOnline ? t.link : colors.muted }}>
              {isGroup ? 'Appuyez pour les infos' : (isOnline ? 'en ligne' : formatLastSeen(lastSeen))}
            </Text>
          </View>
        </TouchableOpacity>
      ),
      headerRight: !isGroup ? () => (
        <TouchableOpacity onPress={() => setMoney('send')} style={{ marginRight: 16 }}>
          <Ionicons name="cash-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [navigation, title, isGroup, id, peerUsername, peerName, colors, isOnline, lastSeen, peerAvatar, groupAvatar, t.link]);

  const load = useCallback(async () => {
    const localMsgs = getLocalMessages(id);
    if (localMsgs.length > 0) {
      setMsgs(localMsgs);
    }

    try {
      const { data } = await api.get(`/conversations/${id}/messages`);
      setMsgs(data.messages);
      setReads(Object.fromEntries(data.reads.map((r) => [r.user_id, r.last_read_at])));
      saveMessagesToLocal(data.messages);
    } catch (e) {
      console.log('Mode hors-ligne : impossible de contacter le serveur');
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (m) => {
      if (m.conversation_id !== id) return;
      setMsgs((p) => (p.some((x) => x.id === m.id) ? p : [m, ...p]));
      saveMessagesToLocal([m]);
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
    try {
      const { data } = await api.post(`/conversations/${id}/messages`, { body, type: 'text' });
      saveMessagesToLocal([data]);
    }
    catch (e) {
      setText(body);
      Alert.alert('Erreur', "Impossible d'envoyer le message. Vérifiez votre connexion.");
    }
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

        const { data } = await api.post(`/conversations/${id}/messages`, {
          type: type === 'image' ? 'image' : 'file',
          file_url: uploadRes.data.url,
          file_name: file.name || uploadRes.data.name,
        });
        saveMessagesToLocal([data]);
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'envoyer le fichier. Vérifiez votre connexion.");
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

  /* ---------------- Menu d'appui long : actions ---------------- */
  const toggleReaction = (m, emoji) => {
    setReactions((p) => {
      const next = { ...p };
      if (next[m.id] === emoji) delete next[m.id];
      else next[m.id] = emoji;
      return next;
    });
  };

  const deleteMessage = (m) => {
    Alert.alert('Supprimer le message ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/conversations/${id}/messages/${m.id}`);
            setMsgs((p) => p.filter((x) => x.id !== m.id));
          } catch (e) {
            Alert.alert('Erreur', errMsg(e));
          }
        },
      },
    ]);
  };

  const buildActions = (d) => {
    const m = d.m;
    const list = [];

    list.push({
      label: 'Partager', icon: 'share-outline',
      onPress: () => {
        const content = m.body || (m.file_url ? SERVER_URL + m.file_url : '');
        if (content) Share.share({ message: content }).catch(() => {});
      },
    });

    list.push({
      label: 'Infos', icon: 'information-circle-outline',
      onPress: () => Alert.alert(
        'Infos du message',
        'Envoyé le ' + fullDate(m.created_at) + (d.mine ? '\n' + (isRead(m) ? 'Lu' : 'Envoyé') : '')
      ),
    });

    if (d.mine) {
      list.push({ label: 'Supprimer', icon: 'trash-outline', destructive: true, onPress: () => deleteMessage(m) });
    }
    return list;
  };

  const hasText = !!text.trim();

  const renderItem = ({ item, index }) => {
    // La liste est inversée : index+1 = message plus ancien, index-1 = plus récent
    const older = msgs[index + 1];
    const newer = msgs[index - 1];
    const first = !sameGroup(older, item);
    const last = !sameGroup(item, newer);
    const showDay = !older || !sameDay(older.created_at, item.created_at);

    return (
      <View style={{ marginTop: first && !showDay ? 7 : 0 }}>
        {showDay ? <DaySeparator date={item.created_at} t={t} /> : null}
        <Bubble
          m={item}
          mine={item.sender_id === user.id}
          isGroup={isGroup}
          read={isRead(item)}
          first={first}
          last={last}
          colors={colors}
          t={t}
          peerName={peerName}
          reaction={reactions[item.id]}
          onLongPress={setMenu}
          onOpenImage={setViewer}
          onPay={(m) => { setPinErr(''); setPayFor(m); }}
          onDecline={decline}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.chatBg }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        inverted
        data={msgs}
        keyExtractor={(m) => m.id}
        extraData={reactions}
        contentContainerStyle={{ paddingVertical: 8 }}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
      />

      {showAttach && (
        <View style={{ flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 24, backgroundColor: t.bar, borderTopWidth: 1, borderTopColor: t.divider }}>
          <TouchableOpacity onPress={() => handleUpload('image')} style={{ alignItems: 'center', marginRight: 32 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#A05BD9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Ionicons name="image" size={26} color="#fff" />
            </View>
            <Text style={{ color: colors.text, fontSize: 13 }}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleUpload('file')} style={{ alignItems: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#3E9BEF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Ionicons name="document" size={26} color="#fff" />
            </View>
            <Text style={{ color: colors.text, fontSize: 13 }}>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barre de saisie façon Telegram */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 8),
          backgroundColor: showAttach ? t.bar : 'transparent',
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: t.input,
            borderRadius: 22,
            minHeight: 44,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={uploading ? 'Envoi en cours…' : 'Message'}
            placeholderTextColor={t.meta}
            multiline
            editable={!uploading}
            style={{
              flex: 1,
              paddingLeft: 16,
              paddingRight: 4,
              paddingTop: Platform.OS === 'ios' ? 12 : 10,
              paddingBottom: Platform.OS === 'ios' ? 12 : 10,
              maxHeight: 120,
              fontSize: 16,
              color: t.text,
            }}
          />
          <TouchableOpacity
            onPress={() => setShowAttach(!showAttach)}
            style={{ height: 44, width: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={showAttach ? 'close' : 'attach'} size={showAttach ? 26 : 28} color={t.meta} style={showAttach ? null : { transform: [{ rotate: '45deg' }] }} />
          </TouchableOpacity>
        </View>

        {hasText ? (
          <TouchableOpacity
            onPress={send}
            disabled={uploading}
            style={{
              marginLeft: 8,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: uploading ? 0.5 : 1,
              shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
            }}
          >
            <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      <MessageMenu
        data={menu}
        onClose={() => setMenu(null)}
        onReact={toggleReaction}
        currentReaction={menu ? reactions[menu.m.id] : null}
        actions={menu ? buildActions(menu) : []}
        bubbleProps={{ isGroup, read: menu ? isRead(menu.m) : false, colors, t, peerName }}
        dark={dark}
        t={t}
      />
      <ImageViewer image={viewer} onClose={() => setViewer(null)} />
      <MoneyModal visible={!!money} mode={money} onClose={() => setMoney(null)} conversationId={id} peerUsername={peerUsername} peerName={peerName} />
      <PinModal visible={!!payFor} loading={busy} error={pinErr} onCancel={() => setPayFor(null)} onSubmit={pay}
        title={`Payer ${payFor ? fcfa(payFor.meta.amount) : ''}`} />
    </KeyboardAvoidingView>
  );
}
