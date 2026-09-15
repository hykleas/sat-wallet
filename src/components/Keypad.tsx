import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/components/ui';
import { C, F, NUM } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Tuşu tutara uygular; ondalık basamak tokenin ondalığıyla, toplam uzunluk 15 haneyle sınırlı. */
export function applyKey(cur: string, k: string, maxFrac: number) {
  if (k === 'clear') return '';
  if (k === 'del') return cur.slice(0, -1);
  if (k === '.') return maxFrac === 0 || cur.includes('.') ? cur : (cur || '0') + '.';
  if (cur === '0') return k;
  const frac = cur.split('.')[1];
  if (frac != null && frac.length >= maxFrac) return cur;
  if (cur.replace('.', '').length >= 15) return cur;
  return cur + k;
}

/** Uygulamanın kendi sayı klavyesi: sistem klavyesinin aksine tutarı her zaman ekranda tutar. Uzun basınca siler. */
export function Keypad({ onKey, keyHeight = 58 }: { onKey: (k: string) => void; keyHeight?: number }) {
  return (
    <View style={st.pad}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityLabel={k === 'del' ? 'Sil' : k}
          onPress={() => {
            tap();
            onKey(k);
          }}
          onLongPress={k === 'del' ? () => onKey('clear') : undefined}
          style={({ pressed }) => [st.key, { height: keyHeight }, pressed && { backgroundColor: C.surface2 }]}>
          {k === 'del' ? <Ionicons name="backspace-outline" size={24} color={C.sub} /> : <Text style={st.keyText}>{k === '.' ? ',' : k}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 6 },
  key: { width: '33.333%', alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  keyText: { color: C.text, fontSize: 26, fontFamily: F.medium, ...NUM },
});
