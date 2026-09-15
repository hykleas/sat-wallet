import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChainIcon, type Chain } from '@/components/brand';
import { Sheet } from '@/components/Sheet';
import { Badge, PressableScale } from '@/components/ui';
import type { Network } from '@/lib/solana';
import { C, F } from '@/theme';

type Option = { key: string; chain: Chain; title: string; subtitle: string; network?: Network; test?: boolean };

const OPTIONS: Option[] = [
  { key: 'mainnet', chain: 'solana', title: 'Solana', subtitle: 'Ana ağ', network: 'mainnet' },
  { key: 'devnet', chain: 'solana', title: 'Solana Devnet', subtitle: 'Test ağı · değersiz SOL', network: 'devnet', test: true },
];

// Henüz desteklenmeyen zincirler; seçilemez, yalnızca yol haritasını gösterir.
const SOON: Option[] = [
  { key: 'ethereum', chain: 'ethereum', title: 'Ethereum', subtitle: 'EVM desteği' },
  { key: 'base', chain: 'base', title: 'Base', subtitle: 'EVM desteği' },
];

/** Üst çubuktaki ağ seçici: küçük hap + alttan açılan liste. */
export function NetworkSwitcher({ network, onChange }: { network: Network; onChange: (n: Network) => void }) {
  const [open, setOpen] = useState(false);
  const devnet = network === 'devnet';

  return (
    <>
      <PressableScale onPress={() => setOpen(true)} scaleTo={0.95} accessibilityLabel="Ağ seç" style={st.trigger}>
        <ChainIcon chain="solana" size={16} />
        <Text style={st.triggerText}>{devnet ? 'Devnet' : 'Solana'}</Text>
        {devnet && <View style={st.testDot} />}
        <Ionicons name="chevron-down" size={13} color={C.muted} />
      </PressableScale>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Ağ seç">
        <View style={{ gap: 6 }}>
          {OPTIONS.map((o) => {
            const active = o.network === network;
            return (
              <PressableScale
                key={o.key}
                scaleTo={0.98}
                onPress={() => {
                  if (o.network) onChange(o.network);
                  setOpen(false);
                }}
                style={[st.row, active && st.rowActive]}>
                <ChainIcon chain={o.chain} size={34} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={st.title}>{o.title}</Text>
                    {o.test && <Badge tone="warn">Test</Badge>}
                  </View>
                  <Text style={st.subtitle}>{o.subtitle}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color={C.accent} />}
              </PressableScale>
            );
          })}

          <Text style={st.group}>Yakında</Text>
          {SOON.map((o) => (
            <View key={o.key} style={[st.row, { opacity: 0.45 }]}>
              <ChainIcon chain={o.chain} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={st.title}>{o.title}</Text>
                <Text style={st.subtitle}>{o.subtitle}</Text>
              </View>
              <Badge>Yakında</Badge>
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}

const st = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingLeft: 9,
    paddingRight: 10,
    borderRadius: 17,
    backgroundColor: C.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  triggerText: { color: C.text, fontSize: 13.5, fontFamily: F.semibold },
  testDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.warn },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  rowActive: { backgroundColor: C.surface2, borderColor: C.border },
  title: { color: C.text, fontSize: 15.5, fontFamily: F.semibold },
  subtitle: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  group: { color: C.muted, fontSize: 12.5, fontFamily: F.medium, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 2 },
});
