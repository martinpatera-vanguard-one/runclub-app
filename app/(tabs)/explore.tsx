import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image as ExpoImage } from 'expo-image'
import { Search, X, Users, MapPin } from 'lucide-react-native'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect, router } from 'expo-router'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { useEventParticipation } from '../../contexts/eventParticipation'
import { useClubRuns } from '../../contexts/clubRuns'

const SCREEN_HEIGHT = Dimensions.get('window').height

const EVENT_FILTERS = ['Všechny', 'Dnes', 'Blízko']

const RUN_TYPE_LABELS: Record<string, string> = {
  longrun: 'Dlouhý běh',
  tempo: 'Tempo',
  interval: 'Interval',
  sprint: 'Sprint',
  recovery: 'Regenerační',
  fartlek: 'Fartlek',
}

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

type DbClubRunExplore = {
  id: string
  title: string
  run_type: string
  lat: number
  lng: number
  address: string | null
  starts_at: string
  distance_km: number | null
  pace_text: string | null
  clubs: { name: string } | null
}

type DbPublicRunExplore = {
  id: string
  created_by: string
  title: string
  run_type: string
  lat: number
  lng: number
  address: string | null
  starts_at: string
  distance_km: number | null
  pace_text: string | null
  users: { full_name: string } | null
  public_run_participants: { id: string }[]
}

type UnifiedRun =
  | { source: 'event'; data: DbEvent }
  | { source: 'club_run'; data: DbClubRunExplore }
  | { source: 'public_run'; data: DbPublicRunExplore }

type DbClub = {
  id: string
  name: string
  cover_image_url: string | null
  club_members: { id: string }[]
}

type ClubDetail = {
  id: string
  name: string
  description: string | null
  location: string | null
  memberCount: number
  cover_image_url: string | null
}

type ClubRun = {
  id: string
  title: string
  run_type: string
  starts_at: string
  distance_km: number | null
  pace_text: string | null
}

type UserLocation = { lat: number; lng: number }

function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${sec.toString().padStart(2, '0')} /km`
}

function getRunStats(item: UnifiedRun): string {
  if (item.source === 'event') {
    const dist = item.data.distance_km != null ? `${item.data.distance_km} km` : null
    const pace = formatPace(item.data.pace_sec_km) ?? 'Libovolné tempo'
    return [dist, pace].filter(Boolean).join(' · ')
  }
  const dist = item.data.distance_km != null ? `${item.data.distance_km} km` : null
  const pace = item.data.pace_text ? `${item.data.pace_text} /km` : 'Libovolné tempo'
  return [dist, pace].filter(Boolean).join(' · ')
}

function getRunAuthor(item: UnifiedRun): string {
  if (item.source === 'event') return item.data.clubs?.name ?? 'Neznámý klub'
  if (item.source === 'club_run') return item.data.clubs?.name ?? 'Neznámý klub'
  return item.data.users?.full_name ?? 'Neznámý uživatel'
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
  const [clubRuns, setClubRuns] = useState<DbClubRunExplore[]>([])
  const [publicRuns, setPublicRuns] = useState<DbPublicRunExplore[]>([])
  const [clubs, setClubs] = useState<DbClub[]>([])
  const [detailClub, setDetailClub] = useState<ClubDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [myClubIds, setMyClubIds] = useState<Set<string>>(new Set())
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const { myEventIds, join: joinCtx, leave: leaveCtx, pendingOpenId } = useEventParticipation()
  const { version: clubRunsVersion } = useClubRuns()

  function openOnMap(eventId: string) {
    pendingOpenId.current = eventId
    router.navigate('/' as any)
  }

  useEffect(() => {
    fetchData()
  }, [clubRunsVersion])

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

    const now = new Date().toISOString()

    const [eventsRes, clubRunsRes, publicRunsRes, clubsRes, memberRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, lat, lng, address, starts_at, distance_km, pace_sec_km, clubs(name), event_participants(id)')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
      supabase
        .from('club_runs')
        .select('id, title, run_type, lat, lng, address, starts_at, distance_km, pace_text, clubs(name)')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
      supabase
        .from('public_runs')
        .select('id, created_by, title, run_type, lat, lng, address, starts_at, distance_km, pace_text, users(full_name), public_run_participants(id)')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
      supabase
        .from('clubs')
        .select('id, name, cover_image_url, club_members(id)')
        .order('name', { ascending: true }),
      uid
        ? supabase.from('club_members').select('club_id').eq('user_id', uid)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (!eventsRes.error) setEvents(eventsRes.data as unknown as DbEvent[])
    if (!clubRunsRes.error) setClubRuns(clubRunsRes.data as unknown as DbClubRunExplore[])
    if (!publicRunsRes.error) setPublicRuns(publicRunsRes.data as unknown as DbPublicRunExplore[])
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

  const filteredRuns = useCallback((): UnifiedRun[] => {
    const allEvents: UnifiedRun[] = events.map((e) => ({ source: 'event', data: e }))
    const allClubRuns: UnifiedRun[] = clubRuns.map((r) => ({ source: 'club_run', data: r }))
    const allPublicRuns: UnifiedRun[] = publicRuns.map((r) => ({ source: 'public_run', data: r }))
    let list: UnifiedRun[] = [...allEvents, ...allClubRuns, ...allPublicRuns].sort(
      (a, b) =>
        new Date(a.data.starts_at).getTime() - new Date(b.data.starts_at).getTime(),
    )

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      list = list.filter((item) => {
        if (item.source === 'event') {
          return (
            item.data.name.toLowerCase().includes(q) ||
            (item.data.clubs?.name ?? '').toLowerCase().includes(q) ||
            (item.data.address ?? '').toLowerCase().includes(q)
          )
        }
        if (item.source === 'public_run') {
          return (
            item.data.title.toLowerCase().includes(q) ||
            (item.data.users?.full_name ?? '').toLowerCase().includes(q) ||
            (item.data.address ?? '').toLowerCase().includes(q)
          )
        }
        return (
          item.data.title.toLowerCase().includes(q) ||
          (item.data.clubs?.name ?? '').toLowerCase().includes(q) ||
          (item.data.address ?? '').toLowerCase().includes(q)
        )
      })
    }

    if (activeFilter === 'Dnes') {
      const today = new Date().toDateString()
      list = list.filter((item) => new Date(item.data.starts_at).toDateString() === today)
    }

    if (activeFilter === 'Blízko' && userLocation) {
      list = list
        .filter((item) => item.data.lat != null && item.data.lng != null)
        .sort((a, b) => {
          const dA = haversineKm(userLocation.lat, userLocation.lng, a.data.lat!, a.data.lng!)
          const dB = haversineKm(userLocation.lat, userLocation.lng, b.data.lat!, b.data.lng!)
          return dA - dB
        })
        .slice(0, 10)
    }

    return list
  }, [events, clubRuns, publicRuns, searchText, activeFilter, userLocation])

  const filteredClubs = useCallback(() => {
    if (!searchText.trim()) return clubs
    const q = searchText.toLowerCase()
    return clubs.filter((c) => c.name.toLowerCase().includes(q))
  }, [clubs, searchText])

  const visibleRuns = filteredRuns()
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
              {visibleRuns.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Žádné běhy nenalezeny</Text>
                </View>
              ) : (
                <View style={{ paddingTop: 8 }}>
                  {visibleRuns.map((item) => {
                    const runId = item.source === 'event' ? item.data.id
                      : item.source === 'public_run' ? `pr_${item.data.id}`
                      : `cr_${item.data.id}`
                    const name = item.source === 'event' ? item.data.name : item.data.title
                    const authorName = getRunAuthor(item)
                    const stats = getRunStats(item)
                    const attendees = item.source === 'event'
                      ? (item.data.event_participants ?? [])
                      : item.source === 'public_run'
                      ? (item.data.public_run_participants ?? [])
                      : []
                    const extra = Math.max(0, attendees.length - 3)
                    const shown = attendees.slice(0, 3)
                    const isClubRun = item.source === 'club_run'
                    const isPublicRun = item.source === 'public_run'

                    return (
                      <TouchableOpacity
                        key={runId}
                        style={styles.eventCard}
                        activeOpacity={0.75}
                        onPress={() => openOnMap(runId)}
                      >
                        <View style={styles.eventCardTop}>
                          <View style={styles.eventTagRow}>
                            <Text style={styles.eventTag}>{authorName}</Text>
                            {(isClubRun || isPublicRun) && (
                              <View style={styles.runTypeBadge}>
                                <Text style={styles.runTypeBadgeText}>
                                  {RUN_TYPE_LABELS[item.data.run_type] ?? item.data.run_type}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.eventName}>{name}</Text>
                          <Text style={styles.eventMeta}>
                            {getDayLabel(item.data.starts_at)} · {getTimeLabel(item.data.starts_at)}
                            {item.data.address ? ` · ${item.data.address}` : ''}
                          </Text>
                          <Text style={styles.eventRunStats}>{stats}</Text>
                        </View>
                        <View style={styles.eventCardBottom}>
                          {isClubRun ? (
                            <Text style={styles.noAttendeesText}>Klubový běh</Text>
                          ) : attendees.length === 0 ? (
                            <Text style={styles.noAttendeesText}>Nikdo zatím</Text>
                          ) : (
                            <Text style={styles.noAttendeesText}>
                              {attendees.length === 1
                                ? '1 přihlášený'
                                : attendees.length < 5
                                ? `${attendees.length} přihlášení`
                                : `${attendees.length} přihlášených`}
                            </Text>
                          )}
                          {isClubRun ? (
                            <TouchableOpacity
                              style={styles.joinBtnRegistered}
                              onPress={() => openOnMap(runId)}
                            >
                              <Text style={styles.joinBtnRegisteredText}>Zobrazit na mapě →</Text>
                            </TouchableOpacity>
                          ) : isPublicRun ? (
                            <TouchableOpacity
                              style={styles.joinBtnRegistered}
                              onPress={() => openOnMap(runId)}
                            >
                              <Text style={styles.joinBtnRegisteredText}>Zobrazit na mapě →</Text>
                            </TouchableOpacity>
                          ) : myEventIds.has(item.data.id) ? (
                            <TouchableOpacity
                              style={styles.joinBtnRegistered}
                              onPress={() => openOnMap(item.data.id)}
                            >
                              <Text style={styles.joinBtnRegisteredText}>Přihlášen ✓</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.joinBtn, joiningId === item.data.id && { opacity: 0.6 }]}
                              onPress={() => joinEventAndNavigate(item.data as DbEvent)}
                              disabled={joiningId === item.data.id}
                            >
                              {joiningId === item.data.id
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
                    <TouchableOpacity
                      key={club.id}
                      style={styles.clubCard}
                      activeOpacity={0.75}
                      onPress={() => setDetailClub({
                        id: club.id,
                        name: club.name,
                        description: null,
                        location: null,
                        memberCount: club.club_members?.length ?? 0,
                        cover_image_url: club.cover_image_url ?? null,
                      })}
                    >
                      <View style={styles.clubCardLeft}>
                        <View style={[styles.clubIconWrapper, !!club.cover_image_url && { backgroundColor: 'transparent' }]}>
                          {club.cover_image_url ? (
                            <ExpoImage
                              source={{ uri: club.cover_image_url }}
                              style={{ width: 46, height: 46, borderRadius: 14 }}
                              contentFit="cover"
                            />
                          ) : (
                            <Text style={styles.clubIcon}>🏃</Text>
                          )}
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
                          onPress={(e) => { e.stopPropagation?.(); joinClub(club.id) }}
                          disabled={isJoining}
                        >
                          <Text style={styles.joinClubBtnText}>
                            {isJoining ? '…' : 'Přidat se'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <ExploreClubDetailSheet
        club={detailClub}
        isMember={detailClub ? myClubIds.has(detailClub.id) : false}
        joiningId={joiningId}
        onClose={() => setDetailClub(null)}
        onJoin={(clubId) => {
          joinClub(clubId)
          setDetailClub(null)
        }}
      />
    </SafeAreaView>
  )
}

type ExploreClubDetailProps = {
  club: ClubDetail | null
  isMember: boolean
  joiningId: string | null
  onClose: () => void
  onJoin: (clubId: string) => void
}

function ExploreClubDetailSheet({ club, isMember, joiningId, onClose, onJoin }: ExploreClubDetailProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const [upcomingRuns, setUpcomingRuns] = useState<ClubRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [fullDetail, setFullDetail] = useState<{ description: string | null; location: string | null; cover_image_url: string | null } | null>(null)
  const { pendingOpenId } = useEventParticipation()

  function openRunOnMap(runId: string) {
    pendingOpenId.current = `cr_${runId}`
    onClose()
    router.navigate('/(tabs)/' as any)
  }

  function formatWhen(startsAt: string): string {
    const date = new Date(startsAt)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    if (date.toDateString() === today.toDateString()) return `Dnes ${time}`
    if (date.toDateString() === tomorrow.toDateString()) return `Zítra ${time}`
    const weekday = date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
    return `${weekday} ${time}`
  }

  useEffect(() => {
    if (club) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start()
      fetchClubDetail(club.id)
      fetchUpcomingRuns(club.id)
    } else {
      setUpcomingRuns([])
      setFullDetail(null)
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start()
    }
  }, [club])

  async function fetchClubDetail(clubId: string) {
    const { data } = await supabase
      .from('clubs')
      .select('description, location, cover_image_url')
      .eq('id', clubId)
      .single()
    if (data) setFullDetail({ description: data.description ?? null, location: data.location ?? null, cover_image_url: data.cover_image_url ?? null })
  }

  async function fetchUpcomingRuns(clubId: string) {
    setRunsLoading(true)
    const { data } = await supabase
      .from('club_runs')
      .select('id, title, run_type, starts_at, distance_km, pace_text')
      .eq('club_id', clubId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(10)
    setUpcomingRuns((data as ClubRun[]) ?? [])
    setRunsLoading(false)
  }

  if (!club) return null

  const description = fullDetail?.description ?? club.description
  const location = fullDetail?.location ?? club.location
  const coverImage = fullDetail?.cover_image_url ?? club.cover_image_url
  const isJoining = joiningId === club.id

  return (
    <Animated.View style={[exploreDetailStyles.overlay, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Cover area */}
        <View style={exploreDetailStyles.coverArea}>
          {coverImage ? (
            <>
              <ExpoImage
                source={{ uri: coverImage }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={300}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E8E5E0' }]} />
          )}
          <View style={exploreDetailStyles.topBar}>
            <View style={{ width: 36 }} />
            <TouchableOpacity style={exploreDetailStyles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={exploreDetailStyles.content}>
          <Text style={exploreDetailStyles.name}>{club.name}</Text>

          {description ? (
            <Text style={exploreDetailStyles.desc}>{description}</Text>
          ) : (
            <Text style={exploreDetailStyles.descEmpty}>Bez popisu</Text>
          )}

          <View style={exploreDetailStyles.statsRow}>
            <View style={exploreDetailStyles.stat}>
              <Users size={16} color={COLORS.accent} strokeWidth={2} />
              <Text style={exploreDetailStyles.statText}>{club.memberCount} členů</Text>
            </View>
            {location && (
              <View style={exploreDetailStyles.stat}>
                <MapPin size={16} color={COLORS.accent} strokeWidth={2} />
                <Text style={exploreDetailStyles.statText}>{location}</Text>
              </View>
            )}
          </View>

          <Text style={exploreDetailStyles.sectionTitle}>Nadcházející běhy</Text>
          <View style={exploreDetailStyles.runsCard}>
            {runsLoading ? (
              <View style={exploreDetailStyles.runsRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : upcomingRuns.length === 0 ? (
              <View style={exploreDetailStyles.runsRow}>
                <Text style={exploreDetailStyles.runsEmpty}>Žádné nadcházející běhy</Text>
              </View>
            ) : (
              upcomingRuns.map((run, i) => {
                const stats = [
                  run.distance_km != null ? `${run.distance_km} km` : null,
                  run.pace_text ? `${run.pace_text} /km` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <TouchableOpacity
                    key={run.id}
                    style={[exploreDetailStyles.runsRow, i < upcomingRuns.length - 1 && exploreDetailStyles.runsRowBorder]}
                    onPress={() => openRunOnMap(run.id)}
                    activeOpacity={0.65}
                  >
                    <View style={exploreDetailStyles.runsDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={exploreDetailStyles.runsName}>{run.title}</Text>
                      {(RUN_TYPE_LABELS[run.run_type] || stats) ? (
                        <Text style={exploreDetailStyles.runsMeta}>
                          {[RUN_TYPE_LABELS[run.run_type], stats].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={exploreDetailStyles.runsWhen}>{formatWhen(run.starts_at)} ›</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>

      {!isMember && (
        <TouchableOpacity
          style={[exploreDetailStyles.joinBtn, isJoining && { opacity: 0.6 }]}
          onPress={() => onJoin(club.id)}
          disabled={isJoining}
        >
          {isJoining
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={exploreDetailStyles.joinBtnText}>+ Přidat se</Text>
          }
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const exploreDetailStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    zIndex: 10,
  },
  coverArea: {
    height: 190,
    overflow: 'hidden',
    backgroundColor: '#DEDAD6',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  descEmpty: {
    fontSize: 14,
    color: COLORS.border,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  runsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  runsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  runsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  runsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    flexShrink: 0,
  },
  runsName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  runsMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  runsWhen: {
    fontSize: 12,
    color: COLORS.muted,
    flexShrink: 0,
  },
  runsEmpty: {
    fontSize: 13,
    color: COLORS.muted,
  },
  joinBtn: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    zIndex: 5,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
})

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
  eventTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  eventTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.accent,
  },
  runTypeBadge: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  runTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
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
