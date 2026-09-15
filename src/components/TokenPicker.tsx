import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { SolIcon, TokenLogo } from '@/components/brand';
import { Sheet } from '@/components/Sheet';
import { TokenCard } from '@/components/TokenCard';
import { Badge, PressableScale, Skeleton } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { formatPrice } from '@/lib/format';
import { POPULAR_MINTS, SOL_MINT, searchTokens, type SwapToken } from '@/lib/jupiter';
import { usdTo } from '@/lib/price';
import { C, F } from '@/theme';

/**
 * Token seçici.
 * `owned`: yalnızca cüzdandaki varlıklar (göndermek/ödemek için).
 * `all`: popüler tokenlar + Jupiter'de arama (almak için).
 */
export function TokenPicker({
  visible,
  onClose,
  title,
  mode,
  info,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  mode: 'owned' | 'all';
  info: Record<string, SwapToken>;
  onPick: (mint: string, token?: SwapToken) => void;
}) {
  const w = useWallet();
  const { assets } = usePortfolio();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SwapToken[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (mode !== 'all' || q.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setFailed(false);
      searchTokens(q, ctrl.signal)
        .then((list) => setResults([...list].sort((a, b) => Number(b.verified) - Number(a.verified)).slice(0, 40)))
        .catch(() => !ctrl.signal.aborted && setFailed(true));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, mode]);

  const pick = (mint: string, token?: SwapToken) => {
    onPick(mint, token);
    onClose();
  };

  const owned = assets.filter((a) => a.isSol || (a.amount ?? 0) > 0);
  const popular = [...new Set([...POPULAR_MINTS, ...w.tokens.map((t) => t.mint)])].flatMap((m) => info[m] ?? []);
  const list = results ?? popular;

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {mode === 'all' && (
        <View style={st.search}>
          <Ionicons name="search" size={17} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ad, sembol ya da mint adresi"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={st.searchInput}
          />
          {query.length > 0 && <Ionicons name="close-circle" size={18} color={C.muted} onPress={() => setQuery('')} />}
        </View>
      )}

      <ScrollView style={{ maxHeight: height * 0.55, marginHorizontal: -20 }} keyboardShouldPersistTaps="handled">
        {mode === 'owned' ? (
          owned.map((a) => <TokenCard key={a.key} asset={a} currency={w.prefs.currency} onPress={() => pick(a.isSol ? SOL_MINT : a.key)} />)
        ) : failed ? (
          <Text style={st.empty}>Arama yapılamadı. Bağlantını kontrol et.</Text>
        ) : results?.length === 0 ? (
          <Text style={st.empty}>Sonuç yok.</Text>
        ) : list.length === 0 ? (
          [0, 1, 2, 3].map((i) => (
            <View key={i} style={st.row}>
              <Skeleton width={38} height={38} radius={19} />
              <View style={{ flex: 1, gap: 7 }}>
                <Skeleton width="30%" height={13} />
                <Skeleton width="45%" height={11} />
              </View>
            </View>
          ))
        ) : (
          <>
            {results == null && <Text style={st.group}>Popüler</Text>}
            {list.map((t) => {
              const held = w.tokens.find((h) => h.mint === t.mint);
              const price = t.usd != null && w.prices ? usdTo(t.usd, w.prices, w.prefs.currency) : null;
              return (
                <PressableScale key={t.mint} haptic={false} scaleTo={0.985} onPress={() => pick(t.mint, t)} style={st.row}>
                  {t.mint === SOL_MINT ? <SolIcon size={38} /> : <TokenLogo uri={t.icon} symbol={t.symbol} size={38} />}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={st.symbol} numberOfLines={1}>
                        {t.symbol}
                      </Text>
                      {t.verified ? <Ionicons name="checkmark-circle" size={14} color={C.accent} /> : <Badge tone="warn">Doğrulanmamış</Badge>}
                    </View>
                    <Text style={st.name} numberOfLines={1}>
                      {t.mint === SOL_MINT ? 'Solana' : t.name}
                    </Text>
                  </View>
                  <Text style={st.right}>{held ? `${held.amount.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}` : price != null ? formatPrice(price, w.prefs.currency) : ''}</Text>
                </PressableScale>
              );
            })}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

const st = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, fontFamily: F.medium, height: '100%' },
  group: { color: C.muted, fontSize: 12.5, fontFamily: F.medium, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  symbol: { color: C.text, fontSize: 15.5, fontFamily: F.semibold, flexShrink: 1 },
  name: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  right: { color: C.sub, fontSize: 13.5, fontFamily: F.medium, fontVariant: ['tabular-nums'] },
  empty: { color: C.muted, fontSize: 14, fontFamily: F.regular, textAlign: 'center', paddingVertical: 32 },
});
