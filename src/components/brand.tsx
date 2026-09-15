import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSvgId } from '@/components/ui';
import { C, F } from '@/theme';

/** Marka işareti: indigo karo üstünde Satoshi sembolü (dikey çizgi + üç yatay çizgi). */
export function SatMark({ size = 72, glow = true }: { size?: number; glow?: boolean }) {
  const id = useSvgId();
  return (
    <View
      // Gölge kutusu logoyla aynı yuvarlaklıkta ve dolu olmalı; yoksa web/Android'de kare gölge çıkar.
      style={
        glow
          ? {
              width: size,
              height: size,
              borderRadius: size * 0.3,
              backgroundColor: C.accent,
              shadowColor: C.accent,
              shadowOpacity: 0.35,
              shadowRadius: size * 0.3,
              shadowOffset: { width: 0, height: size * 0.1 },
              elevation: 10,
            }
          : undefined
      }>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#9C90FF" />
            <Stop offset="1" stopColor="#6552F0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" rx="30" fill={`url(#${id})`} />
        <Path d="M50 20 V80 M31 36 H69 M31 50 H69 M31 64 H69" stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function hsl(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Adresten türeyen kimlik simgesi: yakın iki tondan yumuşak bir küre. Her cüzdan için sabit. */
export function Avatar({ address, size = 40 }: { address: string; size?: number }) {
  const id = useSvgId();
  const h = hash(address);
  const hue = h % 360;
  const from = hsl(hue, 72, 66);
  const to = hsl((hue + 38) % 360, 64, 42);
  const cx = 25 + ((h >>> 9) % 50);
  const cy = 20 + ((h >>> 17) % 40);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx={`${cx}%`} cy={`${cy}%`} r="85%">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill={`url(#${id})`} />
      <Circle cx="50" cy="50" r="49.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.12} />
    </Svg>
  );
}

/** Resmî Solana logosu, siyah daire içinde. */
export function SolIcon({ size = 42 }: { size?: number }) {
  const id = useSvgId();
  const w = size * 0.48;
  return (
    <View style={[st.coin, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#000' }]}>
      <Svg width={w} height={(w * 311.7) / 397.7} viewBox="0 0 397.7 311.7">
        <Defs>
          <LinearGradient id={id} x1="360.9" y1="-37.5" x2="141.2" y2="383.3" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#00FFA3" />
            <Stop offset="1" stopColor="#DC1FFF" />
          </LinearGradient>
        </Defs>
        <Path fill={`url(#${id})`} d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" />
        <Path fill={`url(#${id})`} d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" />
        <Path fill={`url(#${id})`} d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" />
      </Svg>
    </View>
  );
}

/** Token logosu; logo yoksa ya da yüklenemezse sembolün baş harfleriyle sade bir disk. */
export function TokenLogo({ uri, symbol, color = C.sub, size = 42 }: { uri?: string | null; symbol: string; color?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return (
      <View style={[st.coin, box, { backgroundColor: C.surface3, overflow: 'hidden' }]}>
        <Image source={{ uri }} style={box} contentFit="cover" transition={150} onError={() => setFailed(true)} />
      </View>
    );
  }
  const label = symbol.slice(0, symbol.length > 3 ? 2 : 3);
  return (
    <View style={[st.coin, box, { backgroundColor: C.surface3 }]}>
      <Text style={{ color, fontFamily: F.bold, fontSize: size * (label.length > 2 ? 0.26 : 0.32) }}>{label}</Text>
    </View>
  );
}

export type Chain = 'solana' | 'ethereum' | 'base';

export function ChainIcon({ chain, size = 22 }: { chain: Chain; size?: number }) {
  if (chain === 'solana') return <SolIcon size={size} />;
  if (chain === 'ethereum') {
    return (
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Circle cx="16" cy="16" r="16" fill="#627EEA" />
        <Path fill="#fff" fillOpacity={0.6} d="M16.5 4v8.87l7.5 3.35z" />
        <Path fill="#fff" d="M16.5 4L9 16.22l7.5-3.35z" />
        <Path fill="#fff" fillOpacity={0.6} d="M16.5 21.97V28L24 17.62z" />
        <Path fill="#fff" d="M16.5 28v-6.03L9 17.62z" />
        <Path fill="#fff" fillOpacity={0.2} d="M16.5 20.57l7.5-4.35-7.5-3.35z" />
        <Path fill="#fff" fillOpacity={0.6} d="M9 16.22l7.5 4.35v-7.7z" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx="16" cy="16" r="16" fill="#0052FF" />
      <Path fill="#fff" d="M15.97 26C21.5 26 26 21.52 26 16S21.5 6 15.97 6C10.72 6 6.42 10.04 6 15.18h13.26v1.64H6C6.42 21.96 10.72 26 15.97 26z" />
    </Svg>
  );
}

const st = StyleSheet.create({
  coin: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
});
