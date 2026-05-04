import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const BATCH_SIZE = 100

interface EventPayload {
  id: string
  name: string
  starts_at: string
  address: string
  lat: number
  lng: number
}

function formatEventTime(startsAt: string): string {
  const date = new Date(startsAt)
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' })
  const day = date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Prague' })
  return `${time}, ${day}`
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data: { eventId: string }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let event: EventPayload
  try {
    const body = await req.json()
    // webhook od Supabase posílá { type, table, record: {...} }
    // přímý POST posílá event přímo
    event = body.record ?? body
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  console.log('event received:', JSON.stringify({ id: event.id, lat: event.lat, lng: event.lng }))

  if (!event.id || event.lat == null || event.lng == null) {
    return new Response('Missing required fields: id, lat, lng', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: users, error } = await supabase.rpc('users_near_event', {
    event_lat: event.lat,
    event_lng: event.lng,
    radius_km: 20,
  })

  if (error) {
    console.error('RPC error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`users_near_event returned ${users?.length ?? 0} users`)

  if (!users || users.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages: ExpoPushMessage[] = users.map((u: { push_token: string }) => ({
    to: u.push_token,
    title: `Běh poblíž: ${event.name}`,
    body: `${formatEventTime(event.starts_at)} · ${event.address}`,
    data: { eventId: event.id },
  }))

  // send in batches of 100
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`Expo push batch ${i / BATCH_SIZE + 1} failed:`, text)
    }
  }

  return new Response(JSON.stringify({ notified: users.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
