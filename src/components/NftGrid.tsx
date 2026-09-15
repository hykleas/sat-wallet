import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, PressableScale, Skeleton } from '@/components/ui';
import type { Nft } from '@/lib/nft';
import { explorerAccount, type Network } from '@/lib/solana';
import { C, F } from '@/theme';

function NftCard({ nft, network }: { nft: Nft; network: Network }) {
  const [failed, setFailed] = useState(false);
  return (
    <PressableScale haptic={false} scaleTo={0.97} onPress={() => WebBrowser.openBrowserAsync(explorerAccount(nft.mint, network))} style={st.cell}>
      <View style={st.media}>
        {nft.image && !failed ? (
          <Image source={{ uri: nft.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} onError={() => setFailed(true)} />
        ) : (
          <Ionicons name="image-outline" size={26} color={C.faint} />
        )}
      </View>
      <Text style={st.name} numberOfLines={1}>
        {nft.name}
      </Text>
      {nft.collection && (
        <Text style={st.collection} numberOfLines={1}>
          {nft.collection}
        </Text>
      )}
    </PressableScale>
  );
}

export function NftGrid({ nfts, failed, onRetry, network }: { nfts: Nft[] | null; failed: boolean; onRetry: () => void; network: Network }) {
  if (failed && !nfts?.length) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Koleksiyon yüklenemedi"
        action={<Button title="Tekrar dene" variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: 10 }} />}
      />
    );
  }
  if (nfts == null) {
    return (
      <View style={st.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={st.cell}>
            <View style={{ aspectRatio: 1 }}>
              <Skeleton width="100%" height="100%" radius={18} />
            </View>
            <Skeleton width="60%" height={13} style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
    );
  }
  if (nfts.length === 0) {
    return <EmptyState icon="images-outline" title="Koleksiyonun boş" subtitle="Bu adrese gelen NFT'ler burada bir galeri olarak görünür." />;
  }
  return (
    <View style={st.grid}>
      {nfts.map((n) => (
        <NftCard key={n.mint} nft={n} network={network} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18, paddingHorizontal: 20, paddingTop: 8 },
  cell: { width: '48%' },
  media: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: C.text, fontSize: 14.5, fontFamily: F.semibold, marginTop: 9 },
  collection: { color: C.muted, fontSize: 12.5, fontFamily: F.regular, marginTop: 2 },
});
