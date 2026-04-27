import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Povolíme písmena (vč. diakritiky), mezery a pomlčky — nic jiného
const SAFE_NAME_REGEX = /^[\p{L}\s\-']+$/u

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName || !trimmedEmail || !password) {
      Alert.alert('Chyba', 'Vyplň všechna pole.')
      return
    }
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      Alert.alert('Chyba', 'Jméno musí mít 2–60 znaků.')
      return
    }
    if (!SAFE_NAME_REGEX.test(trimmedName)) {
      Alert.alert('Chyba', 'Jméno může obsahovat pouze písmena, mezery a pomlčky.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Chyba', 'Zadej platný email.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Chyba', 'Heslo musí mít alespoň 8 znaků.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { full_name: trimmedName },
      },
    })

    if (error) {
      setLoading(false)
      if (
        error.message.includes('already registered') ||
        error.message.includes('User already registered')
      ) {
        Alert.alert('Chyba', 'Tento email je již zaregistrován.')
      } else if (error.message.includes('Password should be')) {
        Alert.alert('Chyba', 'Heslo je příliš slabé. Použij alespoň 8 znaků.')
      } else {
        Alert.alert('Chyba', 'Registrace se nezdařila. Zkus to znovu.')
      }
      return
    }

    // Vložíme záznam do public.users (id shodné s auth.users)
    // RLS política musí umožnit INSERT kde auth.uid() = id
    if (data.user) {
      await supabase
        .from('users')
        .upsert({ id: data.user.id, full_name: trimmedName }, { onConflict: 'id' })
      // Chyba insertu neblokuje registraci — profil lze doplnit později
    }

    setLoading(false)

    if (data.session) {
      // Email confirmation vypnutý → session ihned, onAuthStateChange přesměruje
    } else {
      Alert.alert(
        'Potvrzení emailu',
        'Zaslali jsme ti potvrzovací email. Po potvrzení se přihlas.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      )
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>RC</Text>
            </View>
            <Text style={styles.title}>Nový účet</Text>
            <Text style={styles.subtitle}>Přidej se do RunClub komunity</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jméno a příjmení</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jan Novák"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                maxLength={60}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tvuj@email.cz"
                placeholderTextColor={COLORS.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Heslo</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Alespoň 8 znaků"
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Vytvořit účet</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Již máš účet?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}> Přihlásit se</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 36,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  footerLink: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
  },
})
