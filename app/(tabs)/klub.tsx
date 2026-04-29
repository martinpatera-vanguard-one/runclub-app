import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
// TODO: deep link — odkomentovat až bude slug sloupec v DB a doména
// import { useLocalSearchParams } from 'expo-router'
import { ChevronDown, Check, Plus, X, Users, MoreVertical, LogOut, MapPin, Share2 } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { useEventParticipation } from '../../contexts/eventParticipation'
import { useClubRuns } from '../../contexts/clubRuns'
import { CreateRunModal } from '../../components/CreateRunModal'
import { ShareSheet } from '../../components/ShareSheet'
import { shareStoryCard } from '../../lib/share'

// TODO: deep link slug handling — aktivovat až bude slug v DB a doména
// Použití:
//   const { slug } = useLocalSearchParams<{ slug?: string }>()
//   useEffect(() => {
//     if (slug) openClubBySlug(slug)
//   }, [slug])
//
// async function openClubBySlug(slug: string) {
//   const { data } = await supabase
//     .from('clubs')
//     .select('id, name, description, location, member_count:club_members(count)')
//     .eq('slug', slug)
//     .single()
//   if (data) setDetailClub(/* mapovat na Club typ */)
// }

const RUN_TYPE_LABELS: Record<string, string> = {
  longrun: 'Dlouhý běh',
  tempo: 'Tempo',
  interval: 'Interval',
  sprint: 'Sprint',
  recovery: 'Regenerační',
  fartlek: 'Fartlek',
}

type ClubRun = {
  id: string
  title: string
  run_type: string
  starts_at: string
  distance_km: number | null
  pace_text: string | null
}

function formatUpcomingWhen(startsAt: string): { label: string; isToday: boolean } {
  const date = new Date(startsAt)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === today.toDateString()) return { label: `Dnes ${time}`, isToday: true }
  if (date.toDateString() === tomorrow.toDateString()) return { label: `Zítra ${time}`, isToday: false }
  const weekday = date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
  return { label: `${weekday} ${time}`, isToday: false }
}

const SCREEN_HEIGHT = Dimensions.get('window').height

const LOCATIONS = [
  'Praha – Letná / Holešovice',
  'Praha – Vinohrady / Žižkov',
  'Praha – Smíchov / Košíře',
  'Praha – Dejvice / Bubeneč',
  'Praha – Nusle / Michle',
  'Praha – Vršovice / Strašnice',
  'Praha – Karlín / Florenc',
  'Praha – Nové Město / centrum',
  'Praha – Staré Město / centrum',
  'Praha – Braník / Podolí',
  'Praha – Modřany / Libuš',
  'Praha – Chodov / Háje',
  'Praha – Prosek / Letňany',
  'Praha – Kobylisy / Ďáblice',
  'Praha – Řepy / Zličín',
  'Praha – Radotín / Lochkov',
  'Brno – centrum',
  'Brno – Královo Pole',
  'Brno – Žabovřesky',
  'Brno – Líšeň',
  'Ostrava – centrum',
  'Ostrava – Poruba',
  'Plzeň',
  'Liberec',
  'Olomouc',
  'České Budějovice',
  'Hradec Králové',
  'Pardubice',
  'Jiné',
]

type Club = {
  id: string
  name: string
  slug: string | null
  description: string | null
  location: string | null
  memberCount: number
  userRole: 'admin' | 'member'
}

export default function KlubScreen() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [detailClub, setDetailClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLocation, setNewLocation] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateRun, setShowCreateRun] = useState(false)
  const { refresh: refreshRuns } = useClubRuns()
  const router = useRouter()

  useFocusEffect(
    useCallback(() => {
      fetchMyClubs()
    }, [])
  )

  async function fetchMyClubs() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: memberships, error: memError } = await supabase
      .from('club_members')
      .select('club_id, role')
      .eq('user_id', user.id)

    if (memError || !memberships || memberships.length === 0) {
      setClubs([])
      setSelectedClub(null)
      setLoading(false)
      return
    }

    const clubIds = memberships.map((m: { club_id: string; role: string }) => m.club_id)
    const roleMap: Record<string, 'admin' | 'member'> = {}
    memberships.forEach((m: { club_id: string; role: string }) => {
      roleMap[m.club_id] = m.role === 'admin' ? 'admin' : 'member'
    })

    const { data: clubData, error: clubError } = await supabase
      .from('clubs')
      .select('id, name, description, location')
      .in('id', clubIds)

    if (clubError || !clubData) { setLoading(false); return }

    const { data: countData } = await supabase
      .from('club_members')
      .select('club_id')
      .in('club_id', clubIds)

    const countMap: Record<string, number> = {}
    ;(countData ?? []).forEach((r: { club_id: string }) => {
      countMap[r.club_id] = (countMap[r.club_id] ?? 0) + 1
    })

    const mapped: Club[] = clubData.map((c: { id: string; name: string; description: string | null; location: string | null }) => ({
      id: c.id,
      name: c.name,
      slug: null,
      description: c.description ?? null,
      location: c.location ?? null,
      memberCount: countMap[c.id] ?? 0,
      userRole: roleMap[c.id] ?? 'member',
    }))

    setClubs(mapped)
    setSelectedClub((prev) => prev ? (mapped.find((c) => c.id === prev.id) ?? mapped[0]) : mapped[0])
    setLoading(false)
  }

  async function createClub() {
    if (!newName.trim() || !newLocation) return
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      Alert.alert('Chyba', 'Nejsi přihlášen.')
      setCreating(false)
      return
    }

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({ name: newName.trim(), description: newDesc.trim() || null, location: newLocation })
      .select('id, name')
      .single()

    if (clubError || !club) {
      Alert.alert('Chyba', clubError?.message ?? 'Nepodařilo se vytvořit klub.')
      setCreating(false)
      return
    }

    const { error: memberError } = await supabase
      .from('club_members')
      .insert({ club_id: club.id, user_id: user.id, role: 'admin' })

    if (memberError) {
      Alert.alert('Chyba', memberError.message)
      setCreating(false)
      return
    }

    const newClub: Club = { id: club.id, name: club.name, slug: null, description: newDesc.trim() || null, location: newLocation, memberCount: 1, userRole: 'admin' }
    setClubs((prev) => [...prev, newClub])
    setSelectedClub(newClub)
    setNewName('')
    setNewDesc('')
    setNewLocation(null)
    setCreateOpen(false)
    setCreating(false)
  }

  function openCreate() {
    setNewName('')
    setNewDesc('')
    setNewLocation(null)
    setCreateOpen(true)
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={COLORS.accent} />
      </View>
    )
  }

  if (clubs.length === 0 || !selectedClub) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏃</Text>
            <Text style={styles.emptyTitle}>Ještě nejsi v žádném klubu</Text>
            <Text style={styles.emptySubtitle}>Přidej se k existujícímu nebo založ vlastní.</Text>
            <TouchableOpacity style={styles.findBtn} onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.findBtnText}>Najít klub</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtnOutline} onPress={openCreate}>
              <Text style={styles.createBtnOutlineText}>+ Vytvořit klub</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <CreateModal
          visible={createOpen}
          name={newName}
          desc={newDesc}
          location={newLocation}
          creating={creating}
          onChangeName={setNewName}
          onChangeDesc={setNewDesc}
          onChangeLocation={setNewLocation}
          onClose={() => setCreateOpen(false)}
          onSubmit={createClub}
        />

        <ClubDetailSheet
          club={detailClub}
          onClose={() => setDetailClub(null)}
          onLeave={async (clubId, isAdmin) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            if (isAdmin) {
              await supabase.from('club_members').delete().eq('club_id', clubId)
              await supabase.from('clubs').delete().eq('id', clubId)
            } else {
              await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', user.id)
            }
            setClubs((prev) => prev.filter((c) => c.id !== clubId))
            setDetailClub(null)
          }}
        />

      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerDecor} />
          <View style={styles.headerTop}>
            <Text style={styles.headerSubtitle}>Tvůj klub</Text>
            <View style={styles.headerButtons}>
              {selectedClub?.userRole === 'admin' && (
                <TouchableOpacity style={styles.headerRunBtn} onPress={() => setShowCreateRun(true)}>
                  <Plus size={14} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.headerRunBtnText}>Vytvořit běh</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.headerCreateBtn} onPress={openCreate}>
                <Plus size={16} color="#FFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {clubs.length === 1 ? (
            <Text style={styles.headerTitle}>{selectedClub.name}</Text>
          ) : (
            <TouchableOpacity style={styles.clubPicker} onPress={() => setDropdownOpen(true)}>
              <Text style={styles.headerTitle}>{selectedClub.name}</Text>
              <ChevronDown size={20} color="#FFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{selectedClub.memberCount}</Text>
              <Text style={styles.statLabel}>členů</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moje kluby</Text>
          {clubs.map((club, i) => (
            <TouchableOpacity
              key={club.id}
              style={[styles.clubCard, i > 0 && styles.clubCardSpaced, club.id === selectedClub.id && styles.clubCardActive]}
              onPress={() => setDetailClub(club)}
            >
              <View style={styles.clubCardLeft}>
                <View style={styles.clubIconWrapper}>
                  <Text style={styles.clubIcon}>🏃</Text>
                </View>
                <View>
                  <Text style={[styles.clubCardName, club.id === selectedClub.id && styles.clubCardNameActive]}>
                    {club.name}
                  </Text>
                  <Text style={styles.clubCardMeta}>{club.memberCount} členů</Text>
                </View>
              </View>
              {club.id === selectedClub.id && (
                <Check size={18} color={COLORS.accent} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.findMoreBtn} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={styles.findMoreText}>+ Najít další klub</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Dropdown pro výběr klubu */}
      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>Vyber klub</Text>
            {clubs.map((club) => (
              <TouchableOpacity
                key={club.id}
                style={[styles.dropdownItem, club.id === selectedClub.id && styles.dropdownItemActive]}
                onPress={() => { setSelectedClub(club); setDropdownOpen(false) }}
              >
                <Text style={[styles.dropdownItemText, club.id === selectedClub.id && styles.dropdownItemTextActive]}>
                  {club.name}
                </Text>
                {club.id === selectedClub.id && (
                  <Check size={16} color={COLORS.accent} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal pro vytvoření klubu */}
      <CreateModal
        visible={createOpen}
        name={newName}
        desc={newDesc}
        location={newLocation}
        creating={creating}
        onChangeName={setNewName}
        onChangeDesc={setNewDesc}
        onChangeLocation={setNewLocation}
        onClose={() => setCreateOpen(false)}
        onSubmit={createClub}
      />

      {/* Detail klubu */}
      <ClubDetailSheet
        club={detailClub}
        onClose={() => setDetailClub(null)}
        onLeave={async (clubId, isAdmin) => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          if (isAdmin) {
            const { error } = await supabase.from('club_members').delete().eq('club_id', clubId)
            if (error) { Alert.alert('Chyba', error.message); return }
            const { error: delErr } = await supabase.from('clubs').delete().eq('id', clubId)
            if (delErr) { Alert.alert('Chyba', delErr.message); return }
          } else {
            const { error } = await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', user.id)
            if (error) { Alert.alert('Chyba', error.message); return }
          }
          const remaining = clubs.filter((c) => c.id !== clubId)
          setClubs(remaining)
          setSelectedClub(remaining[0] ?? null)
          setDetailClub(null)
        }}
      />

      {selectedClub && (
        <CreateRunModal
          visible={showCreateRun}
          adminClubs={[{ id: selectedClub.id, name: selectedClub.name }]}
          onClose={() => setShowCreateRun(false)}
          onCreated={() => {
            setShowCreateRun(false)
            refreshRuns()
          }}
        />
      )}

    </View>
  )
}

type ClubDetailSheetProps = {
  club: Club | null
  onClose: () => void
  onLeave: (clubId: string, isAdmin: boolean) => Promise<void>
}

function ClubDetailSheet({ club, onClose, onLeave }: ClubDetailSheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const [menuOpen, setMenuOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [upcomingRuns, setUpcomingRuns] = useState<ClubRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [showCreateRun, setShowCreateRun] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const { pendingOpenId } = useEventParticipation()
  const { refresh: refreshRuns } = useClubRuns()
  const router = useRouter()

  function openRunOnMap(runId: string) {
    pendingOpenId.current = `cr_${runId}`
    onClose()
    router.navigate('/(tabs)/' as any)
  }

  useEffect(() => {
    if (club) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start()
      fetchUpcomingRuns(club.id)
    } else {
      setMenuOpen(false)
      setUpcomingRuns([])
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start()
    }
  }, [club])

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

  function confirmLeave() {
    if (!club) return
    setMenuOpen(false)
    const isAdmin = club.userRole === 'admin'
    Alert.alert(
      isAdmin ? 'Smazat klub' : 'Opustit klub',
      isAdmin
        ? `Jsi zakladatel klubu „${club.name}". Pokud ho opustíš, klub bude nenávratně smazán včetně všech členů. Opravdu chceš pokračovat?`
        : `Opravdu chceš opustit klub „${club.name}"?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: isAdmin ? 'Smazat klub' : 'Opustit',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true)
            await onLeave(club.id, isAdmin)
            setLeaving(false)
          },
        },
      ],
    )
  }

  if (!club) return null

  return (
    <Animated.View style={[styles.detailOverlay, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.detailTopBar}>
          <TouchableOpacity style={styles.detailMenuBtn} onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MoreVertical size={20} color={COLORS.muted} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.detailTopRight}>
            <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setShowShare(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Share2 size={20} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          <View style={styles.detailIconWrapper}>
            <Text style={styles.detailIcon}>🏃</Text>
          </View>

          <Text style={styles.detailName}>{club.name}</Text>

          {club.description ? (
            <Text style={styles.detailDesc}>{club.description}</Text>
          ) : (
            <Text style={styles.detailDescEmpty}>Bez popisu</Text>
          )}

          <View style={styles.detailStatsRow}>
            <View style={styles.detailStat}>
              <Users size={16} color={COLORS.accent} strokeWidth={2} />
              <Text style={styles.detailStatText}>{club.memberCount} členů</Text>
            </View>
            {club.location && (
              <View style={styles.detailStat}>
                <MapPin size={16} color={COLORS.accent} strokeWidth={2} />
                <Text style={styles.detailStatText}>{club.location}</Text>
              </View>
            )}
          </View>

          {/* Nadcházející běhy */}
          <Text style={styles.detailSectionTitle}>Nadcházející běhy</Text>
          <View style={styles.runsCard}>
            {runsLoading ? (
              <View style={styles.runsRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : upcomingRuns.length === 0 ? (
              <View style={styles.runsRow}>
                <Text style={styles.runsEmpty}>Žádné nadcházející běhy</Text>
              </View>
            ) : (
              upcomingRuns.map((run, i) => {
                const { label, isToday } = formatUpcomingWhen(run.starts_at)
                const stats = [
                  run.distance_km != null ? `${run.distance_km} km` : null,
                  run.pace_text ? `${run.pace_text} /km` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <TouchableOpacity
                    key={run.id}
                    style={[styles.runsRow, i < upcomingRuns.length - 1 && styles.runsRowBorder]}
                    onPress={() => openRunOnMap(run.id)}
                    activeOpacity={0.65}
                  >
                    <View style={[styles.runsDot, !isToday && { backgroundColor: COLORS.muted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.runsName}>{run.title}</Text>
                      {(RUN_TYPE_LABELS[run.run_type] || stats) ? (
                        <Text style={styles.runsMeta}>
                          {[RUN_TYPE_LABELS[run.run_type], stats].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.runsWhen}>{label} ›</Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
          <View style={{ height: 8 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Akční menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{club.name}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={confirmLeave}
              disabled={leaving}
            >
              <LogOut size={18} color="#EF4444" strokeWidth={2} />
              <Text style={styles.menuItemTextDanger}>Opustit klub</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {club.userRole === 'admin' && (
        <TouchableOpacity style={styles.detailCreateRunBtn} onPress={() => setShowCreateRun(true)}>
          <Plus size={14} color="#FFF" strokeWidth={2.5} />
          <Text style={styles.detailCreateRunBtnText}>Vytvořit běh</Text>
        </TouchableOpacity>
      )}

      <CreateRunModal
        visible={showCreateRun}
        adminClubs={[{ id: club.id, name: club.name }]}
        onClose={() => setShowCreateRun(false)}
        onCreated={() => {
          setShowCreateRun(false)
          refreshRuns()
          fetchUpcomingRuns(club.id)
        }}
      />

      <ShareSheet
        visible={showShare}
        club={club}
        onClose={() => setShowShare(false)}
        // TODO: předat ref ClubStoryCard až bude react-native-view-shot nainstalován
        onShareStory={() => { setShowShare(false); shareStoryCard(null) }}
      />
    </Animated.View>
  )
}

type CreateModalProps = {
  visible: boolean
  name: string
  desc: string
  location: string | null
  creating: boolean
  onChangeName: (v: string) => void
  onChangeDesc: (v: string) => void
  onChangeLocation: (v: string) => void
  onClose: () => void
  onSubmit: () => void
}

function CreateModal({ visible, name, desc, location, creating, onChangeName, onChangeDesc, onChangeLocation, onClose, onSubmit }: CreateModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const [showLocationList, setShowLocationList] = useState(false)
  const canSubmit = name.trim() && location && !creating

  useEffect(() => {
    if (visible) {
      setShowLocationList(false)
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start()
    }
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[styles.createOverlay, { transform: [{ translateY: slideAnim }] }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.createBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.createSheet}>
          <View style={styles.createHeader}>
            <Text style={styles.createTitle}>Nový klub</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {showLocationList ? (
            <>
              <View style={styles.locationSheetHeader}>
                <Text style={styles.locationSheetTitle}>Vyber lokalitu</Text>
                <TouchableOpacity onPress={() => setShowLocationList(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={COLORS.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}>
                {LOCATIONS.map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[styles.locationOption, location === loc && styles.locationOptionActive]}
                    onPress={() => { onChangeLocation(loc); setShowLocationList(false) }}
                  >
                    <Text style={[styles.locationOptionText, location === loc && styles.locationOptionTextActive]}>
                      {loc}
                    </Text>
                    {location === loc && <Check size={16} color={COLORS.accent} strokeWidth={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Název klubu *</Text>
              <TextInput
                style={styles.input}
                placeholder="např. Vinohrady Runners"
                placeholderTextColor={COLORS.muted}
                value={name}
                onChangeText={onChangeName}
                returnKeyType="next"
              />

              <Text style={styles.inputLabel}>Město / čtvrť *</Text>
              <TouchableOpacity style={styles.locationPicker} onPress={() => setShowLocationList(true)}>
                <MapPin size={16} color={location ? COLORS.accent : COLORS.muted} strokeWidth={2} />
                <Text style={[styles.locationPickerText, !location && styles.locationPickerPlaceholder]}>
                  {location ?? 'Vyber lokalitu…'}
                </Text>
                <ChevronDown size={16} color={COLORS.muted} strokeWidth={2} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Popis (volitelné)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Pár slov o vašem klubu…"
                placeholderTextColor={COLORS.muted}
                value={desc}
                onChangeText={onChangeDesc}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={onSubmit}
                disabled={!canSubmit}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Vytvořit klub</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  headerSafe: {
    backgroundColor: COLORS.accent,
  },
  header: {
    backgroundColor: COLORS.accent,
    padding: 20,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerRunBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  headerCreateBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  clubPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 12,
  },
  stat: {
    gap: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  scroll: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  clubCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
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
  clubCardSpaced: {
    marginTop: 10,
  },
  clubCardActive: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
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
  clubCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  clubCardNameActive: {
    color: COLORS.accent,
  },
  clubCardMeta: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  findMoreBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  findMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 24,
  },
  findBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginBottom: 10,
  },
  findBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  createBtnOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  createBtnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    margin: 16,
    marginBottom: 40,
    padding: 8,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.accentSoft,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  dropdownItemTextActive: {
    color: COLORS.accent,
  },
  createOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  createBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  createSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 16,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  locationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  locationPickerText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  locationPickerPlaceholder: {
    color: COLORS.muted,
  },
  locationSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  locationSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  locationOptionActive: {
    backgroundColor: COLORS.accentSoft,
  },
  locationOptionText: {
    fontSize: 15,
    color: COLORS.text,
  },
  locationOptionTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    zIndex: 10,
  },
  detailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCreateRunBtn: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    zIndex: 5,
  },
  detailCreateRunBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  menuSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    margin: 16,
    marginBottom: 40,
    padding: 8,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
  },
  menuItemTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  detailContent: {
    padding: 24,
    paddingTop: 8,
  },
  detailIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  detailIcon: {
    fontSize: 36,
  },
  detailName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  detailDesc: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  detailDescEmpty: {
    fontSize: 14,
    color: COLORS.border,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  detailStatsRow: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  detailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailSectionTitle: {
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
})
