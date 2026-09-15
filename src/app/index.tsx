import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useWallet } from '@/context/WalletContext';
import { C } from '@/theme';

export default function Gate() {
  const { status } = useWallet();
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (status === 'empty') return <Redirect href="/welcome" />;
  return <Redirect href="/home" />;
}
