import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Dimensions, Linking, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton, PressableScale, Screen } from '@/components/ui';
import { emitScan } from '@/lib/scanBridge';
import { isValidAddress } from '@/lib/solana';
import { C, F } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME = Math.min(SCREEN_W * 0.68, 280);

/** "solana:<adres>?..." (Solana Pay) ve düz adresi aynı şekilde çözer. */
function extractAddress(raw: string): string | null {
  const value = raw.trim();
  const withoutScheme = value.replace(/^solana:/i, '');
  const address = withoutScheme.split('?')[0].trim();
  return isValidAddress(address) ? address : null;
}

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const scanned = useRef(false);

  const onBarcode = useCallback((result: BarcodeScanningResult) => {
    if (scanned.current) return;
    const address = extractAddress(result.data);
    if (!address) {
      setError('Bu bir Solana adresi QR kodu değil');
      return;
    }
    scanned.current = true;
    emitScan(address);
    router.back();
  }, []);

  const pasteFromClipboard = async () => {
    const clip = (await Clipboard.getStringAsync()).trim();
    const address = extractAddress(clip);
    if (!address) {
      setError('Panoda geçerli bir Solana adresi yok');
      return;
    }
    scanned.current = true;
    emitScan(address);
    router.back();
  };

  if (!permission) return <Screen style={st.center} />;

  if (!permission.granted) {
    return (
      <Screen style={st.center}>
        <View style={st.permIcon}>
          <Ionicons name="camera-outline" size={28} color={C.sub} />
        </View>
        <Text style={st.permTitle}>Kamera izni gerekli</Text>
        <Text style={st.permSub}>Adres QR kodunu taramak için kameraya erişim izni ver.</Text>
        <Button
          title={permission.canAskAgain ? 'İzin ver' : 'Ayarları aç'}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          style={{ marginTop: 20 }}
        />
        <PressableScale onPress={() => router.back()} style={{ marginTop: 16, padding: 8 }}>
          <Text style={st.cancel}>Vazgeç</Text>
        </PressableScale>
      </Screen>
    );
  }

  return (
    <View style={st.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcode}
      />

      {/* Kare deliğe sahip koyu maske: üst/alt/sol/sağ 4 panel */}
      <View pointerEvents="none" style={st.mask}>
        <View style={[st.maskPanel, { height: `50%`, marginBottom: FRAME }]} />
        <View style={{ flexDirection: 'row' }}>
          <View style={[st.maskSide, { width: `50%`, marginRight: FRAME }]} />
          <View style={[st.frame, { width: FRAME, height: FRAME }]} />
          <View style={[st.maskSide, { width: `50%`, marginLeft: FRAME }]} />
        </View>
        <View style={[st.maskPanel, { flex: 1, marginTop: FRAME }]} />
      </View>

      <View style={st.top}>
        <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Kapat" />
      </View>

      <View style={st.bottom}>
        <Text style={st.hint}>{error ?? 'Karşı tarafın adres QR kodunu çerçeveye getir'}</Text>
        <PressableScale onPress={pasteFromClipboard} style={st.pasteChip}>
          <Ionicons name="clipboard-outline" size={15} color={C.text} />
          <Text style={st.pasteText}>Panodan yapıştır</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  permIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  permTitle: { color: C.text, fontSize: 18, fontFamily: F.semibold, marginBottom: 6 },
  permSub: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.regular, textAlign: 'center' },
  cancel: { color: C.muted, fontSize: 14.5, fontFamily: F.semibold },
  mask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  maskPanel: { backgroundColor: 'rgba(0,0,0,0.62)' },
  maskSide: { backgroundColor: 'rgba(0,0,0,0.62)' },
  frame: { borderWidth: 2.5, borderColor: C.accent, borderRadius: 24 },
  top: { position: 'absolute', top: 56, left: 16 },
  bottom: { position: 'absolute', bottom: 64, left: 0, right: 0, alignItems: 'center', gap: 16, paddingHorizontal: 36 },
  hint: { color: '#fff', fontSize: 14.5, fontFamily: F.medium, textAlign: 'center', lineHeight: 20 },
  pasteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pasteText: { color: '#fff', fontSize: 13.5, fontFamily: F.semibold },
});
