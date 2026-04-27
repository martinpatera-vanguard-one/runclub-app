# RunClub — Komunitní běhy ve tvém městě

> *„Dnes běžíme"* — aplikace, kde jsou lidi na prvním místě, čas na druhém a vzdálenost nikde.

---

## O čem to je

RunClub je mobilní aplikace pro organizaci a objevování komunitních běhů ve městě. **Nejde o výkon ani kilometry — jde o lidi.**

Otevřeš mapu, vidíš dnešní a zítřejší běhy ve svém okolí, jedním klikem se přidáš a hned vidíš, kdo jde s tebou. Primární hodnota aplikace: boj proti osamělosti, networking a after-run pivo nebo kafe.

---

## Tech Stack

| Oblast | Technologie |
|--------|------------|
| Framework | [Expo](https://expo.dev) (React Native) |
| Routing | [Expo Router](https://expo.github.io/router) — file-based routing |
| Styling | NativeWind + StyleSheet (Tailwind CSS pro React Native) |
| Backend | [Supabase](https://supabase.com) — PostgreSQL, Auth, RLS |
| Mapy | `react-native-maps` + `expo-location` |
| Ikony | Lucide React Native |
| Platby (fáze 2) | Stripe Connect |
| Platforma | iOS primárně, Android sekundárně |

**UI jazyk:** Apple minimalismus, `border-radius: 24px`, akcent `#0096c7`

---

## Databázový model

```
users                   — profil uživatele (napojený na auth.users)
clubs                   — běžecké kluby (tier: free / pro, stripe_customer_id)
club_members            — členství uživatele v klubu (role: member / admin)
events                  — akce/běhy (lokace, čas, cena, kapacita, stripe_price_id)
event_participants      — RSVP — kdo jde na jakou akci (status: going / cancelled)
after_run_spots         — doporučená místa po běhu (is_sponsored, navázané na event)
transactions            — platební transakce (amount_czk, platform_fee_czk, stripe_payment_id)
```

### RLS politiky

Všechny tabulky mají zapnuté Row Level Security. Aktuálně nastaveno:

```sql
-- Veřejné čtení (bez přihlášení)
CREATE POLICY "public read" ON events FOR SELECT USING (true);
CREATE POLICY "public read" ON clubs FOR SELECT USING (true);
CREATE POLICY "public read" ON event_participants FOR SELECT USING (true);
CREATE POLICY "public read" ON after_run_spots FOR SELECT USING (true);
```

Zápis (RSVP, vytváření eventů) bude chráněn auth polítikami v další fázi.

---

## Obrazovky

| Tab | Soubor | Stav |
|-----|--------|------|
| Mapa | `app/(tabs)/index.tsx` | ✅ hotovo — mapa, piny, bottom sheet, detail modal, lokace |
| Najít | `app/(tabs)/explore.tsx` | 🔲 prázdná obrazovka |
| Klub | `app/(tabs)/klub.tsx` | 🔲 UI mockup, bez dat |
| After-run | `app/(tabs)/after-run.tsx` | 🔲 UI mockup, bez dat |
| Profil | `app/(tabs)/profil.tsx` | 🔲 UI mockup, bez dat |

---

## Business model

### 1. Club Pro — měsíční předplatné
- Kluby do 50 členů: **zdarma navždy** (growth engine)
- Kluby 50+ členů: placený tier *Club Pro*
- Pro výhody: prioritní zobrazení na mapě, vlastní branding, analytics docházky

### 2. Provize z placených běhů
- Organizátor nastaví vstupné na event
- Platforma bere ~10–15 % provizi přes Stripe Connect

### 3. Sponsored after-run spots
- Kavárny a hospody jako doporučená místa po běhu
- Flat měsíční poplatek nebo CPC model *(fáze 2)*

### Priorita implementace
```
MVP     → pouze free eventy + RSVP + auth
Fáze 2  → Stripe Connect pro placené eventy
Fáze 3  → Club Pro tier + sponsored spots
```

---

## Anti-vzory (co nikdy neděláme)

- Žádné žebříčky ani leaderboardy
- Žádné srovnávání tempů
- Žádné osobní statistiky na hlavní obrazovce
- Žádné „streak" gamifikace
- Důraz na klub a lidi, ne na výkon

---

## Lokální spuštění

### Požadavky
- Node.js 18+
- Xcode (pro iOS build)
- Expo CLI

### Instalace

```bash
git clone https://github.com/martinpatera-vanguard-one/runclub-app.git
cd "RunClub App"
npm install
```

### Proměnné prostředí

Vytvoř soubor `.env` v kořeni projektu:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

`.env` je v `.gitignore` — nikdy ho necommituj. Secret key (`sb_secret_...`) do aplikace nepatří.

### Spuštění

```bash
# Expo dev server
npx expo start

# iOS build (po změně native závislostí)
npx expo prebuild --clean
npx expo run:ios
```

---

## Struktura projektu

```
RunClub App/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx       # Mapa — hlavní obrazovka s běhy
│   │   ├── explore.tsx     # Najít — vyhledávání klubů
│   │   ├── klub.tsx        # Klub — detail klubu
│   │   ├── after-run.tsx   # After-run — místa po běhu
│   │   ├── profil.tsx      # Profil uživatele
│   │   └── _layout.tsx     # Tab bar konfigurace
│   ├── index.tsx           # Redirect na (tabs)
│   └── _layout.tsx         # Root layout + Supabase init
├── lib/
│   └── supabase.ts         # Supabase client (anon key, in-memory storage)
├── constants/
│   └── theme.ts            # Barvy a design tokeny
├── assets/                 # Ikony, splash screen
├── app.json                # Expo konfigurace (pluginy, oprávnění)
└── package.json
```

---

## Licence

Soukromý projekt — © 2026 Martin Patera
