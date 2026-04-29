import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
} from 'react-native'
import { useEffect, useRef } from 'react'
import { Share } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Link2, Share2, ImagePlay, X } from 'lucide-react-native'
import { COLORS } from '../constants/theme'

const SCREEN_HEIGHT = Dimensions.get('window').height

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export type ShareClub = {
  id: string
  name: string
  slug?: string | null
  location?: string | null
  memberCount?: number
}

type Props = {
  visible: boolean
  club: ShareClub
  onClose: () => void
  onShareStory: () => void
}

export function ShareSheet({ visible, club, onClose, onShareStory }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  if (!visible) return null

  const slug = club.slug ?? toSlug(club.name)
  const url = `https://runclub.app/k/${slug}`

  async function handleCopy() {
    await Clipboard.setStringAsync(url)
    Alert.alert('Zkopírováno', 'Odkaz byl zkopírován do schránky.')
    onClose()
  }

  async function handleShare() {
    await Share.share({
      message: `Běháme spolu v ${club.name} 🏃 Přidej se! ${url}`,
      url,
    })
    onClose()
  }

  function handleStory() {
    onClose()
    onShareStory()
  }

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Sdílet klub</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={COLORS.muted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.clubRow}>
          <View style={styles.clubIcon}>
            <Text style={styles.clubEmoji}>🏃</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clubName}>{club.name}</Text>
            <Text style={styles.clubUrl} numberOfLines={1}>{url}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.option} onPress={handleCopy} activeOpacity={0.7}>
          <View style={styles.optionIcon}>
            <Link2 size={20} color={COLORS.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Kopírovat odkaz</Text>
            <Text style={styles.optionSub}>Zkopíruje odkaz do schránky</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={handleShare} activeOpacity={0.7}>
          <View style={styles.optionIcon}>
            <Share2 size={20} color={COLORS.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Sdílet odkaz</Text>
            <Text style={styles.optionSub}>Přes zprávy, email, sociální sítě…</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.option, styles.optionLast]} onPress={handleStory} activeOpacity={0.7}>
          <View style={styles.optionIcon}>
            <ImagePlay size={20} color={COLORS.accent} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Story karta</Text>
            <Text style={styles.optionSub}>Sdílej grafickou pozvánku do Stories</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  clubIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubEmoji: {
    fontSize: 22,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  clubUrl: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  optionLast: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
})
