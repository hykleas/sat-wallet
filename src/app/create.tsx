import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { SeedGrid } from '@/components/SeedGrid';
import { Button, Header, Notice, Screen, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { errorMessage } from '@/lib/format';
import { useNoScreenshots } from '@/lib/noScreenshots';
import { newMnemonic, WORDLIST } from '@/lib/wallet';
import { C, F } from '@/theme';

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5); // yalnızca ekran düzeni için

function buildQuiz(words: string[]) {
  const idx = shuffle(words.map((_, i) => i)).slice(0, 3).sort((a, b) => a - b);
  return idx.map((i) => {
    const decoys = new Set<string>();
    while (decoys.size < 2) {
      const w = WORDLIST[Math.floor(Math.random() * WORDLIST.length)];
      if (!words.includes(w)) decoys.add(w);
    }
    return { index: i, options: shuffle([words[i], ...decoys]) };
  });
}

export default function Create() {
  useNoScreenshots();
  const { setupWallet } = useWallet();
  const mnemonic = useMemo(() => newMnemonic(), []);
  const words = mnemonic.split(' ');
  const quiz = useMemo(() => buildQuiz(words), [mnemonic]); // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState<'show' | 'verify'>('show');
  const [acknowledged, setAcknowledged] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCorrect = quiz.every((q) => answers[q.index] === words[q.index]);

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await setupWallet(mnemonic);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (router.canDismiss()) router.dismissAll();
      router.replace('/home');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  if (step === 'verify') {
    return (
      <Screen>
        <Header title="2 / 2" onBack={() => setStep('show')} />
        <ScrollView contentContainerStyle={st.body}>
          <View style={{ gap: 8 }}>
            <Text style={st.h1}>Yazdığını kontrol edelim</Text>
            <Text style={st.p}>Her satırda doğru kelimeyi seç.</Text>
          </View>
          {quiz.map((q, qi) => (
            <Animated.View key={q.index} entering={FadeInDown.delay(qi * 80)} style={{ gap: 10 }}>
              <Text style={st.qLabel}>{q.index + 1}. kelime</Text>
              <View style={st.optRow}>
                {q.options.map((o) => {
                  const picked = answers[q.index] === o;
                  const right = picked && o === words[q.index];
                  const wrong = picked && !right;
                  return (
                    <Pressable
                      key={o}
                      onPress={() => {
                        tap();
                        if (o !== words[q.index]) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                        setAnswers((a) => ({ ...a, [q.index]: o }));
                      }}
                      style={[st.opt, right && st.optRight, wrong && st.optWrong]}>
                      <Text style={[st.optText, right && { color: C.bg }, wrong && { color: C.down }]}>{o}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ))}
          {error && <Notice tone="danger">{error}</Notice>}
        </ScrollView>
        <View style={st.footer}>
          <Button title="Cüzdanı oluştur" disabled={!allCorrect} loading={busy} onPress={finish} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="1 / 2" />
      <ScrollView contentContainerStyle={st.body}>
        <Animated.View entering={FadeIn} style={{ gap: 8 }}>
          <Text style={st.h1}>Kurtarma ifaden</Text>
          <Text style={st.p}>
            Bu 12 kelime paranın ta kendisi. Kağıda sırasıyla yaz; telefonun kaybolursa cüzdanını sadece bununla geri alırsın.
          </Text>
        </Animated.View>

        <SeedGrid words={words} />

        <Notice icon="eye-off">Ekran görüntüsü alma, buluta ya da nota kaydetme. Kimseyle paylaşma — biz de dahil.</Notice>

        <Pressable
          onPress={() => {
            tap();
            setAcknowledged((v) => !v);
          }}
          style={st.ack}>
          <View style={[st.box, acknowledged && st.boxOn]}>{acknowledged && <Ionicons name="checkmark" size={16} color={C.onAccent} />}</View>
          <Text style={st.ackText}>Kelimeleri yazdım. Kaybedersem paramın gideceğini anlıyorum.</Text>
        </Pressable>
      </ScrollView>
      <View style={st.footer}>
        <Button title="Devam" disabled={!acknowledged} onPress={() => setStep('verify')} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 20, paddingBottom: 40 },
  h1: { color: C.text, fontSize: 28, fontFamily: F.bold, letterSpacing: -0.8 },
  p: { color: C.sub, fontSize: 15.5, lineHeight: 23, fontFamily: F.regular },
  footer: { paddingHorizontal: 20, paddingBottom: 8 },
  ack: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 4 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.accent, borderColor: C.accent },
  ackText: { flex: 1, color: C.text, fontSize: 14.5, lineHeight: 20, fontFamily: F.regular },
  qLabel: { color: C.muted, fontSize: 14, fontFamily: F.semibold },
  optRow: { flexDirection: 'row', gap: 8 },
  opt: { flex: 1, height: 52, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  optRight: { backgroundColor: C.up },
  optWrong: { backgroundColor: C.down + '1F' },
  optText: { color: C.text, fontSize: 15.5, fontFamily: F.semibold },
});
