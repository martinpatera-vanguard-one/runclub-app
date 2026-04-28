import { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type MyEvent = {
  id: string
  name: string
  starts_at: string
}

type State = {
  ids: Set<string>
  events: MyEvent[]
  loaded: boolean
}

type Action =
  | { type: 'SET'; events: MyEvent[] }
  | { type: 'ADD'; event: MyEvent }
  | { type: 'REMOVE'; id: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET':
      return { ids: new Set(action.events.map((e) => e.id)), events: action.events, loaded: true }
    case 'ADD':
      if (state.ids.has(action.event.id)) return state
      return {
        ids: new Set([...state.ids, action.event.id]),
        events: [...state.events, action.event],
        loaded: true,
      }
    case 'REMOVE':
      return {
        ids: new Set([...state.ids].filter((id) => id !== action.id)),
        events: state.events.filter((e) => e.id !== action.id),
        loaded: true,
      }
    default:
      return state
  }
}

type ContextType = {
  myEventIds: Set<string>
  myEvents: MyEvent[]
  loaded: boolean
  join: (event: MyEvent) => void
  leave: (eventId: string) => void
  pendingOpenId: React.MutableRefObject<string | null>
}

const Ctx = createContext<ContextType | null>(null)

export function EventParticipationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ids: new Set(), events: [], loaded: false })
  const pendingOpenId = useRef<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { dispatch({ type: 'SET', events: [] }); return }
      const { data } = await supabase
        .from('event_participants')
        .select('events(id, name, starts_at)')
        .eq('user_id', user.id)
      const events: MyEvent[] = (data ?? []).map((p: any) => p.events).filter(Boolean)
      dispatch({ type: 'SET', events })
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) dispatch({ type: 'SET', events: [] })
      else load()
    })
    return () => subscription.unsubscribe()
  }, [])

  const join = useCallback((event: MyEvent) => dispatch({ type: 'ADD', event }), [])
  const leave = useCallback((eventId: string) => dispatch({ type: 'REMOVE', id: eventId }), [])

  return (
    <Ctx.Provider value={{ myEventIds: state.ids, myEvents: state.events, loaded: state.loaded, join, leave, pendingOpenId }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEventParticipation() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEventParticipation must be used within EventParticipationProvider')
  return ctx
}
