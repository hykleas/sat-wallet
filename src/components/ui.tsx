import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useId, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { C, F, NUM, R } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** SVG gradyan kimliği; aynı anda birden çok ekran çizildiğinde çakışmasın. */
export const useSvgId = () => 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');

export function Screen({ children, edges = ['top', 'bottom'], style }: { children?: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: C.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

/** Ekranın tepesinde çok hafif vurgu ışığı — dikkat çekmeden derinlik verir. */
export function Glow({ height = 360, opacity = 0.1, color = C.accent }: { height?: number; opacity?: number; color?: string }) {
  const id = useSvgId();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="0%" r="75%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Buzlu cam yüzey. Android'de blur hedef görünüm ister; orada neredeyse opak yüzeye düşer. */
export function Glass({ children, style, intensity = 40 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; intensity?: number }) {
  if (Platform.OS === 'android') {
    return <View style={[{ backgroundColor: 'rgba(20,20,23,0.97)', overflow: 'hidden' }, style]}>{children}</View>;
  }
  return (
    <BlurView intensity={intensity} tint="dark" style={[{ backgroundColor: C.glass, overflow: 'hidden' }, style]}>
      {children}
    </BlurView>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

type PressableScaleProps = {
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  scaleTo?: number;
  hitSlop?: number | Insets;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Dokunmada hafif küçülen, fareyle üstüne gelince hafif sönen basılabilir alan. */
export function PressableScale({ children, onPress, onLongPress, disabled, haptic = true, scaleTo = 0.96, hitSlop, style, accessibilityLabel }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }], opacity: dim.get() }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => scale.set(withSpring(scaleTo, SPRING))}
      onPressOut={() => scale.set(withSpring(1, SPRING))}
      onHoverIn={() => dim.set(withTiming(0.86, { duration: 120 }))}
      onHoverOut={() => dim.set(withTiming(1, { duration: 160 }))}
      onLongPress={onLongPress}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      style={[style, animated]}>
      {children}
    </AnimatedPressable>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BUTTON = {
  primary: { bg: C.accent, fg: C.onAccent, border: 'transparent' },
  secondary: { bg: C.surface2, fg: C.text, border: C.border },
  ghost: { bg: 'transparent', fg: C.sub, border: 'transparent' },
  danger: { bg: C.downSoft, fg: C.down, border: 'transparent' },
} as const;

const BUTTON_SIZE = {
  lg: { height: 54, radius: R.md, font: 16, icon: 19 },
  md: { height: 44, radius: 14, font: 15, icon: 17 },
  sm: { height: 34, radius: 11, font: 13.5, icon: 15 },
} as const;

export function Button({ title, onPress, variant = 'primary', size = 'lg', icon, loading, disabled, style }: ButtonProps) {
  const v = BUTTON[variant];
  const z = BUTTON_SIZE[size];
  const fg = disabled ? C.faint : v.fg;
  return (
    <PressableScale
      disabled={disabled || loading}
      onPress={onPress}
      scaleTo={0.97}
      style={[
        s.btn,
        { height: z.height, borderRadius: z.radius, backgroundColor: disabled ? C.surface2 : v.bg, borderColor: disabled ? C.border : v.border },
        style,
      ]}>
      {loading ? (
        <Dots color={fg} />
      ) : (
        <View style={s.btnRow}>
          {icon && <Ionicons name={icon} size={z.icon} color={fg} />}
          <Text style={[s.btnText, { color: fg, fontSize: z.font }]}>{title}</Text>
        </View>
      )}
    </PressableScale>
  );
}

/** Düğme içi yükleniyor göstergesi: üç nokta sırayla nefes alır. */
export function Dots({ color = C.text }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    const t = setTimeout(() => o.set(withRepeat(withTiming(1, { duration: 420 }), -1, true)), delay);
    return () => clearTimeout(t);
  }, [delay, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, a]} />;
}

export function IconButton({
  icon,
  onPress,
  size = 38,
  color = C.text,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      hitSlop={6}
      onPress={onPress}
      scaleTo={0.92}
      accessibilityLabel={accessibilityLabel}
      style={[s.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={icon} size={size * 0.47} color={color} />
    </PressableScale>
  );
}

export function Header({ title, onBack, right, backIcon = 'chevron-back' }: { title?: string; onBack?: () => void; right?: ReactNode; backIcon?: IconName }) {
  return (
    <View style={s.header}>
      <IconButton icon={backIcon} onPress={onBack ?? (() => router.back())} accessibilityLabel="Geri" />
      <Text style={s.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ minWidth: 38, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** İnce kenarlıklı yüzey kartı. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.borderStrong }, style]} />;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) tap();
              onChange(o.value);
            }}
            style={[s.segItem, active && s.segItemActive]}>
            <Text style={[s.segText, active && { color: C.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type Tone = 'neutral' | 'accent' | 'up' | 'down' | 'warn';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: C.surface3, fg: C.sub },
  accent: { bg: C.accentSoft, fg: C.accent },
  up: { bg: C.upSoft, fg: C.up },
  down: { bg: C.downSoft, fg: C.down },
  warn: { bg: C.warnSoft, fg: C.warn },
};

export function Badge({ tone = 'neutral', icon, children, style }: { tone?: Tone; icon?: IconName; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = TONE[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }, style]}>
      {icon && <Ionicons name={icon} size={11} color={t.fg} />}
      <Text style={[s.badgeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/** Platform ücretinin sıfır olduğunu gösteren küçük, güven veren rozet. */
export function ZeroFeeBadge() {
  return (
    <Badge tone="up" icon="checkmark">
      %0
    </Badge>
  );
}

export function Notice({ icon = 'alert-circle', tone = 'warn', children }: { icon?: IconName; tone?: 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const color = tone === 'danger' ? C.down : tone === 'info' ? C.sub : C.warn;
  const bg = tone === 'danger' ? C.downSoft : tone === 'info' ? C.surface : C.warnSoft;
  return (
    <View style={[s.notice, { backgroundColor: bg }, tone === 'info' && { borderColor: C.border, borderWidth: StyleSheet.hairlineWidth }]}>
      <Ionicons name={icon} size={17} color={color} style={{ marginTop: 1.5 }} />
      <Text style={[s.noticeText, { color: tone === 'info' ? C.sub : C.text }]}>{children}</Text>
    </View>
  );
}

/** Yükleniyor iskeleti: yavaşça nefes alan gri blok. */
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.surface3 }, a, style]} />;
}

/** Bölüm başlığı: solda küçük başlık, sağda isteğe bağlı eylem. */
export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon: IconName; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={22} color={C.sub} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      {subtitle && <Text style={s.emptySub}>{subtitle}</Text>}
      {action}
    </View>
  );
}

/** İşlem sürerken içeriğin arkasında genişleyip sönen halka. */
export function Pulse({ children, size = 64, color = C.accent }: { children: ReactNode; size?: number; color?: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.get()), transform: [{ scale: 1 + p.get() * 0.9 }] }));
  return (
    <View style={{ width: size * 1.9, height: size * 1.9, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, ring]} />
      {children}
    </View>
  );
}

/** Onay ekranlarındaki etiket–değer satırı. */
export function DetailRow({
  label,
  value,
  sub,
  strong,
  valueColor,
  children,
}: {
  label: ReactNode;
  value?: string;
  sub?: string;
  strong?: boolean;
  valueColor?: string;
  children?: ReactNode;
}) {
  return (
    <View style={s.detailRow}>
      {typeof label === 'string' ? <Text style={[s.detailLabel, strong && { color: C.text, fontFamily: F.semibold }]}>{label}</Text> : label}
      {children ?? (
        <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 1, marginLeft: 12 }}>
          <Text style={[s.detailValue, strong && { fontFamily: F.bold, fontSize: 16 }, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
            {value}
          </Text>
          {sub && <Text style={s.detailSub}>{sub}</Text>}
        </View>
      )}
    </View>
  );
}

export const s = StyleSheet.create({
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 },
  detailLabel: { color: C.muted, fontSize: 14.5, fontFamily: F.regular },
  detailValue: { color: C.text, fontSize: 14.5, fontFamily: F.semibold, ...NUM },
  detailSub: { color: C.muted, fontSize: 12.5, fontFamily: F.regular, ...NUM },
  btn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: StyleSheet.hairlineWidth },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: F.semibold, letterSpacing: -0.15 },
  iconBtn: { backgroundColor: C.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  headerTitle: { flex: 1, textAlign: 'center', color: C.text, fontSize: 16, fontFamily: F.semibold },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  label: { color: C.muted, fontSize: 12, fontFamily: F.medium, letterSpacing: 0.2, marginBottom: 8 },
  seg: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  segItem: { flex: 1, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segItemActive: { backgroundColor: C.surface3 },
  segText: { color: C.muted, fontSize: 13.5, fontFamily: F.semibold },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, height: 22, borderRadius: 7, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontFamily: F.semibold, ...NUM },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: R.md },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: F.regular },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  sectionTitle: { color: C.sub, fontSize: 13.5, fontFamily: F.semibold },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 6 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontFamily: F.semibold },
  emptySub: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.regular, textAlign: 'center' },
});
