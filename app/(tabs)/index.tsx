import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Modal,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { useRef, useState, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { Zap, Route, X, LocateFixed } from 'lucide-react-native'
import { useEventParticipation } from '../../contexts/eventParticipation'
import { useClubRuns } from '../../contexts/clubRuns'
import { CreateRunModal } from '../../components/CreateRunModal'

const FOCUSED_DELTA = 0.012
const FILTERS = ['Dnes', 'Zítra', 'Tento týden']

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
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
  const date = new Date(startsAt)
  return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

type DbEvent = {
  id: string
  name: string
  description: string | null
  lat: number | null
  lng: number | null
  address: string | null
  starts_at: string
  max_participants: number | null
  price_czk: number
  distance_km: number | null
  pace_sec_km: number | null
  clubs: { name: string } | null
  event_participants: { id: string }[]
}

type Run = {
  id: string
  label: string
  clubName: string
  lat: number
  lng: number
  address: string
  time: string
  dayLabel: string
  startsAt: string
  people: number
  maxParticipants: number | null
  priceCzk: number
  distKm: number | null
  routeKm: number | null
  paceSec: number | null
  runType: string | null
  note: string | null
  source: 'event' | 'club_run' | 'public_run'
  createdBy?: string
}

type DbClubRun = {
  id: string
  title: string
  run_type: string
  distance_km: number | null
  pace_text: string | null
  starts_at: string
  lat: number
  lng: number
  address: string | null
  note: string | null
  clubs: { name: string } | null
  club_run_participants: { id: string }[]
}

type DbPublicRun = {
  id: string
  created_by: string
  title: string
  run_type: string
  distance_km: number | null
  pace_text: string | null
  starts_at: string
  lat: number
  lng: number
  address: string | null
  note: string | null
  users: { full_name: string } | null
  public_run_participants: { id: string }[]
}

function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${sec.toString().padStart(2, '0')} /km`
}

function mapEventToRun(event: DbEvent, userLocation: { lat: number; lng: number } | null): Run {
  return {
    id: event.id,
    label: event.name,
    clubName: event.clubs?.name ?? 'Neznámý klub',
    lat: event.lat ?? 0,
    lng: event.lng ?? 0,
    address: event.address ?? '',
    time: getTimeLabel(event.starts_at),
    dayLabel: getDayLabel(event.starts_at),
    startsAt: event.starts_at,
    people: event.event_participants?.length ?? 0,
    maxParticipants: event.max_participants,
    priceCzk: event.price_czk ?? 0,
    distKm: userLocation && event.lat && event.lng
      ? haversineKm(userLocation.lat, userLocation.lng, event.lat, event.lng)
      : null,
    routeKm: event.distance_km,
    paceSec: event.pace_sec_km,
    runType: null,
    note: null,
    source: 'event',
  }
}

function parsePaceTextToSec(paceText: string | null): number | null {
  if (!paceText) return null
  const match = paceText.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function mapClubRunToRun(run: DbClubRun, userLocation: { lat: number; lng: number } | null): Run {
  return {
    id: `cr_${run.id}`,
    label: run.title,
    clubName: run.clubs?.name ?? '',
    lat: run.lat,
    lng: run.lng,
    address: run.address ?? '',
    time: getTimeLabel(run.starts_at),
    dayLabel: getDayLabel(run.starts_at),
    startsAt: run.starts_at,
    people: run.club_run_participants?.length ?? 0,
    maxParticipants: null,
    priceCzk: 0,
    distKm: userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, run.lat, run.lng)
      : null,
    routeKm: run.distance_km,
    paceSec: parsePaceTextToSec(run.pace_text),
    runType: run.run_type,
    note: run.note ?? null,
    source: 'club_run',
  }
}

function mapPublicRunToRun(run: DbPublicRun, userLocation: { lat: number; lng: number } | null): Run {
  return {
    id: `pr_${run.id}`,
    label: run.title,
    clubName: run.users?.full_name ?? 'Neznámý uživatel',
    lat: run.lat,
    lng: run.lng,
    address: run.address ?? '',
    time: getTimeLabel(run.starts_at),
    dayLabel: getDayLabel(run.starts_at),
    startsAt: run.starts_at,
    people: run.public_run_participants?.length ?? 0,
    maxParticipants: null,
    priceCzk: 0,
    distKm: userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, run.lat, run.lng)
      : null,
    routeKm: run.distance_km,
    paceSec: parsePaceTextToSec(run.pace_text),
    runType: run.run_type,
    note: run.note ?? null,
    source: 'public_run',
    createdBy: run.created_by,
  }
}

type UserLocation = { lat: number; lng: number }

const SHEET_HEIGHT = 300
const PEEK = 52
const EXPANDED = 260

export default function MapaScreen() {
  const { myEventIds, join: joinCtx, leave: leaveCtx, pendingOpenId } = useEventParticipation()
  const { version: clubRunsVersion } = useClubRuns()
  const [activeFilter, setActiveFilter] = useState('Dnes')
  const [containerH, setContainerH] = useState(0)
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false)
  const [showCreateRun, setShowCreateRun] = useState(false)
  const [myClubRunIds, setMyClubRunIds] = useState<Set<string>>(new Set())
  const [myPublicRunIds, setMyPublicRunIds] = useState<Set<string>>(new Set())
  const [showParticipants, setShowParticipants] = useState(false)
  const [participants, setParticipants] = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const isParticipant = !!selectedRun && (
    selectedRun.source === 'event'
      ? myEventIds.has(selectedRun.id)
      : selectedRun.source === 'club_run'
      ? myClubRunIds.has(selectedRun.id.slice(3))
      : myPublicRunIds.has(selectedRun.id.slice(3))
  )

  const isCreator = !!selectedRun &&
    selectedRun.source === 'public_run' &&
    selectedRun.createdBy === userId

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      }
    })()
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  function refreshMyPublicRunIds(uid: string) {
    supabase
      .from('public_run_participants')
      .select('public_run_id')
      .eq('user_id', uid)
      .then(({ data }) => {
        setMyPublicRunIds(new Set((data ?? []).map((r: { public_run_id: string }) => r.public_run_id)))
      })
  }

  useEffect(() => {
    if (!userId) { setMyClubRunIds(new Set()); setMyPublicRunIds(new Set()); return }
    supabase
      .from('club_run_participants')
      .select('club_run_id')
      .eq('user_id', userId)
      .then(({ data }) => {
        setMyClubRunIds(new Set((data ?? []).map((r: { club_run_id: string }) => r.club_run_id)))
      })
    refreshMyPublicRunIds(userId)
  }, [userId])

  useEffect(() => {
    fetchEvents()
  }, [userLocation, clubRunsVersion])

  useFocusEffect(
    useCallback(() => {
      const id = pendingOpenId.current
      if (!id) return
      pendingOpenId.current = null
      const run = runs.find((r) => r.id === id)
      if (run) {
        openRun(run)
      } else if (!loading) {
        // Runs might not be loaded yet — fetch and then open
        supabase
          .from('events')
          .select('id, name, description, lat, lng, address, starts_at, max_participants, price_czk, distance_km, pace_sec_km, clubs(name), event_participants(id)')
          .eq('id', id)
          .single()
          .then(({ data }) => {
            if (data) openRun(mapEventToRun(data as any, userLocation))
          })
      }
    }, [runs, loading, userLocation])
  )

  async function fetchEvents() {
    setLoading(true)
    const now = new Date().toISOString()

    const [eventsResult, clubRunsResult, publicRunsResult] = await Promise.all([
      supabase
        .from('events')
        .select(`
          id, name, description, lat, lng, address, starts_at,
          max_participants, price_czk, distance_km, pace_sec_km,
          clubs(name),
          event_participants(id)
        `)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
      supabase
        .from('club_runs')
        .select('id, title, run_type, distance_km, pace_text, starts_at, lat, lng, address, note, clubs(name), club_run_participants(id)')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
      supabase
        .from('public_runs')
        .select('id, created_by, title, run_type, distance_km, pace_text, starts_at, lat, lng, address, note, users(full_name), public_run_participants(id)')
        .gte('starts_at', now)
        .order('starts_at', { ascending: true }),
    ])

    if (eventsResult.error) {
      console.error('[events] fetch error:', eventsResult.error.message)
    }

    const mappedEvents = ((eventsResult.data ?? []) as unknown as DbEvent[]).map((e) =>
      mapEventToRun(e, userLocation),
    )
    const mappedClubRuns = ((clubRunsResult.data ?? []) as unknown as DbClubRun[]).map((r) =>
      mapClubRunToRun(r, userLocation),
    )
    const mappedPublicRuns = ((publicRunsResult.data ?? []) as unknown as DbPublicRun[]).map((r) =>
      mapPublicRunToRun(r, userLocation),
    )

    const combined = [...mappedEvents, ...mappedClubRuns, ...mappedPublicRuns].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    setRuns(combined)
    setLoading(false)
  }

  async function handleJoin() {
    if (!userId || !selectedRun) return
    setJoinLoading(true)
    if (selectedRun.source === 'club_run') {
      const rawId = selectedRun.id.slice(3)
      const { error } = await supabase
        .from('club_run_participants')
        .insert({ club_run_id: rawId, user_id: userId })
      if (!error) {
        setMyClubRunIds(prev => new Set([...prev, rawId]))
        const updated = { ...selectedRun, people: selectedRun.people + 1 }
        setSelectedRun(updated)
        setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
      }
    } else if (selectedRun.source === 'public_run') {
      const rawId = selectedRun.id.slice(3)
      const { error } = await supabase
        .from('public_run_participants')
        .insert({ public_run_id: rawId, user_id: userId })
      if (!error) {
        setMyPublicRunIds(prev => new Set([...prev, rawId]))
        const updated = { ...selectedRun, people: selectedRun.people + 1 }
        setSelectedRun(updated)
        setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
      }
    } else {
      const { error } = await supabase
        .from('event_participants')
        .insert({ event_id: selectedRun.id, user_id: userId })
      if (!error) {
        joinCtx({ id: selectedRun.id, name: selectedRun.label, starts_at: selectedRun.startsAt })
        const updated = { ...selectedRun, people: selectedRun.people + 1 }
        setSelectedRun(updated)
        setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
      }
    }
    setJoinLoading(false)
  }

  async function handleLeave() {
    if (!userId || !selectedRun) return
    setJoinLoading(true)
    if (selectedRun.source === 'club_run') {
      const rawId = selectedRun.id.slice(3)
      const { error } = await supabase
        .from('club_run_participants')
        .delete()
        .eq('club_run_id', rawId)
        .eq('user_id', userId)
      if (!error) {
        setMyClubRunIds(prev => { const s = new Set(prev); s.delete(rawId); return s })
        const updated = { ...selectedRun, people: Math.max(0, selectedRun.people - 1) }
        setSelectedRun(updated)
        setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
      }
    } else if (selectedRun.source === 'public_run') {
      const rawId = selectedRun.id.slice(3)
      if (isCreator) {
        // Zakladatel — smaž celý běh (CASCADE smaže i účastníky)
        const { error } = await supabase
          .from('public_runs')
          .delete()
          .eq('id', rawId)
        if (!error) {
          setMyPublicRunIds(prev => { const s = new Set(prev); s.delete(rawId); return s })
          setRuns(prev => prev.filter(r => r.id !== selectedRun.id))
          setConfirmLeaveVisible(false)
          setSelectedRun(null)
        }
      } else {
        const { error } = await supabase
          .from('public_run_participants')
          .delete()
          .eq('public_run_id', rawId)
          .eq('user_id', userId)
        if (!error) {
          setMyPublicRunIds(prev => { const s = new Set(prev); s.delete(rawId); return s })
          const updated = { ...selectedRun, people: Math.max(0, selectedRun.people - 1) }
          setSelectedRun(updated)
          setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
        }
      }
    } else {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', selectedRun.id)
        .eq('user_id', userId)
      if (!error) {
        leaveCtx(selectedRun.id)
        const updated = { ...selectedRun, people: Math.max(0, selectedRun.people - 1) }
        setSelectedRun(updated)
        setRuns(prev => prev.map(r => r.id === selectedRun.id ? updated : r))
      }
    }
    setConfirmLeaveVisible(false)
    setJoinLoading(false)
  }

  async function handleFabPress() {
    if (!userId) {
      setShowCreateRun(true)
      return
    }
    const { data } = await supabase
      .from('public_runs')
      .select('id')
      .eq('created_by', userId)
      .gt('starts_at', new Date().toISOString())
      .limit(1)

    if (data && data.length > 0) {
      Alert.alert(
        'Už máš naplánovaný běh',
        'Každý může mít naplánovaný pouze jeden běh najednou. Jakmile tvůj aktuální běh proběhne, můžeš vytvořit nový.',
      )
      return
    }
    setShowCreateRun(true)
  }

  function goToUserLocation() {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: FOCUSED_DELTA, longitudeDelta: FOCUSED_DELTA },
        400,
      )
    } else {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status === 'granted') {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
            const loc2 = { lat: loc.coords.latitude, lng: loc.coords.longitude }
            setUserLocation(loc2)
            mapRef.current?.animateToRegion(
              { latitude: loc2.lat, longitude: loc2.lng, latitudeDelta: FOCUSED_DELTA, longitudeDelta: FOCUSED_DELTA },
              400,
            )
          })
        }
      })
    }
  }

  const closeModal = () => {
    setConfirmLeaveVisible(false)
    setSelectedRun(null)
  }

  async function fetchParticipants(run: Run) {
    setParticipantsLoading(true)
    const rawId = run.source === 'event' ? run.id : run.id.slice(3)
    const table = run.source === 'event' ? 'event_participants'
      : run.source === 'club_run' ? 'club_run_participants'
      : 'public_run_participants'
    const idCol = run.source === 'event' ? 'event_id'
      : run.source === 'club_run' ? 'club_run_id'
      : 'public_run_id'

    const { data: rows } = await supabase
      .from(table)
      .select('user_id')
      .eq(idCol, rawId)

    const userIds = (rows ?? []).map((r: any) => r.user_id)
    if (userIds.length === 0) {
      setParticipants([])
      setParticipantsLoading(false)
      return
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .in('id', userIds)

    setParticipants(
      (users ?? []).map((u: any) => ({
        id: u.id,
        full_name: u.full_name ?? 'Neznámý účastník',
        avatar_url: u.avatar_url ?? null,
      }))
    )
    setParticipantsLoading(false)
  }

  const openRun = (run: Run) => {
    setSelectedRun(run)
    if (run.lat && run.lng) {
      mapRef.current?.animateToRegion(
        { latitude: run.lat, longitude: run.lng, latitudeDelta: FOCUSED_DELTA, longitudeDelta: FOCUSED_DELTA },
        400,
      )
    }
  }

  const translateY = useRef(new Animated.Value(0)).current
  const lastY = useRef(0)
  const isExpanded = useRef(false)

  const snapTo = (expand: boolean) => {
    const toValue = expand ? -(EXPANDED - PEEK) : 0
    isExpanded.current = expand
    lastY.current = toValue
    Animated.spring(translateY, { toValue, useNativeDriver: true, bounciness: 4 }).start()
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        translateY.stopAnimation((val) => { lastY.current = val })
      },
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-(EXPANDED - PEEK), lastY.current + g.dy))
        translateY.setValue(next)
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) < 8) { snapTo(!isExpanded.current); return }
        if (g.vy < -0.3 || lastY.current + g.dy < -(EXPANDED - PEEK) / 2) snapTo(true)
        else snapTo(false)
      },
    })
  ).current

  const sheetTop = containerH > 0 ? containerH - PEEK : 9999

  const filteredRuns = runs.filter((run) => {
    const d = new Date(run.startsAt)
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7)
    if (activeFilter === 'Dnes') return d.toDateString() === today.toDateString()
    if (activeFilter === 'Zítra') return d.toDateString() === tomorrow.toDateString()
    return d >= today && d < weekEnd
  })

  const filterTitle = activeFilter === 'Dnes' ? 'Dnes běžíme 🏃' : activeFilter === 'Zítra' ? 'Zítra běžíme 🏃' : 'Tento týden 🏃'

  return (
    <View style={styles.container} onLayout={(e) => setContainerH(e.nativeEvent.layout.height)}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: 50.0940, longitude: 14.4295, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {filteredRuns.map((run) => (
          <Marker
            key={run.id}
            coordinate={{ latitude: run.lat, longitude: run.lng }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => openRun(run)}
          >
            <View style={styles.pinContainer}>
              <View style={[styles.pinBubble, selectedRun?.id === run.id && styles.pinBubbleHighlight]}>
                <View style={styles.pinNameRow}>
                  <Text style={[styles.pinName, selectedRun?.id === run.id && styles.pinTextHighlight]}>
                    {run.label}
                  </Text>
                  <Text style={[styles.pinPeople, selectedRun?.id === run.id && styles.pinTextHighlight]}>
                    {run.people}
                  </Text>
                </View>
                <Text style={[styles.pinMeta, selectedRun?.id === run.id && styles.pinTextHighlight]}>
                  {[
                    run.time,
                    run.routeKm != null ? `${run.routeKm} km` : null,
                    formatPace(run.paceSec),
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={[styles.pinTail, selectedRun?.id === run.id && styles.pinTailHighlight]} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <SafeAreaView edges={['top']} style={styles.headerOverlay}>
        <View style={styles.header}>
          <Text style={styles.mapTitle}>{filterTitle}</Text>
          <Text style={styles.mapSubtitle}>
            {loading
              ? 'Načítám běhy…'
              : `${filteredRuns.length} ${filteredRuns.length === 1 ? 'běh' : filteredRuns.length < 5 ? 'běhy' : 'běhů'} ve tvém okolí`}
            {!userLocation && !loading ? ' · zjišťuji polohu…' : ''}
          </Text>
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* Location button */}
      <Animated.View style={[styles.locationBtn, { bottom: containerH - sheetTop + 10 + 56 + 12, transform: [{ translateY: translateY }] }]}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={goToUserLocation}>
          <LocateFixed size={22} color={COLORS.accent} strokeWidth={2} />
        </TouchableOpacity>
      </Animated.View>

      {/* FAB - přidat běh */}
      <Animated.View style={[styles.fab, { bottom: containerH - sheetTop + 10, transform: [{ translateY: translateY }] }]}>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={handleFabPress}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[styles.bottomSheet, { top: sheetTop, height: SHEET_HEIGHT, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}
      >
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetLabelRow}>
            <Text style={styles.sheetLabel}>Blízko tebe</Text>
            <Text style={styles.sheetLabelCol}>běžci</Text>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        )}

        {!loading && filteredRuns.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Žádné nadcházející běhy</Text>
          </View>
        )}

        {!loading && filteredRuns.map((run, i) => (
          <TouchableOpacity
            key={run.id}
            style={[styles.runCard, i < filteredRuns.length - 1 && styles.runCardBorder]}
            onPress={() => openRun(run)}
            activeOpacity={0.7}
          >
            <View style={styles.runDot}>
              <Text style={styles.runEmoji}>🏃</Text>
            </View>
            <View style={styles.runInfo}>
              <Text style={styles.runName}>{run.label}</Text>
              <Text style={styles.runTime}>{run.dayLabel} {run.time} · {run.clubName}</Text>
              {(run.routeKm || run.paceSec) ? (
                <Text style={styles.runStats}>
                  {[
                    run.routeKm ? `${run.routeKm} km` : null,
                    formatPace(run.paceSec),
                  ].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.runCount}>{run.people}</Text>
              {run.distKm !== null && (
                <Text style={styles.runDist}>{formatDist(run.distKm)}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Run detail modal */}
      <Modal
        visible={selectedRun !== null}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            {selectedRun && (
              <>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalEmoji}>🏃</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.modalTitleRow}>
                      <Text style={[styles.modalTitle, { flex: 1 }]}>{selectedRun.label}</Text>
                      {selectedRun.distKm !== null && (
                        <Text style={styles.modalDist}>{formatDist(selectedRun.distKm)} od tebe</Text>
                      )}
                    </View>
                    <Text style={styles.modalClub}>
                      <Text style={styles.modalClubLabel}>
                        {selectedRun.source === 'public_run' ? 'Autor: ' : 'Klub: '}
                      </Text>
                      {selectedRun.clubName || '—'}
                    </Text>
                    {selectedRun.runType && (
                      <Text style={styles.modalRunType}>
                        <Text style={styles.modalClubLabel}>Typ běhu: </Text>
                        {selectedRun.runType === 'longrun' ? 'Dlouhý běh'
                          : selectedRun.runType === 'tempo' ? 'Tempo'
                          : selectedRun.runType === 'interval' ? 'Interval'
                          : selectedRun.runType === 'sprint' ? 'Sprint'
                          : selectedRun.runType === 'recovery' ? 'Regenerační'
                          : selectedRun.runType === 'fartlek' ? 'Fartlek'
                          : selectedRun.runType}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={closeModal} style={styles.modalClose}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalStats}>
                  {(selectedRun.paceSec != null || selectedRun.routeKm != null || selectedRun.source === 'club_run') && (
                    <>
                      <View style={styles.modalStatSplit}>
                        <View style={styles.modalStatSplitItem}>
                          <Zap size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
                          {selectedRun.paceSec != null ? (
                            <Text style={styles.modalStatValueSm}>{formatPace(selectedRun.paceSec)}</Text>
                          ) : selectedRun.source === 'club_run' ? (
                            <Text style={styles.modalStatValueSmMuted}>Libovolné</Text>
                          ) : null}
                        </View>
                        {(selectedRun.paceSec != null || selectedRun.source === 'club_run') && selectedRun.routeKm != null && (
                          <View style={styles.modalStatSplitDivider} />
                        )}
                        {selectedRun.routeKm != null && (
                          <View style={styles.modalStatSplitItem}>
                            <Route size={11} color={COLORS.muted} style={{ marginRight: 4 }} />
                            <Text style={styles.modalStatValueSm}>{selectedRun.routeKm} km</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.modalStatDivider} />
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.modalStat}
                    onPress={() => { fetchParticipants(selectedRun); setShowParticipants(true) }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalStatValue}>
                      {selectedRun.people}{selectedRun.maxParticipants ? ` / ${selectedRun.maxParticipants}` : ''}
                    </Text>
                    <Text style={styles.modalStatLabel}>účastníci ›</Text>
                  </TouchableOpacity>
                  <View style={styles.modalStatDivider} />
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>
                      {selectedRun.priceCzk === 0 ? 'Zdarma' : `${selectedRun.priceCzk} Kč`}
                    </Text>
                    <Text style={styles.modalStatLabel}>vstup</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalInfoRow}
                  onPress={() => Linking.openURL(`calshow:${Math.floor(new Date(selectedRun.startsAt).getTime() / 1000)}`)}
                >
                  <Text style={styles.modalInfoIcon}>🕐</Text>
                  <Text style={styles.modalInfoLinkText}>{selectedRun.dayLabel} · {selectedRun.time}<Text style={styles.modalInfoChevron}> ›</Text></Text>
                </TouchableOpacity>
                {selectedRun.address ? (
                  <TouchableOpacity
                    style={styles.modalInfoRow}
                    onPress={() => Linking.openURL(
                      `maps://?q=${encodeURIComponent(selectedRun.address)}&ll=${selectedRun.lat},${selectedRun.lng}`
                    )}
                  >
                    <Text style={styles.modalInfoIcon}>📍</Text>
                    <Text style={styles.modalInfoLinkText}>{selectedRun.address}<Text style={styles.modalInfoChevron}> ›</Text></Text>
                  </TouchableOpacity>
                ) : null}

                {selectedRun.note ? (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoIcon}>📝</Text>
                    <Text style={styles.modalInfoText}>{selectedRun.note}</Text>
                  </View>
                ) : null}

                {isParticipant ? (
                  <TouchableOpacity
                    style={[styles.modalJoinBtn, isCreator ? styles.modalDeleteBtn : styles.modalLeaveBtn]}
                    onPress={() => setConfirmLeaveVisible(true)}
                    disabled={joinLoading}
                  >
                    {joinLoading
                      ? <ActivityIndicator color={COLORS.muted} />
                      : <Text style={isCreator ? styles.modalDeleteText : styles.modalLeaveText}>
                          {isCreator ? 'Zrušit běh' : 'Odhlásit se'}
                        </Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.modalJoinBtn}
                    onPress={handleJoin}
                    disabled={joinLoading || !userId}
                  >
                    {joinLoading
                      ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.modalJoinText}>
                          {userId ? 'Přihlásit se' : 'Přihlas se pro registraci'}
                        </Text>
                    }
                  </TouchableOpacity>
                )}

                {/* Participants overlay */}
                {showParticipants && (
                  <Pressable style={styles.participantsOverlay} onPress={() => setShowParticipants(false)}>
                    <Pressable style={styles.participantsSheet} onPress={() => {}}>
                      <View style={styles.participantsHeader}>
                        <Text style={styles.participantsTitle}>Účastníci</Text>
                        <TouchableOpacity onPress={() => setShowParticipants(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <X size={20} color={COLORS.muted} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>
                      {participantsLoading ? (
                        <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 32 }} />
                      ) : (
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 1080 }}>
                          {participants.map((p, i) => {
                            const initials = p.full_name.split(' ').map((s: string) => s.charAt(0)).join('').toUpperCase()
                            return (
                              <View key={p.id} style={[styles.participantRow, i < participants.length - 1 && styles.participantRowBorder]}>
                                <View style={styles.participantAvatar}>
                                  {p.avatar_url ? (
                                    <ExpoImage source={{ uri: p.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                                  ) : (
                                    <Text style={styles.participantAvatarText}>{initials}</Text>
                                  )}
                                </View>
                                <Text style={styles.participantName}>{p.full_name}</Text>
                              </View>
                            )
                          })}
                        </ScrollView>
                      )}
                    </Pressable>
                  </Pressable>
                )}

                {/* Confirm leave — overlay uvnitř modalu, ne vnorřený Modal */}
                {confirmLeaveVisible && (
                  <Pressable style={styles.confirmOverlay} onPress={() => setConfirmLeaveVisible(false)}>
                    <Pressable style={styles.confirmBox} onPress={() => {}}>
                      <Text style={styles.confirmTitle}>
                        {isCreator ? 'Zrušit běh?' : 'Odhlásit se z běhu?'}
                      </Text>
                      <Text style={styles.confirmBody}>
                        {isCreator
                          ? `Jsi zakladatel běhu „${selectedRun.label}”. Pokud ho zrušíš, běh se smaže pro všechny účastníky.`
                          : `Opravdu se chceš odhlásit z běhu „${selectedRun.label}”?`
                        }
                      </Text>
                      <View style={styles.confirmButtons}>
                        <TouchableOpacity
                          style={styles.confirmCancel}
                          onPress={() => setConfirmLeaveVisible(false)}
                        >
                          <Text style={styles.confirmCancelText}>Zpět</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.confirmLeave}
                          onPress={handleLeave}
                          disabled={joinLoading}
                        >
                          {joinLoading
                            ? <ActivityIndicator color="#FFF" />
                            : <Text style={styles.confirmLeaveText}>{isCreator ? 'Zrušit běh' : 'Odhlásit se'}</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <CreateRunModal
        visible={showCreateRun}
        adminClubs={[{ id: 'placeholder', name: '' }]}
        mode="public"
        onClose={() => setShowCreateRun(false)}
        onCreated={() => { setShowCreateRun(false); fetchEvents(); if (userId) refreshMyPublicRunIds(userId) }}
      />

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: COLORS.bg },
  header: { padding: 16, paddingBottom: 12, backgroundColor: COLORS.bg },
  mapTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  mapSubtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterChip: {
    backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  filterChipActive: { backgroundColor: COLORS.accent },
  filterText: { fontSize: 12, fontWeight: '500', color: COLORS.muted },
  filterTextActive: { color: '#FFF' },
  pinContainer: { alignItems: 'center' },
  pinBubble: {
    backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4, minWidth: 90,
  },
  pinBubbleHighlight: { backgroundColor: COLORS.accent },
  pinNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  pinName: { fontSize: 11, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  pinPeople: { fontSize: 11, fontWeight: '700', color: COLORS.accent },
  pinMeta: { fontSize: 10, color: COLORS.muted, marginTop: 1 },
  pinTextHighlight: { color: '#FFF' },
  pinTail: {
    width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.surface, marginTop: -1,
  },
  pinTailHighlight: { borderTopColor: COLORS.accent },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 },
    elevation: 8, zIndex: 20,
  },
  handleArea: { paddingTop: 10, paddingBottom: 4 },
  sheetHandle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  sheetLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetLabel: { fontSize: 11, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  sheetLabelCol: { fontSize: 11, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  runCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  runCardBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  runDot: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  runEmoji: { fontSize: 16 },
  runInfo: { flex: 1 },
  runName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  runTime: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  runStats: { fontSize: 10, color: COLORS.accent, marginTop: 2 },
  runDist: { fontSize: 10, color: COLORS.muted },
  runCount: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  loadingState: { paddingVertical: 16, alignItems: 'center' },
  emptyState: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontSize: 13, color: COLORS.muted },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  modalHandle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalEmoji: { fontSize: 32 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalClub: { fontSize: 13, color: COLORS.text, marginTop: 2, fontWeight: '500' },
  modalClubLabel: { fontWeight: '400', color: COLORS.muted },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  modalStats: { flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 20, padding: 16, marginBottom: 20, alignItems: 'center' },
  modalStat: { flex: 1, alignItems: 'center' },
  modalStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalStatLabel: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  modalStatDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  modalStatSplit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalStatSplitItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  modalStatSplitDivider: { width: '70%', height: 1, backgroundColor: COLORS.border },
  modalStatValueSm: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  modalStatValueSmMuted: { fontSize: 13, fontWeight: '400', color: COLORS.muted, fontStyle: 'italic' },
  modalDist: { fontSize: 11, color: COLORS.accent, marginTop: 2 },
  modalRunType: { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginTop: 2 },
  modalInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  modalInfoIcon: { fontSize: 16 },
  modalInfoText: { fontSize: 14, color: COLORS.text, flex: 1, lineHeight: 20 },
  modalInfoLinkText: { fontSize: 14, color: COLORS.text, flex: 1, lineHeight: 20, textDecorationLine: 'underline', textDecorationColor: COLORS.accent },
  modalInfoChevron: { fontSize: 16, color: COLORS.accent },
  modalJoinBtn: { backgroundColor: COLORS.accent, borderRadius: 20, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  modalLeaveBtn: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  modalDeleteBtn: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  modalDeleteText: { fontSize: 15, fontWeight: '700', color: '#E05252' },
  modalJoinText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  modalLeaveText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    justifyContent: 'flex-end',
  },
  confirmBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  confirmBody: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  confirmButtons: { flexDirection: 'row', gap: 12 },
  confirmCancel: {
    flex: 1, borderRadius: 20, paddingVertical: 14, alignItems: 'center',
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
  },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  confirmLeave: { flex: 1, borderRadius: 20, paddingVertical: 14, alignItems: 'center', backgroundColor: '#E05252' },
  confirmLeaveText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  participantsOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    zIndex: 10,
  },
  participantsSheet: {
    width: '100%',
    minHeight: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  participantRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  participantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  participantAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  locationBtn: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabIcon: {
    fontSize: 26,
    fontWeight: '400',
    color: '#FFF',
    lineHeight: 30,
  },
})
