import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SatMark } from '@/components/brand';
import { Glow, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { C, F } from '@/theme';

export function LockScreen() {
  const { unlock } = useWallet();
  const [busy, setBusy] = useState(false);

  const tryUnlock = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await unlock();
    if (!ok) setBusy(false);
  };

  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, st.root]}>
      <Glow height={520} opacity={0.2} />
      <View style={st.center}>
        <SatMark size={80} />
        <Text style={st.title}>Sat kilitli</Text>
        <Text style={st.sub}>Devam etmek için kimliğini doğrula</Text>
      </View>
      <Pressable
        onPress={() => {
          tap();
          tryUnlock();
        }}
        style={({ pressed }) => [st.fp, pressed && { backgroundColor: C.surface3 }]}>
        {busy ? <ActivityIndicator color={C.accent} /> : <Ionicons name="finger-print" size={32} color={C.accent} />}
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { alignItems: 'center', gap: 10, marginTop: -80 },
  title: { color: C.text, fontSize: 24, fontFamily: F.bold, marginTop: 22, letterSpacing: -0.5 },
  sub: { color: C.muted, fontSize: 15, fontFamily: F.regular },
  fp: { position: 'absolute', bottom: 90, width: 72, height: 72, borderRadius: 36, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
});
