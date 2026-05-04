import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Camera, ChevronLeft } from 'lucide-react-native'
import { COLORS } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { pickAndUploadAvatar } from '../lib/uploadAvatar'

export default function EditProfilScreen() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      setFullName(data?.full_name ?? user.user_metadata?.full_name ?? '')
      if (data?.avatar_url) setAvatarUri(data.avatar_url)
    }
    load()
  }, [])

  const avatarInitials = fullName
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()

  function handleAvatarPress() {
    Alert.alert('Foto profilu', undefined, [
      { text: 'Vyfotit', onPress: () => doUpload('camera') },
      { text: 'Z galerie', onPress: () => doUpload('library') },
      { text: 'Zrušit', style: 'cancel' },
    ])
  }

  async function doUpload(source: 'camera' | 'library') {
    if (!userId) return
    setUploading(true)
    try {
      const uri = await pickAndUploadAvatar(userId, source)
      if (uri) {
        setAvatarUri(uri)
        router.back()
      }
    } catch (e: unknown) {
      Alert.alert('Chyba', (e instanceof Error ? e.message : null) ?? 'Nepodařilo se nahrát obrázek.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={20} color={COLORS.text} strokeWidth={2} />
          <Text style={styles.backLabel}>Zpět</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upravit profil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} disabled={uploading}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <ExpoImage
                    source={{ uri: avatarUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.avatarInitials}>{avatarInitials}</Text>
                )}
              </View>
              <View style={styles.cameraOverlay}>
                {uploading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Camera size={14} color="#FFF" strokeWidth={2} />
                }
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Změnit fotku</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Jméno a příjmení</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={fullName}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={email}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 70,
  },
  backLabel: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    minWidth: 70,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.accent,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  avatarHint: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  inputReadOnly: {
    color: COLORS.muted,
    backgroundColor: COLORS.bg,
  },
})
