import { StyleSheet, Text, View } from 'react-native';

import { SolIcon, TokenLogo } from '@/components/brand';
import { PressableScale, Skeleton } from '@/components/ui';
import type { Asset } from '@/hooks/usePortfolio';
import { formatFiat, formatPercent, formatPrice, formatToken } from '@/lib/format';
import type { Currency } from '@/lib/storage';
import { C, F, NUM } from '@/theme';

const MASK = '••••';

/** Varlık satırı: logo, ad, birim fiyat + 24s değişim; sağda toplam değer ve miktar. */
export function TokenCard({ asset, currency, hidden, onPress }: { asset: Asset; currency: Currency; hidden?: boolean; onPress?: () => void }) {
  const { amount, value, price, change24h } = asset;
  const changeColor = change24h == null || Math.abs(change24h) < 0.005 ? C.muted : change24h > 0 ? C.up : C.down;
  const amountText = amount == null ? null : `${formatToken(amount)} ${asset.symbol}`;

  return (
    <PressableScale onPress={onPress} disabled={!onPress} haptic={false} scaleTo={0.985} style={st.row}>
      {asset.isSol ? <SolIcon size={42} /> : <TokenLogo uri={asset.logo} symbol={asset.symbol} size={42} />}

      <View style={st.left}>
        <Text style={st.name} numberOfLines={1}>
          {asset.name}
        </Text>
        <View style={st.meta}>
          {price != null ? (
            <>
              <Text style={st.price}>{formatPrice(price, currency)}</Text>
              {change24h != null && <Text style={[st.change, { color: changeColor }]}>{formatPercent(change24h)}</Text>}
            </>
          ) : (
            <Text style={st.price}>{asset.symbol}</Text>
          )}
        </View>
      </View>

      <View style={st.right}>
        {amount == null ? (
          <>
            <Skeleton width={72} height={15} />
            <Skeleton width={48} height={12} />
          </>
        ) : (
          <>
            <Text style={st.value} numberOfLines={1}>
              {hidden ? MASK : value != null ? formatFiat(value, currency) : amountText}
            </Text>
            {value != null && (
              <Text style={st.amount} numberOfLines={1}>
                {hidden ? MASK : amountText}
              </Text>
            )}
          </>
        )}
      </View>
    </PressableScale>
  );
}

export function TokenCardSkeleton() {
  return (
    <View style={st.row}>
      <Skeleton width={42} height={42} radius={21} />
      <View style={[st.left, { gap: 8 }]}>
        <Skeleton width="42%" height={14} />
        <Skeleton width="30%" height={11} />
      </View>
      <View style={[st.right, { gap: 8 }]}>
        <Skeleton width={64} height={14} />
        <Skeleton width={44} height={11} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 20, paddingVertical: 11 },
  left: { flex: 1, gap: 4 },
  name: { color: C.text, fontSize: 15.5, fontFamily: F.semibold, letterSpacing: -0.1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  price: { color: C.muted, fontSize: 13, fontFamily: F.regular, ...NUM },
  change: { fontSize: 13, fontFamily: F.medium, ...NUM },
  right: { alignItems: 'flex-end', gap: 4, maxWidth: '45%' },
  value: { color: C.text, fontSize: 15.5, fontFamily: F.semibold, ...NUM },
  amount: { color: C.muted, fontSize: 13, fontFamily: F.regular, ...NUM },
});
