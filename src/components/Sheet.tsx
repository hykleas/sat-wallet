import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui';
import { C, F } from '@/theme';

/** Alttan açılan modal panel. Arka plana dokununca ya da geri tuşuyla kapanır. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.root}>
        <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
        <Animated.View entering={SlideInDown.springify().damping(22).stiffness(240)} style={[st.sheet, { paddingBottom: insets.bottom + 18, maxHeight: '90%' }]}>
          <View style={st.handle} />
          {title && (
            <View style={st.head}>
              <Text style={st.title}>{title}</Text>
              <IconButton icon="close" size={32} onPress={onClose} color={C.sub} accessibilityLabel="Kapat" />
            </View>
          )}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.surface3, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { color: C.text, fontSize: 18, fontFamily: F.semibold, letterSpacing: -0.3 },
});
