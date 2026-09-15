import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

// Web yalnızca geliştirmede tasarım önizlemesi; orada biyometri yok.
const devWeb = Platform.OS === 'web' && __DEV__;

/** Cihazda kilit (PIN/desen/biyometri) yoksa sormadan geçer; varsa Face ID / parmak izi / PIN ister. */
export async function confirmUser(promptMessage: string): Promise<boolean> {
  if (devWeb) return true;
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Vazgeç',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

export async function hasDeviceLock() {
  if (devWeb) return true;
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}
