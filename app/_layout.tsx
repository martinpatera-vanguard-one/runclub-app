import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import * as Notifications from 'expo-notifications'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { registerForPushNotifications } from '../lib/notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

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

  // Přesměrování podle auth stavu + registrace push tokenu po přihlášení
  useEffect(() => {
    if (session === undefined) return  // ještě se načítá

    const inAuthGroup = segments[0] === '(auth)'
    const onResetPassword = segments[1] === 'reset-password'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup && !onResetPassword) {
      router.replace('/(tabs)')
    }

    if (session) {
      registerForPushNotifications().then((token) => {
        if (!token) return
        supabase
          .from('users')
          .update({ push_token: token })
          .eq('id', session.user.id)
      })
    }
  }, [session, segments])

  // Navigace na /event/[id] po klepnutí na notifikaci
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const eventId = response.notification.request.content.data?.eventId
      if (eventId) {
        router.push(`/event/${eventId}`)
      }
    })
    return () => sub.remove()
  }, [])

  // Zachycení OAuth deep link callbacku (Google aj.)
  // URL formát: runclub://auth/callback?code=... nebo #access_token=...
  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      if (url.includes('type=recovery')) {
        // Odkaz pro obnovu hesla — po výměně kódu přesměruj na reset-password
        const { error } = await supabase.auth.exchangeCodeForSession(url)
        if (!error) {
          router.replace('/(auth)/reset-password')
        }
        return
      }
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
