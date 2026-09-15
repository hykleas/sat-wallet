import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, PressableScale, Skeleton, type IconName } from '@/components/ui';
import { clockTime, dayLabel, formatToken, shortAddress } from '@/lib/format';
import { explorerTx, type Activity, type Network } from '@/lib/solana';
import { C, F, NUM } from '@/theme';

const MASK = '••••';

type Look = { title: string; icon: IconName; fg: string; bg: string };

function look(a: Activity): Look {
  if (a.failed) return { title: 'Başarısız', icon: 'close', fg: C.down, bg: C.downSoft };
  switch (a.kind) {
    case 'in':
      return { title: 'Alındı', icon: 'arrow-down', fg: C.up, bg: C.upSoft };
    case 'out':
      return { title: 'Gönderildi', icon: 'arrow-up', fg: C.text, bg: C.surface3 };
    case 'swap':
      return { title: 'Takas', icon: 'swap-horizontal', fg: C.accent, bg: C.accentSoft };
    default:
      return { title: 'Uygulama işlemi', icon: 'flash-outline', fg: C.sub, bg: C.surface3 };
  }
}

export function ActivityRow({ item, network, hidden }: { item: Activity; network: Network; hidden?: boolean }) {
  const l = look(item);
  const time = clockTime(item.time);
  const detail =
    item.kind === 'swap'
      ? `${item.fromSymbol} → ${item.symbol}`
      : item.counterparty
        ? `${item.kind === 'in' ? 'Kimden' : 'Kime'} ${shortAddress(item.counterparty)}`
        : null;
  const sign = item.kind === 'out' ? '−' : '+';
  const amount = item.amount > 0 ? `${sign}${formatToken(item.amount)} ${item.symbol}` : null;
  const positive = !item.failed && (item.kind === 'in' || item.kind === 'swap');

  return (
    <PressableScale haptic={false} scaleTo={0.985} onPress={() => WebBrowser.openBrowserAsync(explorerTx(item.signature, network))} style={st.row}>
      <View style={[st.icon, { backgroundColor: l.bg }]}>
        <Ionicons name={l.icon} size={18} color={l.fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={st.title}>{l.title}</Text>
        <Text style={st.sub} numberOfLines={1}>
          {[detail, time].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '46%' }}>
        {amount && (
          <Text style={[st.amount, positive && { color: C.up }, item.failed && { color: C.muted, textDecorationLine: 'line-through' }]} numberOfLines={1}>
            {hidden ? MASK : amount}
          </Text>
        )}
        {item.kind === 'swap' && item.fromAmount != null && (
          <Text style={st.sub} numberOfLines={1}>
            {hidden ? MASK : `−${formatToken(item.fromAmount)} ${item.fromSymbol}`}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/** Güne göre gruplanmış işlem akışı. */
export function ActivityFeed({
  items,
  failed,
  onRetry,
  network,
  hidden,
}: {
  items: Activity[] | null;
  failed: boolean;
  onRetry: () => void;
  network: Network;
  hidden?: boolean;
}) {
  if (failed && !items?.length) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Aktivite yüklenemedi"
        subtitle="Ağ şu an yanıt vermiyor."
        action={<Button title="Tekrar dene" variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: 10 }} />}
      />
    );
  }
  if (items == null) {
    return (
      <View style={{ paddingTop: 12 }}>
        <Skeleton width={56} height={12} style={{ marginHorizontal: 20, marginBottom: 10 }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={st.row}>
            <Skeleton width={40} height={40} radius={20} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="38%" height={14} />
              <Skeleton width="55%" height={11} />
            </View>
            <Skeleton width={70} height={14} />
          </View>
        ))}
      </View>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon="time-outline" title="Henüz işlem yok" subtitle="Gönderdiğin ve aldığın her şey burada görünür." />;
  }

  const groups: { label: string; items: Activity[] }[] = [];
  for (const a of items) {
    const label = dayLabel(a.time);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <View>
      {groups.map((g) => (
        <View key={g.label} style={{ marginBottom: 6 }}>
          <Text style={st.day}>{g.label}</Text>
          {g.items.map((a) => (
            <ActivityRow key={a.signature} item={a} network={network} hidden={hidden} />
          ))}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  day: { color: C.muted, fontSize: 12.5, fontFamily: F.medium, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingVertical: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.text, fontSize: 15.5, fontFamily: F.semibold },
  sub: { color: C.muted, fontSize: 13, fontFamily: F.regular, ...NUM },
  amount: { color: C.text, fontSize: 15.5, fontFamily: F.semibold, ...NUM },
});
