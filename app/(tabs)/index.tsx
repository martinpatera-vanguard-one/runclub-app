import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useState } from 'react'
import { COLORS } from '../../constants/theme'

const FILTERS = ['Dnes', 'Zítra', 'Tento týden']

const RUNS = [
  {
    id: 1,
    name: 'Letňáci',
    time: '18:30',
    people: 12,
    lat: 50.1020,
    lng: 14.4095,
    highlight: true,
    emoji: '🏃',
    place: 'Letná park',
    label: 'Letňáci Run',
    dayLabel: 'Dnes',
  },
  {
    id: 2,
    name: 'Park Runners',
    time: '19:00',
    people: 7,
    lat: 50.0978,
    lng: 14.4285,
    highlight: false,
    emoji: '🌅',
    place: 'Stromovka vstup',
    label: 'Park Runners',
    dayLabel: 'Zítra',
  },
  {
    id: 3,
    name: 'Žižkov Gang',
    time: '7:00',
    people: 5,
    lat: 50.0862,
    lng: 14.4520,
    highlight: false,
    emoji: '🌿',
    place: 'Vítkov',
    label: 'Žižkov Gang',
    dayLabel: 'Zítra',
  },
]

export default function MapaScreen() {
  const [activeFilter, setActiveFilter] = useState('Dnes')

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 50.0940,
          longitude: 14.4295,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {RUNS.map((run) => (
          <Marker
            key={run.id}
            coordinate={{ latitude: run.lat, longitude: run.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinContainer}>
              <View style={[styles.pinBubble, run.highlight && styles.pinBubbleHighlight]}>
                <Text style={[styles.pinName, run.highlight && styles.pinTextHighlight]}>
                  {run.name}
                </Text>
                <Text style={[styles.pinMeta, run.highlight && styles.pinTextHighlight]}>
                  {run.time} · {run.people} lidí
                </Text>
              </View>
              <View style={[styles.pinTail, run.highlight && styles.pinTailHighlight]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <View style={styles.header}>
          <Text style={styles.mapTitle}>Dnes běžíme 🏃</Text>
          <Text style={styles.mapSubtitle}>Praha · 3 běhy ve tvém okolí</Text>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetLabel}>Blízko tebe</Text>

        {RUNS.map((run, i) => (
          <View key={run.id} style={[styles.runCard, i < RUNS.length - 1 && styles.runCardBorder]}>
            <View style={styles.runDot}>
              <Text style={styles.runEmoji}>{run.emoji}</Text>
            </View>
            <View style={styles.runInfo}>
              <Text style={styles.runName}>{run.label}</Text>
              <Text style={styles.runTime}>
                {run.dayLabel} {run.time} · {run.place}
              </Text>
            </View>
            <Text style={styles.runCount}>{run.people}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  map: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(245,243,240,0.95)',
  },
  mapTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  mapSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  filterTextActive: {
    color: '#FFF',
  },
  pinContainer: {
    alignItems: 'center',
  },
  pinBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 90,
  },
  pinBubbleHighlight: {
    backgroundColor: COLORS.accent,
  },
  pinName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  pinMeta: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 1,
  },
  pinTextHighlight: {
    color: '#FFF',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.surface,
    marginTop: -1,
  },
  pinTailHighlight: {
    borderTopColor: COLORS.accent,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  runCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  runCardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  runDot: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runEmoji: {
    fontSize: 16,
  },
  runInfo: {
    flex: 1,
  },
  runName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  runTime: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  runCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
})
