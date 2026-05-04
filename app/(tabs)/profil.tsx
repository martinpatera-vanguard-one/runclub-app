import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, Linking } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, Bell, Lock, LogOut, ChevronRight, ChevronLeft, CalendarDays, X, Zap, Route } from 'lucide-react-native'
import { COLORS } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { useEventParticipation } from '../../contexts/eventParticipation'
import { useFocusEffect, useRouter } from 'expo-router'

const WEEK_DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const RUN_TYPE_LABELS: Record<string, string> = {
  longrun: 'Dlouhý běh',
  tempo: 'Tempo',
  interval: 'Interval',
  sprint: 'Sprint',
  recovery: 'Regenerační',
  fartlek: 'Fartlek',
}

function parsePaceText(t: string | null): number | null {
  if (!t) return null
  const parts = t.split(':')
  if (parts.length !== 2) return null
  const m = parseInt(parts[0], 10)
  const s = parseInt(parts[1], 10)
  return isNaN(m) || isNaN(s) ? null : m * 60 + s
}

function formatPace(sec: number | null): string | null {
  if (sec == null) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')} /km`
}
const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

const SETTINGS = [
  { icon: User, label: 'Upravit profil', danger: false },
  { icon: CalendarDays, label: 'Můj kalendář', danger: false },
  { icon: Bell, label: 'Notifikace', danger: false },
  { icon: Lock, label: 'Soukromí', danger: false },
  { icon: LogOut, label: 'Odhlásit se', danger: true },
]

type Profile = {
  full_name: string
  email: string
  avatar_url: string | null
}

type UpcomingRun = {
  id: string
  name: string
  when: string
  isToday: boolean
  startsAt: string
}

function formatUpcomingWhen(startsAt: string): { label: string; isToday: boolean } {
  const date = new Date(startsAt)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

  if (date.toDateString() === today.toDateString()) return { label: `Dnes ${time}`, isToday: true }
  if (date.toDateString() === tomorrow.toDateString()) return { label: `Zítra ${time}`, isToday: false }

  const weekday = date.toLocaleDateString('cs-CZ', { weekday: 'short' })
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  return { label: `${capitalized} ${time}`, isToday: false }
}

function formatSelectedDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Dnes'
  if (date.toDateString() === tomorrow.toDateString()) return 'Zítra'
  return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstWeekday(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

export default function ProfilScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() }
  })
  const { myEvents, loaded: eventsLoaded, pendingOpenId } = useEventParticipation()
  const router = useRouter()

  function openOnMap(runId: string) {
    pendingOpenId.current = runId
    setShowCalendar(false)
    router.navigate('/' as any)
  }
  const [myClubRunEvents, setMyClubRunEvents] = useState<{
    id: string; name: string; starts_at: string
    distance_km: number | null; pace_sec_km: number | null; run_type: string | null
  }[]>([])
  const [eventDetails, setEventDetails] = useState<Map<string, { distance_km: number | null; pace_sec_km: number | null }>>(new Map())

  useFocusEffect(
    useCallback(() => {
      async function fetchMyClubRuns() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('club_run_participants')
          .select('club_runs(id, title, starts_at, distance_km, pace_text, run_type)')
          .eq('user_id', user.id)
        if (data) {
          setMyClubRunEvents(
            (data as any[])
              .map((r) => r.club_runs)
              .filter(Boolean)
              .map((r: { id: string; title: string; starts_at: string; distance_km: number | null; pace_text: string | null; run_type: string | null }) => ({
                id: `cr_${r.id}`,
                name: r.title,
                starts_at: r.starts_at,
                distance_km: r.distance_km ?? null,
                pace_sec_km: parsePaceText(r.pace_text),
                run_type: r.run_type ?? null,
              }))
          )
        }
      }
      fetchMyClubRuns()
    }, [])
  )

  useEffect(() => {
    if (!eventsLoaded || myEvents.length === 0) return
    const ids = myEvents.map((e) => e.id)
    supabase
      .from('events')
      .select('id, distance_km, pace_sec_km')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, { distance_km: number | null; pace_sec_km: number | null }>()
        data.forEach((e: { id: string; distance_km: number | null; pace_sec_km: number | null }) =>
          map.set(e.id, { distance_km: e.distance_km ?? null, pace_sec_km: e.pace_sec_km ?? null })
        )
        setEventDetails(map)
      })
  }, [myEvents, eventsLoaded])

  const upcomingRuns = useMemo<UpcomingRun[]>(() => {
    const now = new Date()
    const fromEvents = myEvents
      .filter((e) => new Date(e.starts_at) >= now)
      .map((e) => ({ id: e.id, name: e.name, starts_at: e.starts_at }))
    const fromClubRuns = myClubRunEvents.filter((r) => new Date(r.starts_at) >= now)

    return [...fromEvents, ...fromClubRuns]
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .map((e) => {
        const { label, isToday } = formatUpcomingWhen(e.starts_at)
        return { id: e.id, name: e.name, when: label, isToday, startsAt: e.starts_at }
      })
  }, [myEvents, myClubRunEvents])

  const runDateKeys = useMemo(() => {
    const keys = new Set<string>()
    ;[...myEvents, ...myClubRunEvents].forEach((e) => {
      const d = new Date(e.starts_at)
      keys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    })
    return keys
  }, [myEvents, myClubRunEvents])

  const runsForSelectedDay = useMemo(() => {
    const combined = [
      ...myEvents.map((e) => {
        const det = eventDetails.get(e.id)
        return {
          id: e.id, name: e.name, starts_at: e.starts_at,
          distance_km: det?.distance_km ?? null,
          pace_sec_km: det?.pace_sec_km ?? null,
          run_type: null as string | null,
        }
      }),
      ...myClubRunEvents.map((r) => ({
        id: r.id, name: r.name, starts_at: r.starts_at,
        distance_km: r.distance_km,
        pace_sec_km: r.pace_sec_km,
        run_type: r.run_type,
      })),
    ]
    return combined
      .filter((e) => {
        const d = new Date(e.starts_at)
        return (
          d.getFullYear() === selectedDay.year &&
          d.getMonth() === selectedDay.month &&
          d.getDate() === selectedDay.day
        )
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }, [myEvents, myClubRunEvents, eventDetails, selectedDay])

  useFocusEffect(
    useCallback(() => {
      async function fetchProfile() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()

        setProfile({
          full_name: data?.full_name ?? user.user_metadata?.full_name ?? '',
          email: user.email ?? '',
          avatar_url: data?.avatar_url ?? null,
        })
        setLoading(false)
      }

      fetchProfile()
    }, [])
  )

  const handleSignOut = () => {
    Alert.alert('Odhlásit se', 'Opravdu se chceš odhlásit?', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Odhlásit',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ])
  }

  const avatarLetter = profile?.full_name?.charAt(0).toUpperCase() ?? '?'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.profileTop}>
          <View style={styles.avatarBig}>
            {loading ? (
              <ActivityIndicator color={COLORS.accent} size="small" />
            ) : profile?.avatar_url ? (
              <ExpoImage
                source={{ uri: profile.avatar_url }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            )}
          </View>

          {loading ? (
            <>
              <View style={styles.skeletonName} />
              <View style={styles.skeletonEmail} />
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{profile?.full_name}</Text>
              <Text style={styles.profileEmail}>{profile?.email}</Text>
            </>
          )}
        </View>

        <View style={{ height: 12 }} />

        {/* Upcoming runs */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Moje nadcházející běhy</Text>
          <View style={styles.card}>
            {!eventsLoaded ? (
              <View style={styles.upcomingRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
              </View>
            ) : upcomingRuns.length === 0 ? (
              <View style={styles.upcomingRow}>
                <Text style={styles.upcomingEmpty}>Žádné nadcházející běhy</Text>
              </View>
            ) : (
              upcomingRuns.map((run, i) => (
                <View
                  key={run.id}
                  style={[styles.upcomingRow, i < upcomingRuns.length - 1 && styles.rowBorder]}
                >
                  <View style={[styles.upcomingDot, !run.isToday && { backgroundColor: COLORS.muted }]} />
                  <Text style={styles.upcomingName}>{run.name}</Text>
                  <Text style={styles.upcomingWhen}>{run.when}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          {SETTINGS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.settingsRow}
              onPress={
                item.label === 'Odhlásit se' ? handleSignOut :
                item.label === 'Můj kalendář' ? () => setShowCalendar(true) :
                item.label === 'Upravit profil' ? () => router.push('/edit-profil') :
                item.label === 'Notifikace' ? () => Linking.openSettings() :
                undefined
              }
              activeOpacity={0.7}
            >
              <View style={styles.settingsIcon}>
                <item.icon size={16} color={item.danger ? '#EF4444' : COLORS.muted} strokeWidth={1.8} />
              </View>
              <Text style={[styles.settingsLabel, item.danger && styles.settingsLabelDanger]}>
                {item.label}
              </Text>
              <ChevronRight size={16} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={showCalendar} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCalendar(false)}>
        <SafeAreaView style={styles.calModalContainer} edges={['top']}>
          <View style={styles.calModalHeader}>
            <TouchableOpacity onPress={() => setShowCalendar(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={COLORS.muted} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.calModalTitle}>Můj kalendář</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.calNavRow}>
              <TouchableOpacity
                onPress={() => setCalendarDate((d) => {
                  const m = d.month === 0 ? 11 : d.month - 1
                  const y = d.month === 0 ? d.year - 1 : d.year
                  return { year: y, month: m }
                })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronLeft size={22} color={COLORS.text} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.calNavTitle}>
                {MONTH_NAMES[calendarDate.month]} {calendarDate.year}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarDate((d) => {
                  const m = d.month === 11 ? 0 : d.month + 1
                  const y = d.month === 11 ? d.year + 1 : d.year
                  return { year: y, month: m }
                })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ChevronRight size={22} color={COLORS.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {WEEK_DAYS.map((d) => (
                <Text key={d} style={styles.calWeekDay}>{d}</Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {(() => {
                const { year, month } = calendarDate
                const firstDay = getFirstWeekday(year, month)
                const daysInMonth = getDaysInMonth(year, month)
                const today = new Date()
                const cells: React.ReactNode[] = []

                for (let i = 0; i < firstDay; i++) {
                  cells.push(<View key={`e${i}`} style={styles.calCell} />)
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const isToday =
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === day
                  const hasRun = runDateKeys.has(`${year}-${month}-${day}`)
                  const isSelected =
                    selectedDay.year === year &&
                    selectedDay.month === month &&
                    selectedDay.day === day

                  cells.push(
                    <TouchableOpacity
                      key={day}
                      style={styles.calCell}
                      onPress={() => setSelectedDay({ year, month, day })}
                      activeOpacity={0.6}
                    >
                      <View style={[
                        styles.calDayCircle,
                        isSelected && !hasRun && !isToday && styles.calDayCircleSelected,
                        hasRun && styles.calDayCircleRun,
                        isToday && !hasRun && styles.calDayCircleToday,
                        isToday && hasRun && styles.calDayCircleBoth,
                      ]}>
                        <Text style={[
                          styles.calDayText,
                          hasRun && styles.calDayTextRun,
                          isToday && !hasRun && styles.calDayTextToday,
                        ]}>
                          {day}
                        </Text>
                        {isToday && hasRun && <View style={styles.calTodayDot} />}
                      </View>
                    </TouchableOpacity>
                  )
                }

                return cells
              })()}
            </View>

            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendSwatch, styles.calLegendSwatchToday]} />
                <Text style={styles.calLegendText}>Dnes</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calLegendSwatch, styles.calLegendSwatchRun]} />
                <Text style={styles.calLegendText}>Přihlášený běh</Text>
              </View>
            </View>

            <View style={styles.calDayDetail}>
              {runsForSelectedDay.length === 0 ? (
                <>
                  <Text style={styles.calDayDetailTitle}>
                    {formatSelectedDate(selectedDay.year, selectedDay.month, selectedDay.day)}
                  </Text>
                  <Text style={styles.calDayDetailEmpty}>
                    {formatSelectedDate(selectedDay.year, selectedDay.month, selectedDay.day) === 'Dnes'
                      ? 'Dnes žádný běh'
                      : 'V tento den žádný běh'}
                  </Text>
                </>
              ) : (
                runsForSelectedDay.map((run, idx) => {
                  const statParts: React.ReactNode[] = []
                  if (run.run_type != null) {
                    statParts.push(
                      <Text key="type" style={styles.calDayDetailStatText}>
                        {RUN_TYPE_LABELS[run.run_type] ?? run.run_type}
                      </Text>
                    )
                  }
                  if (run.distance_km != null) {
                    statParts.push(
                      <View key="dist" style={styles.calDayDetailStatChip}>
                        <Route size={11} color={COLORS.muted} strokeWidth={1.5} />
                        <Text style={styles.calDayDetailStatText}>{run.distance_km} km</Text>
                      </View>
                    )
                  }
                  if (run.pace_sec_km != null) {
                    statParts.push(
                      <View key="pace" style={styles.calDayDetailStatChip}>
                        <Zap size={11} color={COLORS.muted} strokeWidth={1.5} />
                        <Text style={styles.calDayDetailStatText}>{formatPace(run.pace_sec_km)}</Text>
                      </View>
                    )
                  }
                  return (
                    <React.Fragment key={run.id}>
                      <View style={styles.calDayDetailTitleRow}>
                        <Text style={styles.calDayDetailTitle}>
                          {idx === 0
                            ? formatSelectedDate(selectedDay.year, selectedDay.month, selectedDay.day)
                            : ''}
                        </Text>
                        {statParts.length > 0 && idx === 0 && (
                          <View style={styles.calDayDetailStats}>{statParts}</View>
                        )}
                      </View>
                      <TouchableOpacity style={styles.calDayDetailRow} onPress={() => openOnMap(run.id)} activeOpacity={0.6}>
                        <View style={styles.calDayDetailDot} />
                        <Text style={styles.calDayDetailName}>{run.name}</Text>
                        <Text style={styles.calDayDetailTime}>
                          {new Date(run.starts_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                      {idx > 0 && statParts.length > 0 && (
                        <View style={styles.calDayDetailStats}>{statParts}</View>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  profileTop: {
    backgroundColor: COLORS.surface,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 4,
  },
  avatarBig: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarLetter: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.accent,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  skeletonName: {
    width: 140,
    height: 20,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  skeletonEmail: {
    width: 180,
    height: 14,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    padding: 0,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  upcomingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    flexShrink: 0,
  },
  upcomingName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  upcomingWhen: {
    fontSize: 13,
    color: COLORS.muted,
  },
  upcomingEmpty: {
    fontSize: 13,
    color: COLORS.muted,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  settingsLabelDanger: {
    color: '#EF4444',
  },
  calModalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  calModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  calModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  calNavTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  calWeekRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  calWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    paddingBottom: 8,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  calDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCircleSelected: {
    backgroundColor: COLORS.surface,
  },
  calDayCircleRun: {
    backgroundColor: COLORS.accent,
  },
  calDayCircleToday: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  calDayCircleBoth: {
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.accent,
    gap: 1,
  },
  calDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  calDayTextRun: {
    color: '#FFF',
    fontWeight: '700',
  },
  calDayTextToday: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  calTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  calLegend: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginHorizontal: 16,
    marginTop: 8,
  },
  calLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calLegendSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  calLegendSwatchToday: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  calLegendSwatchRun: {
    backgroundColor: COLORS.accent,
  },
  calLegendText: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '500',
  },
  calDayDetail: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  calDayDetailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calDayDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  calDayDetailEmpty: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
  calDayDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  calDayDetailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    flexShrink: 0,
  },
  calDayDetailName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  calDayDetailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calDayDetailStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  calDayDetailStatText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  calDayDetailTime: {
    fontSize: 13,
    color: COLORS.muted,
    flexShrink: 0,
  },
})
