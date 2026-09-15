import { Platform, type TextStyle } from 'react-native';

// Nötr koyu zemin + tek vurgu (elektrik indigo). Vurgu yalnızca birincil düğme ve aktif göstergelerde.
export const C = {
  bg: '#09090B',
  surface: '#121215',
  surface2: '#18181B',
  surface3: '#222226',
  glass: 'rgba(18,18,21,0.62)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  line: 'rgba(255,255,255,0.06)',
  text: '#FAFAFA',
  sub: '#A1A1AA',
  muted: '#71717A',
  faint: '#52525B',
  accent: '#7C6CFF',
  accentPressed: '#6A59F2',
  accentSoft: 'rgba(124,108,255,0.14)',
  onAccent: '#FFFFFF',
  up: '#10B981',
  upSoft: 'rgba(16,185,129,0.12)',
  down: '#F43F5E',
  downSoft: 'rgba(244,63,94,0.12)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245,158,11,0.12)',
} as const;

// Özel fontta kalınlık fontWeight ile değil ayrı aile adıyla seçilir (Android sahte kalınlık üretmez).
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

export const R = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, pill: 999 } as const;

/** Rakamlar sabit genişlikte; canlı güncellemede sayı zıplamaz. Her tutar/yüzde metnine eklenir. */
export const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

export const T = {
  display: { color: C.text, fontFamily: F.bold, fontSize: 46, letterSpacing: -1.8, ...NUM },
  title: { color: C.text, fontFamily: F.bold, fontSize: 26, letterSpacing: -0.7 },
  heading: { color: C.text, fontFamily: F.semibold, fontSize: 17, letterSpacing: -0.2 },
  body: { color: C.text, fontFamily: F.medium, fontSize: 15 },
  bodySub: { color: C.sub, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  caption: { color: C.muted, fontFamily: F.regular, fontSize: 13 },
  micro: { color: C.muted, fontFamily: F.medium, fontSize: 12, letterSpacing: 0.2 },
} satisfies Record<string, TextStyle>;

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
