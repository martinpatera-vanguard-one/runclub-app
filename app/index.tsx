import { View } from 'react-native'
import { COLORS } from '../constants/theme'

// Prázdná obrazovka — přesměrování řeší onAuthStateChange v app/_layout.tsx
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />
}
