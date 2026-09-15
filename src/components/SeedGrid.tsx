import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/components/ui';
import { C, F } from '@/theme';

/** 12 kelimeyi numaralı ızgarada gösterir; dokunulana kadar örtülü kalır. */
export function SeedGrid({ words, startHidden = true }: { words: string[]; startHidden?: boolean }) {
  const [hidden, setHidden] = useState(startHidden);
  return (
    <Pressable
      onPress={() => {
        if (hidden) {
          tap();
          setHidden(false);
        }
      }}
      style={st.wrap}>
      <View style={st.grid}>
        {words.map((w, i) => (
          <View key={i} style={st.cell}>
            <Text style={st.num}>{i + 1}</Text>
            <Text style={st.word}>{hidden ? '••••••' : w}</Text>
          </View>
        ))}
      </View>
      {hidden && (
        <View style={st.cover}>
          <View style={st.eye}>
            <Ionicons name="eye-outline" size={24} color={C.text} />
          </View>
          <Text style={st.coverTitle}>Görmek için dokun</Text>
          <Text style={st.coverSub}>Etrafında kimse olmadığından emin ol</Text>
        </View>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  cell: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 46 },
  num: { color: C.faint, fontSize: 13, fontFamily: F.medium, width: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
  word: { color: C.text, fontSize: 16.5, fontFamily: F.semibold },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,17,20,0.97)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  eye: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  coverTitle: { color: C.text, fontSize: 16, fontFamily: F.semibold },
  coverSub: { color: C.muted, fontSize: 13.5, fontFamily: F.regular },
});
