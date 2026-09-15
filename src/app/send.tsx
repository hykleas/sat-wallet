import Ionicons from '@expo/vector-icons/Ionicons';
import { PublicKey } from '@solana/web3.js';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { AddressBadge } from '@/components/AddressBadge';
import { Avatar, ChainIcon, SolIcon, TokenLogo } from '@/components/brand';
import { Keypad, applyKey } from '@/components/Keypad';
import { TokenPicker } from '@/components/TokenPicker';
import { Button, Card, DetailRow, Divider, Glow, Header, Notice, PressableScale, Pulse, Screen, ZeroFeeBadge } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { confirmUser } from '@/lib/auth';
import { errorMessage, formatFiat, formatRaw, formatSol, formatUnits, parseUnits, shortAddress } from '@/lib/format';
import { SOL_MINT } from '@/lib/jupiter';
import {
  TOKEN_TRANSFER_UNITS,
  explorerTx,
  feeLamports,
  getConnection,
  getPriorityMicroLamports,
  getRecipientAtaRent,
  getRentMin,
  isValidAddress,
  sendSol,
  sendToken,
} from '@/lib/solana';
import { C, F, MONO, NUM, R, T } from '@/theme';

type Quote = { raw: bigint; fee: number; microLamports: number; rent: number; newAccount: boolean };
const EST_SOL_FEE = feeLamports(10_000);
const EST_TOKEN_FEE = feeLamports(10_000, TOKEN_TRANSFER_UNITS);

export default function Send() {
  const w = useWallet();
  const { assets } = usePortfolio();
  const params = useLocalSearchParams<{ asset?: string }>();
  const network = w.prefs.network;
  const currency = w.prefs.currency;
  const conn = getConnection(network);

  const [assetKey, setAssetKey] = useState(params.asset ?? 'SOL');
  const [picker, setPicker] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [isMax, setIsMax] = useState(false);
  const [step, setStep] = useState<'form' | 'review' | 'sending' | 'done'>('form');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const holding = assetKey === 'SOL' ? null : (w.tokens.find((t) => t.mint === assetKey) ?? null);
  const asset = assets.find((a) => a.key === (holding ? holding.mint : 'SOL')) ?? assets[0];
  const decimals = holding ? holding.decimals : 9;
  const symbol = asset.symbol;
  const lamports = w.lamports ?? 0;
  const sendable = holding ? BigInt(holding.raw) : BigInt(Math.max(0, lamports - EST_SOL_FEE));

  const recipient = to.trim();
  const recipientValid = isValidAddress(recipient);
  const toSelf = recipientValid && recipient === w.address;
  const parsed = parseUnits(amount, decimals);
  const overBalance = !isMax && parsed != null && parsed > 0n && parsed > sendable;
  const solShort = holding != null && lamports < EST_TOKEN_FEE;
  const canContinue = recipientValid && !toSelf && parsed != null && parsed > 0n && !overBalance && !solShort;

  const fiatOf = (raw: bigint) => (asset.price != null ? formatFiat(Number(formatUnits(raw, decimals)) * asset.price, currency) : null);
  const solFiat = (l: number) => (w.prices ? formatFiat((l / 1e9) * w.prices.sol[currency], currency) : null);
  const amountText = (raw: bigint) => `${formatRaw(raw, decimals)} ${symbol}`;
  const display = (amount || '0').replace('.', ',');
  const networkName = network === 'devnet' ? 'Solana Devnet' : 'Solana';
  const logo = (size: number) => (holding ? <TokenLogo uri={asset.logo} symbol={symbol} size={size} /> : <SolIcon size={size} />);

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      const toKey = new PublicKey(recipient);
      const [microLamports, freshLamports] = await Promise.all([getPriorityMicroLamports(conn), conn.getBalance(new PublicKey(w.address!))]);
      if (holding) {
        // Token, alıcı cüzdanın standart token hesabına gider; bu hesap yalnızca gerçek cüzdan adresleri için türetilebilir.
        if (!PublicKey.isOnCurve(toKey.toBytes())) {
          throw new Error('Bu bir cüzdan adresi değil (token hesabı ya da program olabilir). Karşı taraftan Solana cüzdan adresini iste.');
        }
        const fee = feeLamports(microLamports, TOKEN_TRANSFER_UNITS);
        const rent = await getRecipientAtaRent(conn, toKey, holding);
        if (fee + rent > freshLamports) throw new Error(`Ağ ücreti için yeterli SOL yok. En az ${formatSol(fee + rent)} SOL gerekli.`);
        const raw = isMax ? BigInt(holding.raw) : parsed!;
        if (raw > BigInt(holding.raw)) throw new Error('Token bakiyesi yetersiz.');
        setQuote({ raw, fee, microLamports, rent, newAccount: rent > 0 });
      } else {
        const [rentMin, recipientBalance] = await Promise.all([getRentMin(conn), conn.getBalance(toKey)]);
        const fee = feeLamports(microLamports);
        const l = isMax ? freshLamports - fee : Number(parsed!);
        if (l <= 0) throw new Error('Ağ ücretini karşılayacak kadar SOL yok.');
        if (l + fee > freshLamports) throw new Error('Bakiye yetersiz (ağ ücreti dahil).');
        const remaining = freshLamports - l - fee;
        if (remaining > 0 && remaining < rentMin) {
          throw new Error(`Solana, hesapta en az ${formatSol(rentMin)} SOL kalmasını ister. Tutarı azalt ya da "Maks" ile tamamını gönder.`);
        }
        const newAccount = recipientBalance === 0;
        if (newAccount && l < rentMin) {
          throw new Error(`Bu adres ilk kez SOL alıyor; Solana kuralı gereği en az ${formatSol(rentMin)} SOL göndermelisin.`);
        }
        setQuote({ raw: BigInt(l), fee, microLamports, rent: 0, newAccount });
      }
      setStep('review');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!quote) return;
    if (!(await confirmUser(`${amountText(quote.raw)} gönderimini onayla`))) return;
    setStep('sending');
    setError(null);
    try {
      const toKey = new PublicKey(recipient);
      const sig = holding
        ? await sendToken(conn, w.getSigner(), toKey, holding, quote.raw, quote.microLamports)
        : await sendSol(conn, w.getSigner(), toKey, Number(quote.raw), quote.microLamports);
      setSignature(sig);
      setStep('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      w.refresh();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(errorMessage(e));
      setStep('review');
    }
  };

  if (step === 'sending' && quote) {
    return (
      <Screen style={st.center}>
        <Pulse>{logo(64)}</Pulse>
        <Text style={[T.title, { marginTop: 16 }]}>Gönderiliyor</Text>
        <Text style={st.centerSub}>
          {amountText(quote.raw)} · {shortAddress(recipient)}
          {'\n'}Ağ onayı genelde birkaç saniye sürer.
        </Text>
      </Screen>
    );
  }

  if (step === 'done' && quote && signature) {
    return (
      <Screen>
        <Glow height={480} opacity={0.12} color={C.up} />
        <View style={[st.center, { flex: 1 }]}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={st.doneCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(180)} style={{ alignItems: 'center', gap: 6, marginTop: 24 }}>
            <Text style={T.title}>Gönderildi</Text>
            <Text style={st.doneAmount}>{amountText(quote.raw)}</Text>
            <Text style={st.centerSub}>{shortAddress(recipient, 6)} adresine ulaştı</Text>
          </Animated.View>
        </View>
        <View style={st.footer}>
          <Button title="İşlemi Solscan'de gör" variant="secondary" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(explorerTx(signature, network))} />
          <Button title="Bitti" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (step === 'review' && quote) {
    const solCost = quote.fee + quote.rent;
    return (
      <Screen>
        <Header title="Onayla" onBack={() => setStep('form')} />
        <ScrollView contentContainerStyle={st.body}>
          <View style={st.reviewHero}>
            {logo(52)}
            <Text style={st.reviewAmount} adjustsFontSizeToFit numberOfLines={1}>
              {amountText(quote.raw)}
            </Text>
            {fiatOf(quote.raw) && <Text style={st.reviewFiat}>≈ {fiatOf(quote.raw)}</Text>}
          </View>

          <Card style={{ gap: 16 }}>
            <DetailRow label="Kime">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Avatar address={recipient} size={20} />
                <AddressBadge address={recipient} plain chars={5} />
              </View>
            </DetailRow>
            <DetailRow label="Ağ">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <ChainIcon chain="solana" size={18} />
                <Text style={st.lineValue}>{networkName}</Text>
              </View>
            </DetailRow>
            <DetailRow label="Ağ ücreti" value={`${formatSol(quote.fee)} SOL`} sub={solFiat(quote.fee) ?? undefined} />
            {quote.rent > 0 && <DetailRow label="Alıcı hesap açılışı" value={`${formatSol(quote.rent)} SOL`} sub="Tek seferlik Solana depozitosu" />}
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
            <Divider />
            {holding ? (
              <DetailRow label="Toplam" value={amountText(quote.raw)} sub={`+ ${formatSol(solCost)} SOL ağ maliyeti`} strong />
            ) : (
              <DetailRow label="Toplam" value={`${formatSol(Number(quote.raw) + quote.fee)} SOL`} sub={solFiat(Number(quote.raw) + quote.fee) ?? undefined} strong />
            )}
          </Card>

          {quote.newAccount && (
            <Notice>{holding ? 'Bu adres bu tokeni ilk kez alıyor.' : 'Bu adres daha önce hiç kullanılmamış.'} Karşı tarafla bir kez daha teyit et; gönderilen geri alınamaz.</Notice>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </ScrollView>
        <View style={st.footer}>
          <View style={st.trust}>
            <Ionicons name="shield-checkmark" size={13} color={C.muted} />
            <Text style={st.trustText}>Sat hiçbir işlemden komisyon almaz</Text>
          </View>
          <Button title="Onayla ve gönder" icon="finger-print" onPress={confirm} />
        </View>
      </Screen>
    );
  }

  const hint = toSelf
    ? { text: 'Bu senin kendi adresin', color: C.warn }
    : recipient.length > 0 && !recipientValid
      ? { text: 'Geçerli bir Solana adresi değil', color: C.down }
      : solShort
        ? { text: `Token göndermek için ağ ücreti olarak biraz SOL gerekli (~${formatSol(EST_TOKEN_FEE)} SOL)`, color: C.down }
        : overBalance
          ? { text: holding ? 'Token bakiyesi yetersiz' : `Bakiye yetersiz; ağ ücreti için ~${formatSol(EST_SOL_FEE)} SOL ayır`, color: C.down }
          : error
            ? { text: error, color: C.down }
            : null;

  return (
    <Screen>
      <Header title="Gönder" />

      <View style={[st.recipient, recipient.length > 0 && !recipientValid && { borderColor: C.down + '66' }]}>
        <Text style={st.toLabel}>Kime</Text>
        {recipientValid ? (
          <View style={st.recipientChosen}>
            <Avatar address={recipient} size={24} />
            <Text style={st.recipientText} numberOfLines={1}>
              {shortAddress(recipient, 6)}
            </Text>
            <Pressable hitSlop={10} onPress={() => setTo('')} accessibilityLabel="Alıcıyı temizle">
              <Ionicons name="close-circle" size={20} color={C.muted} />
            </Pressable>
          </View>
        ) : (
          <TextInput
            value={to}
            onChangeText={(t) => {
              setTo(t);
              setError(null);
            }}
            placeholder="Solana adresi"
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            style={st.addrInput}
          />
        )}
        {!recipientValid && (
          <PressableScale
            onPress={async () => {
              const clip = (await Clipboard.getStringAsync()).trim();
              if (clip) setTo(clip);
            }}
            style={st.pasteChip}>
            <Text style={st.pasteText}>Yapıştır</Text>
          </PressableScale>
        )}
      </View>

      <View style={st.amountArea}>
        <PressableScale onPress={() => setPicker(true)} scaleTo={0.96} accessibilityLabel="Varlık seç" style={st.assetPill}>
          {logo(22)}
          <Text style={st.assetText}>{symbol}</Text>
          <Text style={st.assetBalance}>Bakiye {asset.amount != null ? formatRaw(holding ? BigInt(holding.raw) : BigInt(lamports), decimals) : '…'}</Text>
          <Ionicons name="chevron-down" size={14} color={C.muted} />
        </PressableScale>
        <View style={st.amountRow}>
          <Text
            style={[st.amount, !amount && { color: C.faint }, overBalance && { color: C.down }, display.length > 9 && { fontSize: 42 }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {display}
          </Text>
          <Text style={st.amountUnit} numberOfLines={1}>
            {symbol}
          </Text>
        </View>
        <Text style={st.fiat}>{parsed && fiatOf(parsed) ? `≈ ${fiatOf(parsed)}` : ' '}</Text>
        <PressableScale
          onPress={() => {
            setAmount(formatUnits(sendable, decimals));
            setIsMax(true);
            setError(null);
          }}
          style={[st.maxChip, isMax && st.maxChipOn]}>
          <Text style={[st.maxText, isMax && { color: C.accent }]}>Maks</Text>
        </PressableScale>
        <Text style={[st.hint, { color: hint?.color ?? 'transparent' }]} numberOfLines={2}>
          {hint?.text ?? ' '}
        </Text>
      </View>

      <Keypad
        onKey={(k) => {
          setAmount((cur) => applyKey(cur, k, decimals));
          setIsMax(false);
          setError(null);
        }}
      />

      <View style={st.footer}>
        <Button title="Devam" disabled={!canContinue} loading={busy} onPress={review} />
      </View>

      <TokenPicker
        visible={picker}
        onClose={() => setPicker(false)}
        title="Ne göndereceksin?"
        mode="owned"
        info={{}}
        onPick={(mint) => {
          setAssetKey(mint === SOL_MINT ? 'SOL' : mint);
          setAmount('');
          setIsMax(false);
          setError(null);
        }}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  centerSub: { color: C.muted, fontSize: 14.5, lineHeight: 21, fontFamily: F.regular, textAlign: 'center', marginTop: 6, ...NUM },
  footer: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  recipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 4,
    paddingLeft: 16,
    paddingRight: 7,
    height: 56,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  toLabel: { color: C.muted, fontSize: 14.5, fontFamily: F.medium },
  addrInput: { flex: 1, color: C.text, fontSize: 14.5, fontFamily: MONO, height: '100%' },
  recipientChosen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 10 },
  recipientText: { flex: 1, color: C.text, fontSize: 15, fontFamily: F.semibold },
  pasteChip: { paddingHorizontal: 12, height: 40, borderRadius: 11, backgroundColor: C.surface3, justifyContent: 'center' },
  pasteText: { color: C.text, fontFamily: F.semibold, fontSize: 13.5 },
  amountArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  assetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingLeft: 7,
    paddingRight: 11,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    marginBottom: 14,
  },
  assetText: { color: C.text, fontSize: 13.5, fontFamily: F.semibold },
  assetBalance: { color: C.muted, fontSize: 13, fontFamily: F.regular, ...NUM },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, maxWidth: '100%' },
  amount: { color: C.text, fontSize: 60, fontFamily: F.semibold, letterSpacing: -2.4, flexShrink: 1, ...NUM },
  amountUnit: { color: C.muted, fontSize: 22, fontFamily: F.semibold, maxWidth: 110 },
  fiat: { color: C.muted, fontSize: 15, fontFamily: F.medium, marginTop: 4, ...NUM },
  maxChip: { marginTop: 14, paddingHorizontal: 14, height: 30, justifyContent: 'center', borderRadius: 15, backgroundColor: C.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  maxChipOn: { backgroundColor: C.accentSoft, borderColor: C.accent + '55' },
  maxText: { color: C.sub, fontFamily: F.semibold, fontSize: 13 },
  hint: { fontSize: 13, fontFamily: F.medium, textAlign: 'center', marginTop: 12, minHeight: 18 },
  reviewHero: { alignItems: 'center', paddingTop: 12, paddingBottom: 18, gap: 8 },
  reviewAmount: { color: C.text, fontSize: 36, fontFamily: F.bold, letterSpacing: -1.3, marginTop: 8, ...NUM },
  reviewFiat: { color: C.muted, fontSize: 15, fontFamily: F.medium, ...NUM },
  lineLabel: { color: C.muted, fontSize: 14.5, fontFamily: F.regular },
  lineValue: { color: C.text, fontSize: 14.5, fontFamily: F.semibold },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  trustText: { color: C.muted, fontSize: 12.5, fontFamily: F.medium },
  doneCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.up, alignItems: 'center', justifyContent: 'center' },
  doneAmount: { color: C.text, fontSize: 18, fontFamily: F.semibold, ...NUM },
});
