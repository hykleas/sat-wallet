import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { SolIcon, TokenLogo } from '@/components/brand';
import { Keypad, applyKey } from '@/components/Keypad';
import { TokenPicker } from '@/components/TokenPicker';
import { Button, Card, DetailRow, Divider, Glow, Header, Notice, PressableScale, Pulse, Screen, Segmented, Skeleton, ZeroFeeBadge } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { confirmUser } from '@/lib/auth';
import { errorMessage, formatFiat, formatPrice, formatRaw, formatToken, formatUnits, parseUnits } from '@/lib/format';
import { POPULAR_MINTS, SOL_MINT, executeSwap, getQuote, getSwapTokens, type Quote, type SwapToken } from '@/lib/jupiter';
import { usdTo } from '@/lib/price';
import { explorerTx, getConnection } from '@/lib/solana';
import { C, F, NUM, R, T } from '@/theme';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// SOL öderken ağ ücretleri ve alınan token için hesap açılışı (~0,002 SOL) payı ayrılır.
const SOL_RESERVE = 10_000_000n;
// Token öderken de ücretler SOL'den kesilir.
const MIN_SOL_FOR_FEES = 3_000_000;
const SLIPPAGES = [
  { value: '30', label: '%0,3' },
  { value: '50', label: '%0,5' },
  { value: '100', label: '%1' },
] as const;
type Slippage = (typeof SLIPPAGES)[number]['value'];

export default function Swap() {
  const w = useWallet();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const currency = w.prefs.currency;
  const devnet = w.prefs.network === 'devnet';

  const [payMint, setPayMint] = useState(params.from ?? SOL_MINT);
  const [receiveMint, setReceiveMint] = useState(params.to ?? (params.from === USDC ? SOL_MINT : USDC));
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState<Slippage>('50');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, SwapToken>>({});
  const [picker, setPicker] = useState<'pay' | 'receive' | null>(null);
  const [step, setStep] = useState<'form' | 'review' | 'sending' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ quote: Quote; signature: string } | null>(null);
  const [tick, setTick] = useState(0);

  const heldKey = w.tokens.map((t) => t.mint).join(',');
  useEffect(() => {
    const wanted = [...new Set([...POPULAR_MINTS, ...w.tokens.map((t) => t.mint), payMint, receiveMint])];
    getSwapTokens(wanted)
      .then((list) => setInfo((cur) => ({ ...cur, ...Object.fromEntries(list.map((t) => [t.mint, t])) })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldKey, payMint, receiveMint]);

  // Teklif ~20 sn'de bir tazelenir; ekranda bekleyen fiyat bayatlamasın.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 20_000);
    return () => clearInterval(i);
  }, []);

  const holdingOf = (mint: string) => w.tokens.find((t) => t.mint === mint);
  const decimalsOf = (mint: string) => (mint === SOL_MINT ? 9 : (holdingOf(mint)?.decimals ?? info[mint]?.decimals ?? null));
  const symbolOf = (mint: string) => info[mint]?.symbol ?? (mint === SOL_MINT ? 'SOL' : (w.markets[mint]?.symbol ?? holdingOf(mint)?.meta.symbol ?? '…'));
  const priceOf = (mint: string) => {
    if (!w.prices) return null;
    if (mint === SOL_MINT) return w.prices.sol[currency];
    const usd = info[mint]?.usd ?? w.markets[mint]?.usd;
    return usd != null ? usdTo(usd, w.prices, currency) : null;
  };
  const balanceOf = (mint: string) => (mint === SOL_MINT ? BigInt(w.lamports ?? 0) : BigInt(holdingOf(mint)?.raw ?? '0'));
  const Logo = ({ mint, size }: { mint: string; size: number }) =>
    mint === SOL_MINT ? <SolIcon size={size} /> : <TokenLogo uri={info[mint]?.icon ?? w.markets[mint]?.icon} symbol={symbolOf(mint)} size={size} />;

  const payDecimals = decimalsOf(payMint) ?? 9;
  const recvDecimals = decimalsOf(receiveMint);
  const payBalance = balanceOf(payMint);
  const spendable = payMint === SOL_MINT ? (payBalance > SOL_RESERVE ? payBalance - SOL_RESERVE : 0n) : payBalance;
  const inRaw = parseUnits(amount, payDecimals);
  const hasAmount = inRaw != null && inRaw > 0n;
  const over = hasAmount && inRaw > spendable;
  const needsSol = payMint !== SOL_MINT && (w.lamports ?? 0) < MIN_SOL_FOR_FEES;

  useEffect(() => {
    if (!hasAmount || payMint === receiveMint || devnet) {
      setQuoting(false);
      setQuoteError(null);
      return;
    }
    const ctrl = new AbortController();
    setQuoting(true);
    const t = setTimeout(() => {
      getQuote({ inputMint: payMint, outputMint: receiveMint, amount: inRaw, slippageBps: Number(slippage) }, ctrl.signal)
        .then((q) => {
          setQuote(q);
          setQuoteError(null);
        })
        .catch((e) => !ctrl.signal.aborted && setQuoteError(errorMessage(e)))
        .finally(() => !ctrl.signal.aborted && setQuoting(false));
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, payMint, receiveMint, slippage, payDecimals, devnet, tick]);

  // Yalnızca şu anki girdilere ait teklif gösterilir; yazarken eski teklif yanlış tutar göstermesin.
  const live =
    quote && hasAmount && quote.inputMint === payMint && quote.outputMint === receiveMint && quote.inAmount === inRaw.toString() && quote.slippageBps === Number(slippage)
      ? quote
      : null;

  const outText = live && recvDecimals != null ? formatRaw(BigInt(live.outAmount), recvDecimals) : null;
  const fiat = (mint: string, raw: bigint, dec: number | null) => {
    const p = priceOf(mint);
    return p != null && dec != null ? formatFiat(Number(formatUnits(raw, dec)) * p, currency) : null;
  };
  const rate =
    live && recvDecimals != null
      ? Number(formatUnits(BigInt(live.outAmount), recvDecimals)) / Number(formatUnits(BigInt(live.inAmount), payDecimals))
      : null;
  const rateText = rate != null ? `1 ${symbolOf(payMint)} ≈ ${rate.toLocaleString('tr-TR', { maximumSignificantDigits: 6 })} ${symbolOf(receiveMint)}` : '';
  const impact = live ? Number(live.priceImpactPct) * 100 : 0;
  const receiveVerified = receiveMint === SOL_MINT || info[receiveMint]?.verified !== false;

  const flip = () => {
    setPayMint(receiveMint);
    setReceiveMint(payMint);
    setAmount('');
  };

  const onPick = (mint: string, token?: SwapToken) => {
    if (token) setInfo((cur) => ({ ...cur, [mint]: token }));
    if (picker === 'pay') {
      if (mint === receiveMint) setReceiveMint(payMint);
      setPayMint(mint);
      setAmount('');
    } else if (picker === 'receive') {
      if (mint === payMint) {
        setPayMint(receiveMint);
        setAmount('');
      }
      setReceiveMint(mint);
    }
  };

  const confirm = async () => {
    if (!live) return;
    const label = `${formatRaw(BigInt(live.inAmount), payDecimals)} ${symbolOf(payMint)} → ${symbolOf(receiveMint)}`;
    if (!(await confirmUser(`${label} takasını onayla`))) return;
    setStep('sending');
    setError(null);
    try {
      // Onay ekranında beklerken fiyat kaymış olabilir; kullanıcının gördüğü "en az" tutarın altına düşeni gönderme.
      const fresh = await getQuote({ inputMint: payMint, outputMint: receiveMint, amount: BigInt(live.inAmount), slippageBps: Number(slippage) });
      if (BigInt(fresh.outAmount) < BigInt(live.otherAmountThreshold)) {
        setQuote(fresh);
        throw new Error('Fiyat değişti. Yeni teklifi kontrol edip tekrar onayla.');
      }
      const signature = await executeSwap(getConnection('mainnet'), w.getSigner(), fresh);
      setResult({ quote: fresh, signature });
      setStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      w.refresh();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(errorMessage(e));
      setStep('review');
    }
  };

  const tokenPicker = (
    <TokenPicker
      visible={picker != null}
      onClose={() => setPicker(null)}
      title={picker === 'pay' ? 'Ne ödeyeceksin?' : 'Ne alacaksın?'}
      mode={picker === 'pay' ? 'owned' : 'all'}
      info={info}
      onPick={onPick}
    />
  );

  if (step === 'sending' && live) {
    return (
      <Screen style={st.center}>
        <Pulse>
          <Logo mint={payMint} size={64} />
        </Pulse>
        <Text style={[T.title, { marginTop: 16 }]}>Takas ediliyor</Text>
        <Text style={st.centerSub}>
          {formatRaw(BigInt(live.inAmount), payDecimals)} {symbolOf(payMint)} → {symbolOf(receiveMint)}
          {'\n'}Ağ onayı genelde birkaç saniye sürer.
        </Text>
      </Screen>
    );
  }

  if (step === 'done' && result) {
    const q = result.quote;
    return (
      <Screen>
        <Glow height={480} opacity={0.12} color={C.up} />
        <View style={[st.center, { flex: 1 }]}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={st.doneCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(180)} style={{ alignItems: 'center', gap: 6, marginTop: 24 }}>
            <Text style={T.title}>Takas tamamlandı</Text>
            <Text style={st.doneAmount}>
              {formatRaw(BigInt(q.inAmount), payDecimals)} {symbolOf(payMint)} → {recvDecimals != null ? formatRaw(BigInt(q.outAmount), recvDecimals) : ''} {symbolOf(receiveMint)}
            </Text>
            <Text style={st.centerSub}>Alınan miktar tahminidir; kesin tutar işlem detayında.</Text>
          </Animated.View>
        </View>
        <View style={st.footer}>
          <Button title="İşlemi Solscan'de gör" variant="secondary" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(explorerTx(result.signature, 'mainnet'))} />
          <Button title="Bitti" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (step === 'review' && hasAmount) {
    return (
      <Screen>
        <Header title="Takası onayla" onBack={() => setStep('form')} />
        <ScrollView contentContainerStyle={st.body}>
          <Card style={{ gap: 14 }}>
            <Leg label="Ödüyorsun" logo={<Logo mint={payMint} size={40} />} amount={`${formatRaw(inRaw, payDecimals)} ${symbolOf(payMint)}`} fiat={fiat(payMint, inRaw, payDecimals)} />
            <Divider />
            <Leg
              label="Alıyorsun (tahmini)"
              logo={<Logo mint={receiveMint} size={40} />}
              amount={outText ? `${outText} ${symbolOf(receiveMint)}` : null}
              fiat={live ? fiat(receiveMint, BigInt(live.outAmount), recvDecimals) : null}
            />
          </Card>

          <Card style={{ gap: 16 }}>
            <DetailRow label="Oran" value={live ? rateText : '…'} />
            <DetailRow label="Fiyat etkisi" value={live ? `%${Math.max(impact, 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}` : '…'} valueColor={impact > 5 ? C.down : impact > 1 ? C.warn : undefined} />
            <DetailRow label="Kayma toleransı">
              <View style={{ width: 176 }}>
                <Segmented value={slippage} onChange={setSlippage} options={SLIPPAGES.map((o) => ({ value: o.value, label: o.label }))} />
              </View>
            </DetailRow>
            <DetailRow
              label="En az alacağın"
              value={live && recvDecimals != null ? `${formatRaw(BigInt(live.otherAmountThreshold), recvDecimals)} ${symbolOf(receiveMint)}` : '…'}
            />
            <DetailRow
              label="Rota"
              value={live ? [...new Set(live.routePlan.map((r) => r.swapInfo.label).filter(Boolean))].slice(0, 3).join(' · ') || 'Jupiter' : '…'}
            />
            <DetailRow label="Ağ ücreti" value="≈ 0,00001 SOL" sub="Yoğunlukta en fazla 0,0005 SOL" />
            <DetailRow
              label={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={st.lineLabel}>Platform ücreti</Text>
                  <ZeroFeeBadge />
                </View>
              }
              value={formatFiat(0, currency)}
              valueColor={C.up}
            />
          </Card>
          <Text style={st.note}>Havuz (DEX) ücreti fiyata dahildir ve her cüzdanda aynıdır. Sat üstüne hiçbir şey eklemez.</Text>

          {impact > 5 && <Notice tone="danger">Fiyat etkisi çok yüksek; bu havuzda likidite az. Daha küçük bir tutar dene.</Notice>}
          {!receiveVerified && (
            <Notice>{symbolOf(receiveMint)} Jupiter tarafından doğrulanmamış. Aynı isimde sahte kopyalar olabilir; mint adresini kaynağından kontrol et.</Notice>
          )}
          {quoteError && !live && <Notice tone="danger">{quoteError}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
        </ScrollView>
        <View style={st.footer}>
          <View style={st.trust}>
            <Ionicons name="shield-checkmark" size={13} color={C.muted} />
            <Text style={st.trustText}>İşlem bu telefonda imzalanır · %0 komisyon</Text>
          </View>
          <Button title="Onayla ve takas et" icon="finger-print" disabled={!live || over} loading={quoting && !live} onPress={confirm} />
        </View>
        {tokenPicker}
      </Screen>
    );
  }

  const hint = devnet
    ? { text: 'Takas yalnızca Solana ana ağında çalışır. Ayarlardan Mainnet’e geç.', color: C.warn }
    : payMint === receiveMint
      ? { text: 'İki farklı token seç', color: C.warn }
      : over
        ? { text: payMint === SOL_MINT ? 'Bakiye yetersiz (0,01 SOL ağ ücretleri için ayrılır)' : 'Bakiye yetersiz', color: C.down }
        : needsSol
          ? { text: 'Ağ ücreti için cüzdanda biraz SOL olmalı (~0,003 SOL)', color: C.down }
          : quoteError
            ? { text: quoteError, color: C.down }
            : live
              ? { text: `${rateText} · %0 komisyon`, color: C.muted }
              : null;

  const canContinue = !!live && !over && !needsSol && !devnet;

  return (
    <Screen>
      <Header title="Takas" />

      <View style={st.cards}>
        <View style={st.card}>
          <View style={st.cardTop}>
            <Text style={T.micro}>Ödüyorsun</Text>
            <PressableScale
              onPress={() => {
                if (spendable > 0n) setAmount(formatUnits(spendable, payDecimals));
              }}
              scaleTo={0.95}
              style={st.balanceChip}>
              <Text style={st.balanceText}>Bakiye {formatRaw(payBalance, payDecimals)}</Text>
              <Text style={st.maxText}>Maks</Text>
            </PressableScale>
          </View>
          <View style={st.cardMid}>
            <Text style={[st.amount, !amount && { color: C.faint }, over && { color: C.down }]} numberOfLines={1} adjustsFontSizeToFit>
              {(amount || '0').replace('.', ',')}
            </Text>
            <TokenChip logo={<Logo mint={payMint} size={24} />} symbol={symbolOf(payMint)} onPress={() => setPicker('pay')} />
          </View>
          <Text style={st.fiat}>{hasAmount ? (fiat(payMint, inRaw, payDecimals) ?? ' ') : ' '}</Text>
        </View>

        <View style={st.flipWrap} pointerEvents="box-none">
          <PressableScale onPress={flip} scaleTo={0.9} accessibilityLabel="Yönü değiştir" style={st.flip}>
            <Ionicons name="arrow-down" size={18} color={C.text} />
          </PressableScale>
        </View>

        <View style={st.card}>
          <View style={st.cardTop}>
            <Text style={T.micro}>Alıyorsun</Text>
            {priceOf(receiveMint) != null && <Text style={st.balanceText}>{formatPrice(priceOf(receiveMint)!, currency)}</Text>}
          </View>
          <View style={st.cardMid}>
            {quoting && !live ? (
              <Skeleton width={130} height={34} radius={10} />
            ) : (
              <Text style={[st.amount, !outText && { color: C.faint }]} numberOfLines={1} adjustsFontSizeToFit>
                {live && recvDecimals != null ? formatToken(Number(formatUnits(BigInt(live.outAmount), recvDecimals))) : '0'}
              </Text>
            )}
            <TokenChip logo={<Logo mint={receiveMint} size={24} />} symbol={symbolOf(receiveMint)} onPress={() => setPicker('receive')} />
          </View>
          <Text style={st.fiat}>{live ? (fiat(receiveMint, BigInt(live.outAmount), recvDecimals) ?? ' ') : ' '}</Text>
        </View>
      </View>

      <Text style={[st.hint, { color: hint?.color ?? 'transparent' }]} numberOfLines={2}>
        {hint?.text ?? ' '}
      </Text>

      <View style={{ flex: 1 }} />

      <Keypad keyHeight={54} onKey={(k) => setAmount((cur) => applyKey(cur, k, payDecimals))} />

      <View style={st.footer}>
        <Button title="Devam" disabled={!canContinue} onPress={() => setStep('review')} />
      </View>
      {tokenPicker}
    </Screen>
  );
}

function TokenChip({ logo, symbol, onPress }: { logo: React.ReactNode; symbol: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.95} accessibilityLabel={`${symbol} seç`} style={st.chip}>
      {logo}
      <Text style={st.chipText} numberOfLines={1}>
        {symbol}
      </Text>
      <Ionicons name="chevron-down" size={14} color={C.muted} />
    </PressableScale>
  );
}

function Leg({ label, logo, amount, fiat }: { label: string; logo: React.ReactNode; amount: string | null; fiat: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {logo}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={T.micro}>{label}</Text>
        {amount ? (
          <Text style={st.legAmount} numberOfLines={1} adjustsFontSizeToFit>
            {amount}
          </Text>
        ) : (
          <Skeleton width={140} height={20} />
        )}
      </View>
      {fiat && <Text style={st.legFiat}>{fiat}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  centerSub: { color: C.muted, fontSize: 14.5, lineHeight: 21, fontFamily: F.regular, textAlign: 'center', marginTop: 6, ...NUM },
  footer: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  cards: { paddingHorizontal: 20, paddingTop: 4 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 16, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  cardMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  amount: { flex: 1, color: C.text, fontSize: 36, fontFamily: F.semibold, letterSpacing: -1.2, ...NUM },
  fiat: { color: C.muted, fontSize: 13.5, fontFamily: F.regular, ...NUM },
  balanceChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceText: { color: C.muted, fontSize: 12.5, fontFamily: F.regular, ...NUM },
  maxText: { color: C.accent, fontSize: 12.5, fontFamily: F.semibold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: C.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    maxWidth: 150,
  },
  chipText: { color: C.text, fontSize: 15, fontFamily: F.semibold, flexShrink: 1 },
  flipWrap: { height: 8, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  flip: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.surface2, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, fontFamily: F.medium, textAlign: 'center', marginTop: 12, paddingHorizontal: 24, minHeight: 18, ...NUM },
  legAmount: { color: C.text, fontSize: 18, fontFamily: F.semibold, ...NUM },
  legFiat: { color: C.muted, fontSize: 13.5, fontFamily: F.regular, ...NUM },
  lineLabel: { color: C.muted, fontSize: 14.5, fontFamily: F.regular },
  note: { color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.regular, paddingHorizontal: 4 },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  trustText: { color: C.muted, fontSize: 12.5, fontFamily: F.medium },
  doneCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.up, alignItems: 'center', justifyContent: 'center' },
  doneAmount: { color: C.text, fontSize: 17, fontFamily: F.semibold, textAlign: 'center', ...NUM },
});
