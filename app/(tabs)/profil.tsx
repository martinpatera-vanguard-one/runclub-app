import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { User, Bell, Lock, LogOut, ChevronRight } from 'lucide-react-native'
import { COLORS } from '../../constants/theme'

const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const TODAY = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
const RUN_DAYS = [0, 2, 4]

const UPCOMING = [
  { name: 'Letná Loop', when: 'Dnes 18:30', accent: true },
  { name: 'Weekend long run', when: 'So 8:00', accent: false },
]

const SETTINGS = [
  { icon: User, label: 'Upravit profil', danger: false },
  { icon: Bell, label: 'Notifikace', danger: false },
  { icon: Lock, label: 'Soukromí', danger: false },
  { icon: LogOut, label: 'Odhlásit se', danger: true },
]

export default function ProfilScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.profileTop}>
          <View style={styles.avatarBig}>
            <Text style={styles.avatarLetter}>M</Text>
          </View>
          <Text style={styles.profileName}>Marek Novák</Text>
          <Text style={styles.profileClub}>
            Home klub:{' '}
            <Text style={{ color: COLORS.accent, fontWeight: '600' }}>Letňáci Run Club</Text>
          </Text>
        </View>

        <View style={{ height: 12 }} />

        {/* Upcoming runs */}
        <View style={styles.section}>
          <Text style={styles.upcomingLabel}>Moje nadcházející běhy</Text>
          <View style={styles.upcomingCard}>
            {UPCOMING.map((run, i) => (
              <View
                key={run.name}
                style={[styles.upcomingRow, i < UPCOMING.length - 1 && styles.upcomingRowBorder]}
              >
                <View
                  style={[styles.upcomingDot, !run.accent && { backgroundColor: COLORS.muted }]}
                />
                <Text style={styles.upcomingName}>{run.name}</Text>
                <Text style={styles.upcomingWhen}>{run.when}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <Text style={styles.upcomingLabel}>Můj kalendář</Text>
          <View style={styles.calendarCard}>
            <View style={styles.calendarRow}>
              {DAYS.map((day, i) => {
                const isToday = i === TODAY
                const hasRun = RUN_DAYS.includes(i)
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
            <TouchableOpacity key={item.label} style={styles.settingsRow}>
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
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
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
  profileClub: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  upcomingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  upcomingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  upcomingRowBorder: {
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
  calendarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginTop: 12,
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
