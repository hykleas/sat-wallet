import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';

const HARDENED_OFFSET = 0x80000000;
const ED25519_CURVE_KEY = new TextEncoder().encode('ed25519 seed');

/**
 * SLIP-0010 ed25519 anahtar türetimi. ed25519'da yalnızca sertleştirilmiş (hardened)
 * indeksler vardır; `path` elemanları ofsetsiz verilir (44 → 44').
 */
export function deriveEd25519(seed: Uint8Array, path: readonly number[]): Uint8Array {
  let I = hmac(sha512, ED25519_CURVE_KEY, seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);

  for (const index of path) {
    const i = (index + HARDENED_OFFSET) >>> 0;
    const data = new Uint8Array(37);
    data.set(key, 1);
    data[33] = i >>> 24;
    data[34] = (i >>> 16) & 0xff;
    data[35] = (i >>> 8) & 0xff;
    data[36] = i & 0xff;
    I = hmac(sha512, chainCode, data);
    key = I.slice(0, 32);
    chainCode = I.slice(32);
  }
  return key;
}
