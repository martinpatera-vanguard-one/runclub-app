import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  // undefined = načítání, null = nepřihlášen, Session = přihlášen
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const segments = useSegments()
  const router = useRouter()

  // Načtení session a sledování změn auth stavu
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Přesměrování podle auth stavu
  useEffect(() => {
    if (session === undefined) return  // ještě se načítá

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [session, segments])

  // Zachycení OAuth deep link callbacku (Google aj.)
  // URL formát: runclub://auth/callback?code=... nebo #access_token=...
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (url.includes('code=') || url.includes('access_token')) {
        const { error } = await supabase.auth.exchangeCodeForSession(url)
        if (error) {
          console.warn('OAuth callback error:', error.message)
        }
        // Při úspěchu onAuthStateChange výše automaticky přesměruje do (tabs)
      }
    }

    // Pokud byla aplikace spuštěna přes deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    const sub = Linking.addEventListener('url', handleUrl)
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
