import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search } from 'lucide-react-native'
import { useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const FILTERS = ['Všechny', 'Dnes', 'Blízko']

const AVATAR_COLORS = [
  { bg: COLORS.accentSoft, text: COLORS.accent },
  { bg: '#E8F4FF', text: '#3B82F6' },
  { bg: '#F0FFF4', text: '#22C55E' },
]

type DbEvent = {
  id: string
  name: string
  lat: number | null
  lng: number | null
  address: string | null
  starts_at: string
  clubs: { name: string } | null
  event_participants: { id: string }[]
}

type DbClub = {
  id: string
  name: string
  club_members: { id: string }[]
}

function getDayLabel(startsAt: string) {
  const date = new Date(startsAt)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Dnes'
  if (date.toDateString() === tomorrow.toDateString()) return 'Zítra'
  return date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

function getTimeLabel(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type UserLocation = { lat: number; lng: number }

export default function NajitScreen() {
  const [activeFilter, setActiveFilter] = useState('Všechny')
  const [searchText, setSearchText] = useState('')
  const [events, setEvents] = useState<DbEvent[]>([])
  const [clubs, setClubs] = useState<DbClub[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeFilter === 'Blízko' && !userLocation) {
      ;(async () => {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
        }
      })()
    }
  }, [activeFilter])

  async function fetchData() {
    setLoading(true)
    const [eventsRes, clubsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, lat, lng, address, starts_at, clubs(name), event_participants(id)')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('clubs')
        .select('id, name, club_members(id)')
        .order('name', { ascending: true }),
    ])

    if (eventsRes.error) console.error('[explore] events error:', eventsRes.error.message)
    else setEvents(eventsRes.data as unknown as DbEvent[])

    if (clubsRes.error) console.error('[explore] clubs error:', clubsRes.error.message)
    else setClubs(clubsRes.data as unknown as DbClub[])

    setLoading(false)
  }

  const filteredEvents = useCallback(() => {
    let list = events

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.clubs?.name ?? '').toLowerCase().includes(q) ||
          (e.address ?? '').toLowerCase().includes(q),
      )
    }

    if (activeFilter === 'Dnes') {
      const today = new Date().toDateString()
      list = list.filter((e) => new Date(e.starts_at).toDateString() === today)
    }

    if (activeFilter === 'Blízko' && userLocation) {
      list = list
        .filter((e) => e.lat != null && e.lng != null)
        .sort((a, b) => {
          const dA = haversineKm(userLocation.lat, userLocation.lng, a.lat!, a.lng!)
          const dB = haversineKm(userLocation.lat, userLocation.lng, b.lat!, b.lng!)
          return dA - dB
        })
        .slice(0, 10)
    }

    return list
  }, [events, searchText, activeFilter, userLocation])

  const filteredClubs = useCallback(() => {
    if (!searchText.trim()) return clubs
    const q = searchText.toLowerCase()
    return clubs.filter((c) => c.name.toLowerCase().includes(q))
  }, [clubs, searchText])

  const visibleEvents = filteredEvents()
  const visibleClubs = filteredClubs()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Najít</Text>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.muted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Hledat klub nebo akci…"
              placeholderTextColor={COLORS.muted}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
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

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        ) : (
          <>
            {/* Event cards */}
            {visibleEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Žádné běhy nenalezeny</Text>
              </View>
            ) : (
              visibleEvents.map((event) => {
                const attendees = event.event_participants ?? []
                const extra = Math.max(0, attendees.length - 3)
                const shown = attendees.slice(0, 3)
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventCardTop}>
                      <Text style={styles.eventTag}>{event.clubs?.name ?? 'Neznámý klub'}</Text>
                      <Text style={styles.eventName}>{event.name}</Text>
                      <Text style={styles.eventMeta}>
                        {getDayLabel(event.starts_at)} · {getTimeLabel(event.starts_at)}
                        {event.address ? ` · ${event.address}` : ''}
                      </Text>
                    </View>
                    <View style={styles.eventCardBottom}>
                      <View style={styles.avatars}>
                        {shown.map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.avatar,
                              { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length].bg, zIndex: 10 - i },
                            ]}
                          >
                            <Text style={[styles.avatarText, { color: AVATAR_COLORS[i % AVATAR_COLORS.length].text }]}>
                              {i + 1}
                            </Text>
                          </View>
                        ))}
                        {extra > 0 && (
                          <View style={[styles.avatar, styles.avatarExtra]}>
                            <Text style={styles.avatarExtraText}>+{extra}</Text>
                          </View>
                        )}
                        {attendees.length === 0 && (
                          <Text style={styles.noAttendeesText}>Nikdo zatím</Text>
                        )}
                      </View>
                      <TouchableOpacity style={styles.joinBtn}>
                        <Text style={styles.joinBtnText}>Přidat se</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
            )}

            {/* Popular clubs */}
            {visibleClubs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {searchText.trim() ? 'Kluby' : 'Populární kluby'}
                  </Text>
                </View>
                <View style={styles.clubsRow}>
                  {visibleClubs.slice(0, 3).map((club) => (
                    <TouchableOpacity key={club.id} style={styles.clubCard}>
                      <Text style={styles.clubEmoji}>🏃</Text>
                      <Text style={styles.clubName}>{club.name}</Text>
                      <Text style={styles.clubMembers}>
                        {(club.club_members?.length ?? 0)} členů
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
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
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
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
    alignItems: 'center',
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
    marginRight: 0,
  },
  avatarExtraText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
  },
  noAttendeesText: {
    fontSize: 12,
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
