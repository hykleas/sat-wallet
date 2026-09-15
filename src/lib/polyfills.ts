// Kök layout'ta EN ÜSTTE import edilmeli: web3.js yüklenmeden önce Buffer ve
// güvenli rastgele sayı üreteci (crypto.getRandomValues) hazır olmalı.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

const g = globalThis as { Buffer?: unknown };
if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}
