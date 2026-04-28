import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search } from 'lucide-react-native'
import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect, router } from 'expo-router'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { useEventParticipation } from '../../contexts/eventParticipation'

const EVENT_FILTERS = ['Všechny', 'Dnes', 'Blízko']

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
  distance_km: number | null
  pace_sec_km: number | null
  clubs: { name: string } | null
  event_participants: { id: string }[]
}

type DbClub = {
  id: string
  name: string
  club_members: { id: string }[]
}

type UserLocation = { lat: number; lng: number }

function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${sec.toString().padStart(2, '0')} /km`
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

export default function NajitScreen() {
  const [innerTab, setInnerTab] = useState<'behy' | 'kluby'>('behy')
  const [activeFilter, setActiveFilter] = useState('Všechny')
  const [searchText, setSearchText] = useState('')
  const [events, setEvents] = useState<DbEvent[]>([])
  const [clubs, setClubs] = useState<DbClub[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [myClubIds, setMyClubIds] = useState<Set<string>>(new Set())
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const { myEventIds, join: joinCtx, leave: leaveCtx, pendingOpenId } = useEventParticipation()

  function openOnMap(eventId: string) {
    pendingOpenId.current = eventId
    router.navigate('/' as any)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Refresh členství při každém přepnutí na tento tab
  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return
        const { data } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', user.id)
        if (data) setMyClubIds(new Set(data.map((r: { club_id: string }) => r.club_id)))
      })
    }, [])
  )

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
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id ?? null
    if (uid) setUserId(uid)

    const [eventsRes, clubsRes, memberRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, lat, lng, address, starts_at, distance_km, pace_sec_km, clubs(name), event_participants(id)')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true }),
      supabase
        .from('clubs')
        .select('id, name, club_members(id)')
        .order('name', { ascending: true }),
      uid
        ? supabase.from('club_members').select('club_id').eq('user_id', uid)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (!eventsRes.error) setEvents(eventsRes.data as unknown as DbEvent[])
    if (!clubsRes.error) setClubs(clubsRes.data as unknown as DbClub[])
    if (memberRes.data) {
      setMyClubIds(new Set(memberRes.data.map((r: { club_id: string }) => r.club_id)))
    }
    setLoading(false)
  }

  async function joinEventAndNavigate(event: DbEvent) {
    if (!userId) {
      Alert.alert('Přihlas se', 'Pro přihlášení na běh musíš být přihlášen.')
      return
    }
    setJoiningId(event.id)
    const { error } = await supabase
      .from('event_participants')
      .insert({ event_id: event.id, user_id: userId })
    if (error && !error.message.includes('duplicate')) {
      Alert.alert('Chyba', error.message)
      setJoiningId(null)
      return
    }
    joinCtx({ id: event.id, name: event.name, starts_at: event.starts_at })
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id
          ? { ...e, event_participants: [...(e.event_participants ?? []), { id: userId }] }
          : e,
      ),
    )
    setJoiningId(null)
    openOnMap(event.id)
  }

  async function joinClub(clubId: string) {
    setJoiningId(clubId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Chyba', 'Nejsi přihlášen.')
      setJoiningId(null)
      return
    }
    const { error } = await supabase
      .from('club_members')
      .insert({ club_id: clubId, user_id: user.id })
    if (error) {
      Alert.alert('Chyba při přidávání', error.message)
    } else {
      setMyClubIds((prev) => new Set([...prev, clubId]))
      setClubs((prev) =>
        prev.map((c) =>
          c.id === clubId
            ? { ...c, club_members: [...(c.club_members ?? []), { id: user.id }] }
            : c,
        ),
      )
      if (!userId) setUserId(user.id)
    }
    setJoiningId(null)
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Najít</Text>
        <View style={styles.searchBar}>
          <Search size={16} color={COLORS.muted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder={innerTab === 'behy' ? 'Hledat běh nebo akci…' : 'Hledat klub…'}
            placeholderTextColor={COLORS.muted}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Inner tabs */}
      <View style={styles.innerTabRow}>
        <TouchableOpacity
          style={[styles.innerTab, innerTab === 'behy' && styles.innerTabActive]}
          onPress={() => setInnerTab('behy')}
        >
          <Text style={[styles.innerTabText, innerTab === 'behy' && styles.innerTabTextActive]}>
            Běhy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.innerTab, innerTab === 'kluby' && styles.innerTabActive]}
          onPress={() => setInnerTab('kluby')}
        >
          <Text style={[styles.innerTabText, innerTab === 'kluby' && styles.innerTabTextActive]}>
            Kluby
          </Text>
        </TouchableOpacity>
      </View>

      {/* Event filters — only for Běhy tab */}
      {innerTab === 'behy' && (
        <View style={styles.filterRow}>
          {EVENT_FILTERS.map((f) => (
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
      )}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* BĚHY TAB */}
          {innerTab === 'behy' && (
            <>
              {visibleEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Žádné běhy nenalezeny</Text>
                </View>
              ) : (
                <View style={{ paddingTop: 8 }}>
                  {visibleEvents.map((event) => {
                    const attendees = event.event_participants ?? []
                    const extra = Math.max(0, attendees.length - 3)
                    const shown = attendees.slice(0, 3)
                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={styles.eventCard}
                        activeOpacity={0.75}
                        onPress={() => openOnMap(event.id)}
                      >
                        <View style={styles.eventCardTop}>
                          <Text style={styles.eventTag}>{event.clubs?.name ?? 'Neznámý klub'}</Text>
                          <Text style={styles.eventName}>{event.name}</Text>
                          <Text style={styles.eventMeta}>
                            {getDayLabel(event.starts_at)} · {getTimeLabel(event.starts_at)}
                            {event.address ? ` · ${event.address}` : ''}
                          </Text>
                          {(event.distance_km != null || event.pace_sec_km != null) && (
                            <Text style={styles.eventRunStats}>
                              {[
                                event.distance_km != null ? `${event.distance_km} km` : null,
                                formatPace(event.pace_sec_km),
                              ].filter(Boolean).join(' · ')}
                            </Text>
                          )}
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
                          {myEventIds.has(event.id) ? (
                            <TouchableOpacity
                              style={styles.joinBtnRegistered}
                              onPress={() => openOnMap(event.id)}
                            >
                              <Text style={styles.joinBtnRegisteredText}>Přihlášen ✓</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.joinBtn, joiningId === event.id && { opacity: 0.6 }]}
                              onPress={() => joinEventAndNavigate(event)}
                              disabled={joiningId === event.id}
                            >
                              {joiningId === event.id
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Text style={styles.joinBtnText}>Přidat se</Text>
                              }
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </>
          )}

          {/* KLUBY TAB */}
          {innerTab === 'kluby' && (
            <View style={{ paddingTop: 8 }}>
              {visibleClubs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Žádné kluby nenalezeny</Text>
                </View>
              ) : (
                visibleClubs.map((club) => {
                  const isMember = myClubIds.has(club.id)
                  const isJoining = joiningId === club.id
                  return (
                    <View key={club.id} style={styles.clubCard}>
                      <View style={styles.clubCardLeft}>
                        <View style={styles.clubIconWrapper}>
                          <Text style={styles.clubIcon}>🏃</Text>
                        </View>
                        <View>
                          <Text style={styles.clubName}>{club.name}</Text>
                          <Text style={styles.clubMembers}>
                            {club.club_members?.length ?? 0} členů
                          </Text>
                        </View>
                      </View>
                      {isMember ? (
                        <View style={styles.memberBadge}>
                          <Text style={styles.memberBadgeText}>Člen ✓</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.joinClubBtn, isJoining && styles.joinClubBtnDisabled]}
                          onPress={() => joinClub(club.id)}
                          disabled={isJoining}
                        >
                          <Text style={styles.joinClubBtnText}>
                            {isJoining ? '…' : 'Přidat se'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })
              )}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
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
  innerTabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  innerTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  innerTabActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  innerTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  innerTabTextActive: {
    color: '#FFF',
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
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  // Event cards
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
  eventRunStats: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    marginTop: 5,
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
    minWidth: 90,
    alignItems: 'center',
  },
  joinBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  joinBtnRegistered: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinBtnRegisteredText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  // Club cards
  clubCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  clubCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clubIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubIcon: {
    fontSize: 22,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  clubMembers: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  joinClubBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinClubBtnDisabled: {
    opacity: 0.5,
  },
  joinClubBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  memberBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  memberBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
})
