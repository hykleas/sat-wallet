import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SatMark } from '@/components/brand';
import { Button, Glow, Screen, type IconName } from '@/components/ui';
import { C, F } from '@/theme';

const FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'lock-closed', label: 'Anahtar sende' },
  { icon: 'flash', label: 'Saniyeler içinde' },
  { icon: 'pricetag', label: '%0 komisyon' },
];

export default function Welcome() {
  return (
    <Screen>
      <Glow height={560} opacity={0.14} />
      <View style={st.top}>
        <Animated.View entering={FadeInDown.duration(700)} style={{ alignItems: 'center', gap: 18 }}>
          <SatMark size={104} />
          <Text style={st.wordmark}>sat</Text>
        </Animated.View>
      </View>

      <View style={st.bottom}>
        <Animated.Text entering={FadeInDown.delay(120).duration(600)} style={st.title}>
          Kendi paran.{'\n'}Kendi anahtarın.
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={st.sub}>
          Solana için sade ve hızlı bir cüzdan. Sunucu yok, takip yok.
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(280).duration(600)} style={st.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={st.chip}>
              <Ionicons name={f.icon} size={13} color={C.accent} />
              <Text style={st.chipText}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360).duration(600)} style={st.actions}>
          <Button title="Yeni cüzdan oluştur" onPress={() => router.push('/create')} />
          <Button title="Mevcut cüzdanı içe aktar" variant="secondary" onPress={() => router.push('/import')} />
          <Text style={st.foot}>Phantom, Solflare ve Backpack ile uyumlu</Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  wordmark: { color: C.text, fontSize: 30, fontFamily: F.heavy, letterSpacing: -1 },
  bottom: { paddingHorizontal: 24, gap: 14, paddingBottom: 8 },
  title: { color: C.text, fontSize: 36, lineHeight: 42, fontFamily: F.heavy, letterSpacing: -1.4 },
  sub: { color: C.sub, fontSize: 16, lineHeight: 23, fontFamily: F.regular },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 10, backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  chipText: { color: C.sub, fontSize: 13, fontFamily: F.medium },
  actions: { gap: 10, marginTop: 18 },
  foot: { color: C.faint, fontSize: 12.5, fontFamily: F.regular, textAlign: 'center', marginTop: 6 },
});
