import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MapPin, Search, Users, User } from 'lucide-react-native'
import { COLORS } from '../../constants/theme'
import { EventParticipationProvider } from '../../contexts/eventParticipation'
import { ClubRunsProvider } from '../../contexts/clubRuns'

type TabIconProps = {
  icon: React.ReactNode
  label: string
  focused: boolean
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      {icon}
      <Text style={[styles.tabText, focused && styles.tabTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <EventParticipationProvider>
      <ClubRunsProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: styles.tabBar,
            tabBarShowLabel: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={<MapPin size={22} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
                  label="Mapa"
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={<Search size={22} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
                  label="Najít"
                  focused={focused}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="klub"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={<Users size={22} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
                  label="Klub"
                  focused={focused}
                />
              ),
            }}
          />
          {/* after-run tab — skryto pro MVP, soubor after-run.tsx zůstává */}
          <Tabs.Screen
            name="after-run"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="profil"
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  icon={<User size={22} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
                  label="Profil"
                  focused={focused}
                />
              ),
            }}
          />
        </Tabs>
      </ClubRunsProvider>
    </EventParticipationProvider>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 84,
    paddingBottom: 16,
    paddingTop: 10,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.muted,
    flexShrink: 0,
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
})
