import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

// Kelime ekranlarında ekran görüntüsünü engeller. Web'de API yok (tasarım önizlemesi çökmesin).
export const useNoScreenshots: () => void = Platform.OS === 'web' ? () => {} : () => usePreventScreenCapture();
