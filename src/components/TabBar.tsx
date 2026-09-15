import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, tap, type IconName } from '@/components/ui';
import { C, F } from '@/theme';

export type TabItem<T extends string> = { value: T; label: string; icon: IconName; iconActive: IconName };

export const TAB_BAR_HEIGHT = 62;

/** Alta sabitlenmiş, içeriğin üstünde süzülen buzlu cam sekme çubuğu. */
export function TabBar<T extends string>({ value, items, onChange }: { value: T; items: TabItem<T>[]; onChange: (v: T) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[st.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Glass intensity={50} style={st.bar}>
        {items.map((it) => {
          const active = it.value === value;
          return (
            <Pressable
              key={it.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) tap();
                onChange(it.value);
              }}
              style={({ pressed }) => [st.item, pressed && { opacity: 0.6 }]}>
              <Ionicons name={active ? it.iconActive : it.icon} size={21} color={active ? C.text : C.muted} />
              <Text style={[st.label, { color: active ? C.text : C.muted }]}>{it.label}</Text>
              <View style={[st.dot, active && { backgroundColor: C.accent }]} />
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 4 },
  label: { fontSize: 11, fontFamily: F.semibold },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});
