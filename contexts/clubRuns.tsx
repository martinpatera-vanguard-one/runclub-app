import { createContext, useContext, useState } from 'react'

type ContextType = { version: number; refresh: () => void }

const Ctx = createContext<ContextType>({ version: 0, refresh: () => {} })

export function ClubRunsProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0)
  return (
    <Ctx.Provider value={{ version, refresh: () => setVersion((v) => v + 1) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useClubRuns = () => useContext(Ctx)
