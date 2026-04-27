import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search } from 'lucide-react-native'
import { useState } from 'react'
import { COLORS } from '../../constants/theme'

const FILTERS = ['Všechny', 'Dnes', 'Blízko']

const EVENTS = [
  {
    id: 1,
    club: 'Letňáci Run Club',
    name: 'Úterní Letná Loop',
    meta: 'Dnes · 18:30 · Hanavský pavilon',
    attendees: ['M', 'K', 'J'],
    extra: 9,
  },
  {
    id: 2,
    club: 'Park Runners',
    name: 'Evening Social Run',
    meta: 'Dnes · 19:00 · Stromovka vstup',
    attendees: ['T', 'L'],
    extra: 5,
  },
]

const CLUBS = [
  { id: 1, emoji: '🏃', name: 'Letňáci', members: 47 },
  { id: 2, emoji: '🌅', name: 'Žižkov Gang', members: 23 },
  { id: 3, emoji: '🌿', name: 'Park Runners', members: 31 },
]

const AVATAR_COLORS = [
  { bg: COLORS.accentSoft, text: COLORS.accent },
  { bg: '#E8F4FF', text: '#3B82F6' },
  { bg: '#F0FFF4', text: '#22C55E' },
]

export default function ExploreScreen() {
  const [activeFilter, setActiveFilter] = useState('Všechny')

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Explore</Text>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.muted} strokeWidth={2} />
            <Text style={styles.searchPlaceholder}>Hledat klub nebo akci…</Text>
          </View>
        </View>

        {/* Filters */}
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

        {/* Event cards */}
        {EVENTS.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventCardTop}>
              <Text style={styles.eventTag}>{event.club}</Text>
              <Text style={styles.eventName}>{event.name}</Text>
              <Text style={styles.eventMeta}>{event.meta}</Text>
            </View>
            <View style={styles.eventCardBottom}>
              <View style={styles.avatars}>
                {event.attendees.map((letter, i) => (
                  <View
                    key={i}
                    style={[
                      styles.avatar,
                      { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length].bg, zIndex: 10 - i },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: AVATAR_COLORS[i % AVATAR_COLORS.length].text }]}>
                      {letter}
                    </Text>
                  </View>
                ))}
                <View style={[styles.avatar, styles.avatarExtra]}>
                  <Text style={styles.avatarExtraText}>+{event.extra}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.joinBtn}>
                <Text style={styles.joinBtnText}>Přidat se</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Popular clubs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Populární kluby</Text>
          </View>
          <View style={styles.clubsRow}>
            {CLUBS.map((club) => (
              <TouchableOpacity key={club.id} style={styles.clubCard}>
                <Text style={styles.clubEmoji}>{club.emoji}</Text>
                <Text style={styles.clubName}>{club.name}</Text>
                <Text style={styles.clubMembers}>{club.members} členů</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: COLORS.muted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.muted,
  },
  filterTextActive: {
    color: '#FFF',
  },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  eventCardTop: {
    padding: 14,
    paddingBottom: 10,
  },
  eventTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.accent,
    marginBottom: 4,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  eventMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
  },
  eventCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
    marginRight: -8,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  avatarExtra: {
    backgroundColor: COLORS.bg,
  },
  avatarExtraText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
  },
  joinBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  clubsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clubCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  clubEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  clubName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  clubMembers: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
})
