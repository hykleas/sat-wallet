import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Header, Notice, Screen, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { errorMessage } from '@/lib/format';
import { useNoScreenshots } from '@/lib/noScreenshots';
import { isValidMnemonic, normalizeMnemonic } from '@/lib/wallet';
import { C, F } from '@/theme';

export default function Import() {
  useNoScreenshots();
  const { setupWallet } = useWallet();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeMnemonic(text);
  const count = normalized ? normalized.split(' ').length : 0;
  const lengthOk = count === 12 || count === 24;

  const submit = async () => {
    setError(null);
    if (!isValidMnemonic(normalized)) {
      setError('Bu kelimeler geçerli bir kurtarma ifadesi oluşturmuyor. Yazım ve sırayı kontrol et.');
      return;
    }
    setBusy(true);
    try {
      await setupWallet(normalized);
      if (router.canDismiss()) router.dismissAll();
      router.replace('/home');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            <Text style={st.h1}>Cüzdanını içe aktar</Text>
            <Text style={st.p}>12 ya da 24 kelimeyi aralarında boşlukla yaz. Phantom'daki ana hesabın aynı adresle açılır.</Text>
          </View>

          <View style={st.inputWrap}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError(null);
              }}
              placeholder="kelime1 kelime2 kelime3 …"
              placeholderTextColor={C.faint}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              importantForAutofill="no"
              style={st.input}
            />
            <View style={st.inputBar}>
              <Text style={[st.count, lengthOk && { color: C.up }]}>{count} / 12 kelime</Text>
              <Pressable
                hitSlop={8}
                onPress={async () => {
                  tap();
                  const clip = await Clipboard.getStringAsync();
                  if (clip) setText(clip);
                }}
                style={st.pasteChip}>
                <Text style={st.paste}>Yapıştır</Text>
              </Pressable>
            </View>
          </View>

          {error && <Notice tone="danger">{error}</Notice>}
          <Notice tone="info" icon="lock-closed">
            Kelimeler bu telefonun güvenli kasasında şifreli saklanır, hiçbir sunucuya gönderilmez.
          </Notice>
        </ScrollView>
        <View style={st.footer}>
          <Button title="Cüzdanı aç" disabled={!lengthOk} loading={busy} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 18 },
  h1: { color: C.text, fontSize: 28, fontFamily: F.bold, letterSpacing: -0.8 },
  p: { color: C.sub, fontSize: 15.5, lineHeight: 23, fontFamily: F.regular },
  inputWrap: { backgroundColor: C.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  input: { minHeight: 150, padding: 18, color: C.text, fontSize: 17, lineHeight: 27, fontFamily: F.medium, textAlignVertical: 'top' },
  inputBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 18, paddingRight: 10, paddingBottom: 10 },
  count: { color: C.muted, fontSize: 13.5, fontFamily: F.medium },
  pasteChip: { paddingHorizontal: 14, height: 36, borderRadius: 12, backgroundColor: C.surface2, justifyContent: 'center' },
  paste: { color: C.accent, fontSize: 14, fontFamily: F.semibold },
  footer: { paddingHorizontal: 20, paddingBottom: 8 },
});
