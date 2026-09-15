import Ionicons from '@expo/vector-icons/Ionicons';
import { PublicKey } from '@solana/web3.js';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionBar } from '@/components/ActionBar';
import { ActivityFeed } from '@/components/ActivityFeed';
import { AddressBadge } from '@/components/AddressBadge';
import { Avatar, TokenLogo } from '@/components/brand';
import { NetworkSwitcher } from '@/components/NetworkSwitcher';
import { NftGrid } from '@/components/NftGrid';
import { Sheet } from '@/components/Sheet';
import { TAB_BAR_HEIGHT, TabBar, type TabItem } from '@/components/TabBar';
import { TokenCard } from '@/components/TokenCard';
import { Badge, Button, Card, Glow, IconButton, PressableScale, Screen, SectionHeader, Skeleton, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { usePortfolio } from '@/hooks/usePortfolio';
import { errorMessage, formatFiat, formatPercent, splitDecimal } from '@/lib/format';
import { SOL_MINT } from '@/lib/jupiter';
import { getConnection, requestDevnetAirdrop } from '@/lib/solana';
import { C, F, NUM, T } from '@/theme';

type Tab = 'tokens' | 'nfts' | 'activity';

const TABS: TabItem<Tab>[] = [
  { value: 'tokens', label: 'Tokenler', icon: 'wallet-outline', iconActive: 'wallet' },
  { value: 'nfts', label: 'Koleksiyon', icon: 'images-outline', iconActive: 'images' },
  { value: 'activity', label: 'Aktivite', icon: 'time-outline', iconActive: 'time' },
];

export default function Home() {
  const w = useWallet();
  const { prefs, address } = w;
  const portfolio = usePortfolio();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('tokens');
  const [sheet, setSheet] = useState<'buy' | null>(null);
  const [airdropping, setAirdropping] = useState(false);

  if (!address) return <Screen />;

  const hide = prefs.hideBalance;
  const devnet = prefs.network === 'devnet';
  const stable = w.tokens.find((t) => t.meta.stable && t.amount > 0);
  const { total, changeValue, changePct } = portfolio;
  const [main, dec] = total == null ? ['', ''] : splitDecimal(formatFiat(total, prefs.currency));
  const flat = Math.abs(changePct) < 0.005;
  const up = changePct >= 0;

  const openFaucet = async () => {
    await Clipboard.setStringAsync(address);
    WebBrowser.openBrowserAsync('https://faucet.solana.com');
  };

  const airdrop = async () => {
    setAirdropping(true);
    try {
      await requestDevnetAirdrop(getConnection('devnet'), new PublicKey(address));
      await w.refresh();
    } catch (e) {
      // Public devnet musluğu sık sık tamamen kurur ve herkese 429 döner — uygulama hatası değil.
      const dry = /429|airdrop limit|run dry/i.test(e instanceof Error ? e.message : String(e));
      Alert.alert(
        dry ? 'Otomatik musluk şu an boş' : 'Test SOL alınamadı',
        dry
          ? "Solana'nın ücretsiz devnet musluğu günlük limitine ulaştı (herkes için, uygulamayla ilgili değil).\n\n\"Web musluğu\"na bas: adresin kopyalanır, açılan sayfaya yapıştırıp test SOL iste."
          : errorMessage(e),
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Web musluğu', onPress: openFaucet },
        ],
      );
    } finally {
      setAirdropping(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <Glow height={420} opacity={0.11} />

      {/* Üst çubuk: kimlik + ağ + ayarlar */}
      <View style={st.top}>
        <View style={st.identity}>
          <PressableScale onPress={() => router.push('/settings')} scaleTo={0.92} accessibilityLabel="Hesap ayarları">
            <Avatar address={address} size={36} />
          </PressableScale>
          <View style={{ gap: 1 }}>
            <Text style={st.accountName}>Hesap 1</Text>
            <AddressBadge address={address} plain />
          </View>
        </View>
        <View style={st.topRight}>
          <NetworkSwitcher network={prefs.network} onChange={(network) => w.updatePrefs({ network })} />
          <IconButton icon="settings-outline" onPress={() => router.push('/settings')} accessibilityLabel="Ayarlar" />
        </View>
      </View>

      <ScrollView
        key={tab}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={w.refreshing && w.lamports != null}
            onRefresh={w.refresh}
            tintColor={C.sub}
            colors={[C.accent]}
            progressBackgroundColor={C.surface2}
          />
        }>
        {w.error && (
          <Pressable onPress={w.refresh} style={st.errorRow}>
            <Ionicons name="cloud-offline-outline" size={16} color={C.down} />
            <Text style={st.errorText}>Ağa ulaşılamadı</Text>
            <Text style={st.errorRetry}>Tekrar dene</Text>
          </Pressable>
        )}

        {tab === 'tokens' && (
          <>
            {/* Bakiye */}
            <View style={st.balanceWrap}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  tap();
                  w.updatePrefs({ hideBalance: !hide });
                }}
                style={st.balanceLabelRow}
                accessibilityLabel={hide ? 'Bakiyeyi göster' : 'Bakiyeyi gizle'}>
                <Text style={T.micro}>Toplam bakiye</Text>
                <Ionicons name={hide ? 'eye-off-outline' : 'eye-outline'} size={14} color={C.muted} />
              </Pressable>

              {total == null ? (
                <Skeleton width={220} height={46} radius={12} style={{ marginTop: 8, marginBottom: 6 }} />
              ) : (
                <Animated.Text entering={FadeIn.duration(350)} style={[T.display, st.balance]} numberOfLines={1} adjustsFontSizeToFit>
                  {hide ? (
                    '••••••'
                  ) : (
                    <>
                      {main}
                      <Text style={{ color: C.muted }}>{dec}</Text>
                    </>
                  )}
                </Animated.Text>
              )}

              <View style={st.changeRow}>
                {total == null ? (
                  <Skeleton width={120} height={20} radius={7} />
                ) : total > 0 && !hide ? (
                  <>
                    <Badge tone={flat ? 'neutral' : up ? 'up' : 'down'} icon={flat ? undefined : up ? 'arrow-up' : 'arrow-down'}>
                      {formatPercent(changePct).replace(/^[+−]/, '')}
                    </Badge>
                    <Text style={st.changeSub}>
                      {changeValue >= 0 ? '+' : '−'}
                      {formatFiat(Math.abs(changeValue), prefs.currency)} · 24s
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            <ActionBar
              actions={[
                { icon: 'arrow-up', label: 'Gönder', onPress: () => router.push('/send') },
                { icon: 'arrow-down', label: 'Teslim al', onPress: () => router.push('/receive') },
                { icon: 'swap-horizontal', label: 'Takas', onPress: () => router.push('/swap') },
                { icon: 'add', label: 'Satın al', onPress: () => setSheet('buy') },
              ]}
            />

            {devnet && (
              <Card style={st.devnetCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={st.warnDot} />
                    <Text style={st.devnetTitle}>Test ağındasın</Text>
                  </View>
                  <Text style={st.devnetSub}>Buradaki SOL değersiz, yalnızca denemek için.</Text>
                  <Pressable hitSlop={8} onPress={openFaucet} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                    <Text style={st.link}>Web musluğunu aç</Text>
                  </Pressable>
                </View>
                <Button title="1 SOL al" variant="secondary" size="sm" loading={airdropping} onPress={airdrop} />
              </Card>
            )}

            {portfolio.empty && (
              <Card style={st.emptyCard}>
                <Text style={st.emptyTitle}>Cüzdanın hazır</Text>
                <Text style={st.emptySub}>Adresini bir arkadaşına ya da borsaya ver; gelen para birkaç saniyede burada görünür.</Text>
                <Button title="Adresimi göster" size="md" onPress={() => router.push('/receive')} style={{ alignSelf: 'stretch', marginTop: 12 }} />
              </Card>
            )}

            <View style={{ height: 14 }} />
            <SectionHeader title="Varlıklar" />
            {portfolio.assets.map((a) => (
              <TokenCard key={a.key} asset={a} currency={prefs.currency} hidden={hide} />
            ))}
          </>
        )}

        {tab === 'nfts' && (
          <>
            <PageTitle title="Koleksiyon" count={w.nfts?.length} />
            <NftGrid nfts={w.nfts} failed={w.nftsFailed} onRetry={w.refresh} network={prefs.network} />
          </>
        )}

        {tab === 'activity' && (
          <>
            <PageTitle title="Aktivite" />
            <ActivityFeed items={w.activity} failed={w.activityFailed} onRetry={w.refresh} network={prefs.network} hidden={hide} />
          </>
        )}
      </ScrollView>

      <TabBar value={tab} items={TABS} onChange={setTab} />

      <Sheet visible={sheet === 'buy'} onClose={() => setSheet(null)} title="SOL satın al">
        <View style={{ gap: 4 }}>
          {stable && (
            <>
              <PressableScale
                scaleTo={0.98}
                onPress={() => {
                  setSheet(null);
                  router.push({ pathname: '/swap', params: { from: stable.mint, to: SOL_MINT } });
                }}
                style={st.buyOption}>
                <TokenLogo uri={w.markets[stable.mint]?.icon} symbol={stable.meta.symbol} size={38} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={st.stepTitle}>{stable.meta.symbol} ile hemen al</Text>
                  <Text style={T.caption}>{stable.meta.symbol} bakiyeni SOL'e çevir · %0 komisyon</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </PressableScale>
              <Text style={st.buyGroup}>TL ile</Text>
            </>
          )}
          <Step n={1} title="Bir borsadan SOL al" subtitle="BtcTurk, Paribu, Binance TR ya da kullandığın herhangi biri." />
          <Step n={2} title="Çekimde ağ olarak Solana'yı seç" subtitle="Başka bir ağ seçilirse gönderilen para kaybolur." />
          <Step n={3} title="Bu adrese gönder">
            <AddressBadge address={address} avatar chars={6} style={{ marginTop: 8 }} />
          </Step>
          <Text style={st.buyNote}>
            Kartla anında alım sunan aracılar (MoonPay, Transak vb.) %1–5 komisyon keser; bu yüzden Sat'ta yok. TL'yi borsaya havaleyle yatırıp almak en ucuz yol.
          </Text>
          <Button
            title="Adresimi göster"
            icon="qr-code-outline"
            onPress={() => {
              setSheet(null);
              router.push('/receive');
            }}
            style={{ marginTop: 14 }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function PageTitle({ title, count }: { title: string; count?: number }) {
  return (
    <View style={st.pageTitle}>
      <Text style={T.title}>{title}</Text>
      {count != null && count > 0 && <Text style={st.pageCount}>{count}</Text>}
    </View>
  );
}

function Step({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={st.step}>
      <View style={st.stepNum}>
        <Text style={st.stepNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 3, paddingTop: 3 }}>
        <Text style={st.stepTitle}>{title}</Text>
        {subtitle && <Text style={T.caption}>{subtitle}</Text>}
        {children}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  accountName: { color: C.text, fontSize: 14.5, fontFamily: F.semibold },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceWrap: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 26 },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  balance: { marginTop: 6 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 22 },
  changeSub: { color: C.muted, fontSize: 13.5, fontFamily: F.medium, ...NUM },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 14, height: 44, borderRadius: 14, backgroundColor: C.downSoft },
  errorText: { flex: 1, color: C.text, fontSize: 14, fontFamily: F.medium },
  errorRetry: { color: C.down, fontSize: 14, fontFamily: F.semibold },
  devnetCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 16, padding: 16 },
  warnDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.warn },
  devnetTitle: { color: C.text, fontFamily: F.semibold, fontSize: 14.5 },
  devnetSub: { color: C.muted, fontSize: 13, fontFamily: F.regular },
  link: { color: C.accent, fontSize: 13.5, fontFamily: F.semibold },
  emptyCard: { marginHorizontal: 20, marginTop: 16, gap: 4 },
  emptyTitle: { color: C.text, fontSize: 17, fontFamily: F.semibold, letterSpacing: -0.2 },
  emptySub: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.regular },
  pageTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  pageCount: { color: C.muted, fontSize: 17, fontFamily: F.semibold, ...NUM },
  buyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  buyGroup: { color: C.muted, fontSize: 12.5, fontFamily: F.medium, paddingTop: 14, paddingBottom: 2 },
  buyNote: { color: C.muted, fontSize: 12.5, lineHeight: 18, fontFamily: F.regular, marginTop: 6 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: C.text, fontSize: 13, fontFamily: F.semibold, ...NUM },
  stepTitle: { color: C.text, fontSize: 15, fontFamily: F.semibold },
});
