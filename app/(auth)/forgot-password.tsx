import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReset = async () => {
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      Alert.alert('Chyba', 'Zadej svůj email.')
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert('Chyba', 'Zadej platný email.')
      return
    }

    setLoading(true)
    const redirectUrl = Linking.createURL('auth/callback')
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: redirectUrl,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Chyba', 'Nepodařilo se odeslat email. Zkus to znovu.')
      return
    }

    setSent(true)
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Zpět</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Text style={styles.logoIcon}>🔑</Text>
            </View>
            <Text style={styles.title}>Zapomenuté heslo</Text>
            <Text style={styles.subtitle}>
              {sent
                ? 'Zkontroluj svůj email – poslali jsme ti odkaz pro obnovu hesla.'
                : 'Zadej svůj email a pošleme ti odkaz pro obnovení hesla.'}
            </Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
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

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Odeslat odkaz</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Email odeslán</Text>
              <Text style={styles.successText}>
                Klikni na odkaz v emailu a nastav si nové heslo. Email může chvíli trvat.
              </Text>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Vzpomněl sis?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
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
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backText: {
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: '600',
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
  logoIcon: {
    fontSize: 28,
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
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
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
  successBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  successIcon: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  successText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
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
