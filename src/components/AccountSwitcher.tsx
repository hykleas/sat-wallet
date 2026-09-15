import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/brand';
import { Sheet } from '@/components/Sheet';
import { IconButton, PressableScale, tap } from '@/components/ui';
import { useWallet } from '@/context/WalletContext';
import { shortAddress } from '@/lib/format';
import { C, F } from '@/theme';

/** Hesap listesi + değiştirme + yeni hesap ekleme + yeniden adlandırma. */
export function AccountSwitcher({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const w = useWallet();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const startEdit = (index: number, label: string) => {
    setEditing(index);
    setDraft(label);
  };

  const commitEdit = () => {
    if (editing != null) w.renameAccount(editing, draft);
    setEditing(null);
  };

  const add = async () => {
    setAdding(true);
    try {
      // Yeni hesabın adresini türetmek PBKDF2 gerektirmez (seed zaten bellekte) ama
      // bir kare beklemek elle eklerken ani donmuş hissi engeller.
      await new Promise((r) => setTimeout(r, 16));
      w.addAccount();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Hesaplar">
      <View style={{ gap: 6, paddingBottom: 6 }}>
        {w.accounts.map((a) => {
          const addr = a.index === w.activeAccount ? w.address : w.addressForAccount(a.index);
          const active = a.index === w.activeAccount;
          const isEditing = editing === a.index;
          return (
            <View key={a.index} style={[st.row, active && st.rowActive]}>
              <Avatar address={addr ?? String(a.index)} size={38} />
              <Pressable
                style={{ flex: 1 }}
                disabled={isEditing}
                onPress={() => {
                  if (!active) {
                    tap();
                    w.switchAccount(a.index);
                  }
                  onClose();
                }}>
                {isEditing ? (
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    onSubmitEditing={commitEdit}
                    onBlur={commitEdit}
                    style={st.input}
                    placeholderTextColor={C.faint}
                  />
                ) : (
                  <>
                    <Text style={st.label} numberOfLines={1}>
                      {a.label}
                    </Text>
                    <Text style={st.addr}>{addr ? shortAddress(addr, 5) : '…'}</Text>
                  </>
                )}
              </Pressable>
              {active && !isEditing && <Ionicons name="checkmark-circle" size={20} color={C.accent} />}
              {isEditing ? (
                <IconButton icon="checkmark" size={32} onPress={commitEdit} accessibilityLabel="Kaydet" />
              ) : (
                <IconButton icon="pencil-outline" size={32} color={C.muted} onPress={() => startEdit(a.index, a.label)} accessibilityLabel="Adını değiştir" />
              )}
            </View>
          );
        })}

        <PressableScale onPress={add} disabled={adding} style={st.addRow}>
          <View style={st.addIcon}>
            <Ionicons name="add" size={18} color={C.accent} />
          </View>
          <Text style={st.addText}>{adding ? 'Ekleniyor…' : 'Yeni hesap ekle'}</Text>
        </PressableScale>
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    height: 62,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  rowActive: { backgroundColor: C.surface2, borderColor: C.border },
  label: { color: C.text, fontSize: 15, fontFamily: F.semibold },
  addr: { color: C.muted, fontSize: 12.5, fontFamily: F.regular, marginTop: 1 },
  input: { color: C.text, fontSize: 15, fontFamily: F.semibold, padding: 0, height: 20 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, height: 56, marginTop: 4 },
  addIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  addText: { color: C.accent, fontSize: 15, fontFamily: F.semibold },
});
