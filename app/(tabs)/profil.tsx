import { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, Bell, Lock, LogOut, ChevronRight } from 'lucide-react-native'
import { COLORS } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { useEventParticipation } from '../../contexts/eventParticipation'
import { useFocusEffect } from 'expo-router'

const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const TODAY = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

const SETTINGS = [
  { icon: User, label: 'Upravit profil', danger: false },
  { icon: Bell, label: 'Notifikace', danger: false },
  { icon: Lock, label: 'Soukromí', danger: false },
  { icon: LogOut, label: 'Odhlásit se', danger: true },
]

type Profile = {
  full_name: string
  email: string
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

export default function ProfilScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { myEvents, loaded: eventsLoaded } = useEventParticipation()
  const [myClubRunEvents, setMyClubRunEvents] = useState<{ id: string; name: string; starts_at: string }[]>([])

  useFocusEffect(
    useCallback(() => {
      async function fetchMyClubRuns() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('club_run_participants')
          .select('club_runs(id, title, starts_at)')
          .eq('user_id', user.id)
        if (data) {
          setMyClubRunEvents(
            (data as any[])
              .map((r) => r.club_runs)
              .filter(Boolean)
              .map((r: { id: string; title: string; starts_at: string }) => ({
                id: `cr_${r.id}`,
                name: r.title,
                starts_at: r.starts_at,
              }))
          )
        }
      }
      fetchMyClubRuns()
    }, [])
  )

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

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      setProfile({
        full_name: data?.full_name ?? user.user_metadata?.full_name ?? '',
        email: user.email ?? '',
      })
      setLoading(false)
    }

    fetchProfile()
  }, [])

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

        {/* Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Můj kalendář</Text>
          <View style={styles.card}>
            <View style={styles.calendarRow}>
              {DAYS.map((day, i) => {
                const isToday = i === TODAY
                const hasRun = upcomingRuns.some((run) => {
                  const d = new Date(run.startsAt)
                  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
                  return dow === i
                })
                return (
                  <View key={day} style={styles.calendarDay}>
                    <Text style={[styles.calendarDayLabel, isToday && styles.calendarDayLabelActive]}>
                      {day}
                    </Text>
                    <View style={[
                      styles.calendarDot,
                      hasRun && styles.calendarDotRun,
                      isToday && styles.calendarDotToday,
                    ]}>
                      {isToday && <View style={styles.calendarDotInner} />}
                    </View>
                  </View>
                )
              })}
            </View>
            <View style={styles.calendarLegend}>
              <View style={styles.calendarLegendItem}>
                <View style={[styles.calendarDot, styles.calendarDotRun, { width: 8, height: 8 }]} />
                <Text style={styles.calendarLegendText}>plánovaný běh</Text>
              </View>
              <View style={styles.calendarLegendItem}>
                <View style={[styles.calendarDot, styles.calendarDotToday, { width: 8, height: 8 }]} />
                <Text style={styles.calendarLegendText}>dnes</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          {SETTINGS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.settingsRow}
              onPress={item.label === 'Odhlásit se' ? handleSignOut : undefined}
              activeOpacity={0.7}
            >
              <View style={styles.settingsIcon}>
                <item.icon size={16} color={COLORS.muted} strokeWidth={1.8} />
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
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  calendarDay: {
    alignItems: 'center',
    gap: 8,
  },
  calendarDayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.muted,
  },
  calendarDayLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  calendarDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDotRun: {
    backgroundColor: COLORS.accentSoft,
  },
  calendarDotToday: {
    backgroundColor: COLORS.accent,
  },
  calendarDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  calendarLegend: {
    flexDirection: 'row',
    gap: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarLegendText: {
    fontSize: 11,
    color: COLORS.muted,
  },
})
