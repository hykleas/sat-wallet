import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/brand';
import { PressableScale } from '@/components/ui';
import { shortAddress } from '@/lib/format';
import { C, F } from '@/theme';

/** Kısaltılmış adres; tek dokunuşla kopyalar ve kısa süre "Kopyalandı" onayı gösterir. */
export function AddressBadge({
  address,
  chars = 4,
  avatar = false,
  plain = false,
  style,
}: {
  address: string;
  chars?: number;
  avatar?: boolean;
  /** Arka plansız, satır içi kullanım. */
  plain?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <PressableScale onPress={copy} haptic={false} hitSlop={6} accessibilityLabel="Adresi kopyala" style={[st.badge, plain && st.plain, style]}>
      {avatar && <Avatar address={address} size={18} />}
      <Text style={[st.text, copied && { color: C.up }]} numberOfLines={1}>
        {copied ? 'Kopyalandı' : shortAddress(address, chars)}
      </Text>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={12} color={copied ? C.up : C.muted} />
    </PressableScale>
  );
}

const st = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: C.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  plain: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, height: 20 },
  text: { color: C.sub, fontSize: 13, fontFamily: F.medium },
});
