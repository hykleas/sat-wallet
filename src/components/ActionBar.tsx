import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale, type IconName } from '@/components/ui';
import { C, F } from '@/theme';

export type Action = { icon: IconName; label: string; onPress: () => void };

/** Bakiyenin altındaki ana eylemler: büyük, eşit genişlikte dokunma alanları. */
export function ActionBar({ actions }: { actions: Action[] }) {
  return (
    <View style={st.row}>
      {actions.map((a) => (
        <PressableScale key={a.label} onPress={a.onPress} scaleTo={0.94} accessibilityLabel={a.label} style={st.tile}>
          <Ionicons name={a.icon} size={21} color={C.text} />
          <Text style={st.label} numberOfLines={1}>
            {a.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  tile: {
    flex: 1,
    height: 70,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  label: { color: C.sub, fontSize: 12, fontFamily: F.semibold },
});
