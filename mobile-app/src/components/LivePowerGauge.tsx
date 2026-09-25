import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const GAUGE_SIZE = 238;
const GAUGE_CENTER = GAUGE_SIZE / 2;
const ARC_START_DEG = 150;
const ARC_SWEEP_DEG = 240;
const SEGMENT_COUNT = 33;

type LivePowerGaugeProps = {
  powerW?: number;
  maxPowerKw?: number;
  active: boolean;
  phaseLabel: string;
  currentLimitA: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function LivePowerGauge({
  powerW,
  maxPowerKw = 11,
  active,
  phaseLabel,
  currentLimitA,
}: LivePowerGaugeProps) {
  const powerKw = powerW === undefined || !Number.isFinite(powerW) ? undefined : powerW / 1000;
  const ratio = powerKw === undefined || maxPowerKw <= 0 ? 0 : clamp(powerKw / maxPowerKw, 0, 1);
  const needleProgress = useRef(new Animated.Value(0)).current;
  const livePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(needleProgress, {
      toValue: ratio,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [needleProgress, ratio]);

  useEffect(() => {
    if (!active) {
      livePulse.stopAnimation();
      livePulse.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, livePulse]);

  const needleRotation = needleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${ARC_START_DEG}deg`, `${ARC_START_DEG + ARC_SWEEP_DEG}deg`],
  });
  const pulseScale = livePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] });
  const pulseOpacity = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.04] });

  const segments = useMemo(() => Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const segmentRatio = index / (SEGMENT_COUNT - 1);
    const isLit = active && segmentRatio <= ratio;
    const activeColor = segmentRatio > 0.82 ? '#FBBF24' : segmentRatio > 0.68 ? '#84CC16' : '#10B981';

    return {
      angle: ARC_START_DEG + segmentRatio * ARC_SWEEP_DEG,
      color: isLit ? activeColor : '#DCE5EE',
      opacity: isLit ? 1 : 0.8,
    };
  }), [active, ratio]);

  return (
    <View
      style={[styles.gauge, !active && styles.gaugeIdle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Live charging power"
      accessibilityValue={{
        min: 0,
        max: maxPowerKw,
        now: powerKw === undefined ? undefined : Number(powerKw.toFixed(2)),
        text: powerKw === undefined ? 'Power not reported' : `${powerKw.toFixed(2)} kilowatts`,
      }}
    >
      {segments.map((segment, index) => (
        <View
          key={index}
          style={[
            styles.segmentAnchor,
            // Segment starts above the pivot; add 90° to align it with the
            // needle, whose unrotated position points to the right.
            { transform: [{ rotate: `${segment.angle + 90}deg` }] },
          ]}
        >
          <View style={[styles.segment, { backgroundColor: segment.color, opacity: segment.opacity }]} />
        </View>
      ))}

      <Text style={styles.minLabel}>0</Text>
      <Text style={styles.maxLabel}>{maxPowerKw.toFixed(0)}</Text>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.needleLayer,
          { transform: [{ rotate: needleRotation }] },
        ]}
      >
        <View style={[styles.needle, !active && styles.needleIdle]} />
        <View style={[styles.needleTip, !active && styles.needleTipIdle]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hubPulse,
          {
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <View style={[styles.hub, !active && styles.hubIdle]} />

      <Text style={styles.bolt} pointerEvents="none">⚡</Text>

      <View style={styles.readout} pointerEvents="none">
        <Text style={[styles.value, !active && styles.valueIdle]}>
          {powerKw === undefined ? '—' : powerKw.toFixed(2)} <Text style={styles.unit}>kW</Text>
        </Text>
        <Text style={[styles.label, !active && styles.labelIdle]}>
          {active ? 'Live charging power' : 'Latest power reading'}
        </Text>
        <View style={[styles.phaseBadge, !active && styles.phaseBadgeIdle]}>
          <Text style={[styles.phaseBadgeText, !active && styles.phaseBadgeTextIdle]}>{phaseLabel}</Text>
        </View>
        <Text style={styles.limit}>{currentLimitA} A limit</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gauge: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
    borderRadius: GAUGE_CENTER,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
  },
  gaugeIdle: {
    backgroundColor: '#F8FAFC',
    borderColor: '#D7E0EA',
    shadowColor: '#64748B',
    shadowOpacity: 0.1,
  },
  segmentAnchor: {
    position: 'absolute',
    width: 4,
    height: 204,
    left: GAUGE_CENTER - 2,
    top: 17,
  },
  segment: {
    width: 4,
    height: 14,
    borderRadius: 3,
  },
  minLabel: {
    position: 'absolute',
    left: 30,
    bottom: 48,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  maxLabel: {
    position: 'absolute',
    right: 27,
    bottom: 48,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  needleLayer: {
    position: 'absolute',
    width: 162,
    height: 162,
    left: (GAUGE_SIZE - 162) / 2,
    top: (GAUGE_SIZE - 162) / 2,
  },
  needle: {
    position: 'absolute',
    left: 81,
    top: 78.5,
    width: 69,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#047857',
  },
  needleIdle: { backgroundColor: '#94A3B8' },
  needleTip: {
    position: 'absolute',
    left: 143,
    top: 74.5,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  needleTipIdle: { backgroundColor: '#F8FAFC', borderColor: '#94A3B8' },
  hubPulse: {
    position: 'absolute',
    width: 35,
    height: 35,
    left: GAUGE_CENTER - 17.5,
    top: GAUGE_CENTER - 17.5,
    borderRadius: 18,
    backgroundColor: '#10B981',
  },
  hub: {
    position: 'absolute',
    width: 17,
    height: 17,
    left: GAUGE_CENTER - 8.5,
    top: GAUGE_CENTER - 8.5,
    borderRadius: 9,
    backgroundColor: '#A7F3D0',
    borderWidth: 4,
    borderColor: '#047857',
  },
  hubIdle: { backgroundColor: '#E2E8F0', borderColor: '#64748B' },
  readout: {
    position: 'absolute',
    left: 25,
    right: 25,
    top: 128,
    alignItems: 'center',
  },
  bolt: { position: 'absolute', top: 37, fontSize: 23 },
  value: {
    color: '#064E3B',
    fontSize: 34,
    lineHeight: 37,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  valueIdle: { color: '#475569' },
  unit: { fontSize: 17, fontWeight: '800' },
  label: {
    color: '#047857',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  labelIdle: { color: '#64748B' },
  phaseBadge: {
    marginTop: 5,
    paddingHorizontal: 11,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  phaseBadgeIdle: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
  phaseBadgeText: { color: '#059669', fontSize: 11, fontWeight: '800' },
  phaseBadgeTextIdle: { color: '#64748B' },
  limit: { marginTop: 3, color: '#64748B', fontSize: 9, fontWeight: '600' },
});
