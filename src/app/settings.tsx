import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AccountSwitcher } from '@/components/AccountSwitcher';
import { Avatar } from '@/components/brand';
import { SeedGrid } from '@/components/SeedGrid';
import { Header, Notice, PressableScale, Screen, Segmented, tap, type IconName } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { hasDeviceLock } from '@/lib/auth';
import { shortAddress } from '@/lib/format';
import { useNoScreenshots } from '@/lib/noScreenshots';
import { explorerAccount } from '@/lib/solana';
import { C, F } from '@/theme';

export default function Settings() {
  useNoScreenshots();
  const w = useWallet();
  const [seed, setSeed] = useState<string[] | null>(null);
  const [deviceLock, setDeviceLock] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const accountLabel = w.accounts.find((a) => a.index === w.activeAccount)?.label ?? 'Hesap';

  useEffect(() => {
    hasDeviceLock().then(setDeviceLock);
  }, []);

  const reveal = async () => {
    const m = await w.revealMnemonic();
    if (m) setSeed(m.split(' '));
  };

  const reset = () =>
    Alert.alert('Cüzdanı bu telefondan sil?', 'Kurtarma ifaden yazılı değilse paran KALICI olarak kaybolur.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Emin misin?', '12 kelimen elinde mi?', [
            { text: 'Hayır', style: 'cancel' },
            {
              text: 'Evet, sil',
              style: 'destructive',
              onPress: async () => {
                await w.resetWallet();
                if (router.canDismiss()) router.dismissAll();
                router.replace('/welcome');
              },
            },
          ]),
      },
    ]);

  return (
    <Screen>
      <Header title="Ayarlar" />
      <ScrollView contentContainerStyle={st.body}>
        {w.address && (
          <PressableScale onPress={() => setAccountsOpen(true)} style={st.profile} accessibilityLabel="Hesapları yönet">
            <Avatar address={w.address} size={64} />
            <Text style={st.profileName}>{accountLabel}</Text>
            <Text style={st.profileAddr}>{shortAddress(w.address, 6)}</Text>
            {w.accounts.length > 1 && <Text style={st.profileCount}>{w.accounts.length} hesap · değiştirmek için dokun</Text>}
          </PressableScale>
        )}

        <AccountSwitcher visible={accountsOpen} onClose={() => setAccountsOpen(false)} />

        {!deviceLock && (
          <Notice tone="danger">Telefonunda ekran kilidi yok. Sat, gönderimleri Face ID / parmak izi / PIN ile korur — lütfen bir kilit ayarla.</Notice>
        )}

        <Section title="Tercihler">
          <Row icon="globe-outline" title="Ağ">
            <View style={{ width: 168 }}>
              <Segmented
                value={w.prefs.network}
                onChange={(network) => w.updatePrefs({ network })}
                options={[
                  { value: 'mainnet', label: 'Mainnet' },
                  { value: 'devnet', label: 'Devnet' },
                ]}
              />
            </View>
          </Row>
          <Row icon="cash-outline" title="Para birimi">
            <View style={{ width: 112 }}>
              <Segmented
                value={w.prefs.currency}
                onChange={(currency) => w.updatePrefs({ currency })}
                options={[
                  { value: 'USD', label: '$' },
                  { value: 'TRY', label: '₺' },
                ]}
              />
            </View>
          </Row>
          <Row icon="eye-off-outline" title="Bakiyeyi gizle">
            <Switch
              value={w.prefs.hideBalance}
              onValueChange={(hideBalance) => w.updatePrefs({ hideBalance })}
              trackColor={{ true: C.accent, false: C.surface3 }}
              thumbColor="#fff"
            />
          </Row>
        </Section>

        <Section title="Güvenlik">
          {seed ? (
            <View style={{ padding: 10, gap: 12 }}>
              <SeedGrid words={seed} startHidden={false} />
              <Pressable onPress={() => setSeed(null)} style={{ paddingVertical: 8 }}>
                <Text style={st.link}>Gizle</Text>
              </Pressable>
            </View>
          ) : (
            <Row icon="key-outline" title="Kurtarma ifadesini göster" subtitle="Kimlik doğrulaması ister" onPress={reveal} chevron />
          )}
          <Row
            icon="open-outline"
            title="Adresi Solscan'de aç"
            onPress={() => w.address && WebBrowser.openBrowserAsync(explorerAccount(w.address, w.prefs.network))}
            chevron
          />
        </Section>

        <Section>
          <Row icon="trash-outline" title="Cüzdanı bu telefondan sil" danger onPress={reset} />
        </Section>

        <Text style={st.foot}>Sat 1.0 · Anahtarların yalnızca bu cihazda{'\n'}Sunucu yok · Takip yok · Komisyon yok</Text>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title && <Text style={st.sectionTitle}>{title}</Text>}
      <View style={st.section}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  children,
  onPress,
  chevron,
  danger,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  danger?: boolean;
}) {
  const color = danger ? C.down : C.text;
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [st.row, pressed && { backgroundColor: C.surface2 }]}>
      <Ionicons name={icon} size={20} color={danger ? C.down : C.sub} />
      <View style={{ flex: 1 }}>
        <Text style={[st.rowTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={st.rowSub}>{subtitle}</Text>}
      </View>
      {children}
      {chevron && <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, gap: 22, paddingBottom: 48 },
  profile: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  profileName: { color: C.text, fontSize: 20, fontFamily: F.bold, marginTop: 8 },
  profileAddr: { color: C.muted, fontSize: 14, fontFamily: F.medium },
  profileCount: { color: C.faint, fontSize: 12, fontFamily: F.medium, marginTop: 4 },
  sectionTitle: { color: C.muted, fontSize: 13, fontFamily: F.semibold, paddingHorizontal: 8 },
  section: { backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, paddingVertical: 10 },
  rowTitle: { fontSize: 15.5, fontFamily: F.medium },
  rowSub: { color: C.muted, fontSize: 13, fontFamily: F.regular, marginTop: 2 },
  link: { color: C.accent, fontFamily: F.semibold, textAlign: 'center' },
  foot: { color: C.faint, fontSize: 12.5, fontFamily: F.regular, textAlign: 'center', lineHeight: 19 },
});
