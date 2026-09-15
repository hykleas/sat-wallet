import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar, ChainIcon } from '@/components/brand';
import { Button, Glow, Header, Notice, Screen, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { C, F, MONO, R } from '@/theme';

export default function Receive() {
  const { address, prefs, accounts, activeAccount } = useWallet();
  const [copied, setCopied] = useState(false);
  if (!address) return <Screen />;
  const accountLabel = accounts.find((a) => a.index === activeAccount)?.label ?? 'Hesap';

  // 4'lü gruplar: karşı tarafla sesli/görsel karşılaştırması kolay olsun.
  const grouped = address.match(/.{1,4}/g)?.join(' ') ?? address;

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Screen>
      <Glow height={420} />
      <Header title="Teslim al" backIcon="close" />
      <View style={st.body}>
        <View style={st.qrCard}>
          <View style={st.qrHead}>
            <Avatar address={address} size={26} />
            <Text style={st.qrName}>{accountLabel}</Text>
            <View style={st.netChip}>
              <ChainIcon chain="solana" size={14} />
              <Text style={st.netText}>{prefs.network === 'devnet' ? 'Devnet' : 'Solana'}</Text>
            </View>
          </View>
          <View style={st.qrBox}>
            <QRCode value={address} size={200} backgroundColor="#FFFFFF" color="#09090B" ecl="M" />
          </View>
          <Text style={st.address} selectable>
            {grouped}
          </Text>
        </View>

        <View style={st.row}>
          <Button title={copied ? 'Kopyalandı' : 'Kopyala'} icon={copied ? 'checkmark' : 'copy-outline'} onPress={copy} style={{ flex: 1 }} />
          <Button title="Paylaş" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: address })} style={{ flex: 1 }} />
        </View>

        <Notice>Yalnızca Solana ağından SOL ve SPL token gönder. Başka ağdan (Ethereum, BSC, Tron…) gelenler kaybolur.</Notice>
        <View style={st.hint}>
          <Ionicons name="shield-checkmark" size={13} color={C.muted} />
          <Text style={st.hintText}>Adresini paylaşmak güvenlidir, kurtarma ifadeni asla.</Text>
        </View>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  qrCard: {
    backgroundColor: C.surface,
    borderRadius: R.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 20,
    alignItems: 'center',
    gap: 20,
  },
  qrHead: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'stretch' },
  qrName: { flex: 1, color: C.text, fontSize: 15, fontFamily: F.semibold },
  netChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, height: 26, borderRadius: 13, backgroundColor: C.surface3 },
  netText: { color: C.sub, fontSize: 12.5, fontFamily: F.semibold },
  qrBox: { backgroundColor: '#fff', padding: 14, borderRadius: 22 },
  address: { color: C.sub, fontSize: 14, lineHeight: 22, fontFamily: MONO, textAlign: 'center', paddingHorizontal: 6, letterSpacing: 0.3 },
  row: { flexDirection: 'row', gap: 10 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 },
  hintText: { color: C.muted, fontSize: 12.5, fontFamily: F.regular },
});
