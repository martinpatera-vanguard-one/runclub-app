import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { MapPin, Search, Users, Coffee, User } from 'lucide-react-native'
import { COLORS } from '../../constants/theme'

type TabIconProps = {
  icon: React.ReactNode
  label: string
  focused: boolean
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      {icon}
      <Text style={[styles.tabText, focused && styles.tabTextActive]}>{label}</Text>
    </View>
  )
}

export default function TabLayout() {
  return (
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
              icon={<MapPin size={20} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
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
              icon={<Search size={20} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
              label="Explore"
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
              icon={<Users size={20} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
              label="Klub"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="after-run"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<Coffee size={20} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
              label="After-run"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              icon={<User size={20} color={focused ? COLORS.accent : COLORS.muted} strokeWidth={1.8} />}
              label="Profil"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 3,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.muted,
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: COLORS.accent,
  },
})
