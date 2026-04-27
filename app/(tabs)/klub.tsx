import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/theme'

const MEMBERS = [
  { letter: 'M', name: 'Marek', bg: '#FFE5DC', color: COLORS.accent },
  { letter: 'K', name: 'Klára', bg: '#E8F4FF', color: '#3B82F6' },
  { letter: 'J', name: 'Jana', bg: '#F0FFF4', color: '#22C55E' },
  { letter: 'T', name: 'Tomáš', bg: '#FFF7E6', color: '#F59E0B' },
]

const WEEK_RUNS = [
  { day: 'Čt', name: 'Čtvrteční social run', time: '19:00 · Letná park', count: 8, active: true },
  { day: 'So', name: 'Weekend long run', time: '8:00 · Stromovka', count: 3, active: false },
]

export default function KlubScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerDecor} />
          <Text style={styles.headerSubtitle}>Tvůj klub</Text>
          <Text style={styles.headerTitle}>Letňáci Run Club</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>47</Text>
              <Text style={styles.statLabel}>členů</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>3</Text>
              <Text style={styles.statLabel}>běhy tento týden</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Today's run */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dnešní běh</Text>
          <View style={styles.todayCard}>
            <View>
              <Text style={styles.todayTime}>18:30</Text>
              <Text style={styles.todayAmpm}>dnes</Text>
            </View>
            <View style={styles.todayInfo}>
              <Text style={styles.todayName}>Letná Loop</Text>
              <Text style={styles.todayWhere}>📍 Hanavský pavilon</Text>
            </View>
            <TouchableOpacity style={styles.rsvpPill}>
              <Text style={styles.rsvpText}>Jdu ✓</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Who's going */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kdo jde</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>Všichni →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.membersRow}>
            {MEMBERS.map((m) => (
              <View key={m.name} style={styles.memberItem}>
                <View style={[styles.memberAvatar, { backgroundColor: m.bg }]}>
                  <Text style={[styles.memberLetter, { color: m.color }]}>{m.letter}</Text>
                </View>
                <Text style={styles.memberName}>{m.name}</Text>
              </View>
            ))}
            <View style={styles.memberItem}>
              <View style={[styles.memberAvatar, { backgroundColor: COLORS.bg }]}>
                <Text style={[styles.memberLetter, { color: COLORS.muted }]}>+8</Text>
              </View>
              <Text style={styles.memberName}>dalších</Text>
            </View>
          </View>
        </View>

        {/* This week */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tento týden</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAction}>+ Přidat běh</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekCard}>
            {WEEK_RUNS.map((run, i) => (
              <View
                key={run.day}
                style={[styles.weekRow, i < WEEK_RUNS.length - 1 && styles.weekRowBorder]}
              >
                <View style={[styles.dayBadge, !run.active && styles.dayBadgeInactive]}>
                  <Text style={[styles.dayText, !run.active && styles.dayTextInactive]}>
                    {run.day}
                  </Text>
                </View>
                <View style={styles.weekInfo}>
                  <Text style={styles.weekRunName}>{run.name}</Text>
                  <Text style={styles.weekRunTime}>{run.time}</Text>
                </View>
                <Text style={[styles.weekCount, !run.active && styles.weekCountInactive]}>
                  {run.count}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  sectionAction: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '500',
  },
  todayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  todayTime: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.accent,
    lineHeight: 30,
  },
  todayAmpm: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
  },
  todayInfo: {
    flex: 1,
  },
  todayName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  todayWhere: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  rsvpPill: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rsvpText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },
  membersRow: {
    flexDirection: 'row',
    gap: 14,
  },
  memberItem: {
    alignItems: 'center',
    gap: 4,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 11,
    color: COLORS.muted,
  },
  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  weekRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeInactive: {
    backgroundColor: COLORS.bg,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  dayTextInactive: {
    color: COLORS.muted,
  },
  weekInfo: {
    flex: 1,
  },
  weekRunName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  weekRunTime: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  weekCount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  weekCountInactive: {
    color: COLORS.muted,
  },
})
