# 🏃 RunClub — Komunitní běhy ve tvém městě

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
| Styling | [NativeWind](https://nativewind.dev) (Tailwind CSS pro React Native) |
| Backend | [Supabase](https://supabase.com) — PostgreSQL, Auth, Realtime |
| Mapy | `react-native-maps` |
| Ikony | [Lucide React Native](https://lucide.dev) |
| Platby (fáze 2) | [Stripe Connect](https://stripe.com/connect) |
| Platforma | iOS primárně, Android sekundárně |
| Hardware | MacBook Air M2 |

**UI jazyk:** Apple minimalismus, `border-radius: 24px`, akcent `#FF4500`

---

## Databázový model

```
users                   — profil uživatele (jméno, foto, home klub)
clubs                   — běžecké kluby (tier, stripe_customer_id)
events                  — akce/běhy (price, stripe_price_id, lokace, čas)
event_participants      — kdo jde na jakou akci
after_run_spots         — doporučená místa po běhu (is_sponsored)
transactions            — platební transakce (event_id, user_id, amount, platform_fee)
```

---

## MVP obrazovky

1. **Mapa** — piny dnešních a zítřejších běhů v okolí
2. **Detail akce** — kdo jde, kdy a kde, kde se potkáme after-run
3. **RSVP jedním klikem** — přidání/odhlášení z akce
4. **Profil** — jméno, foto, home klub (žádné statistiky!)
5. **After-run tab** — doporučené místo, live chat účastníků

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
MVP     → pouze free eventy + datový model pro budoucí platby
Fáze 2  → Stripe Connect pro placené eventy
Fáze 3  → Club Pro tier + sponsored spots
```

---

## Anti-vzory (co nikdy neděláme)

- ❌ Žádné žebříčky ani leaderboardy
- ❌ Žádné srovnávání tempů
- ❌ Žádné osobní statistiky na hlavní obrazovce
- ❌ Žádné „streak" gamifikace
- ✅ Důraz na klub a lidi, ne na výkon

---

## Lokální spuštění

### Požadavky
- Node.js 18+
- npm nebo yarn
- Expo Go aplikace na telefonu (nebo iOS/Android simulátor)

### Instalace

```bash
# Klonování repozitáře
git clone https://github.com/martinpatera/runclub-app.git
cd runclub-app

# Instalace závislostí
npm install

# Spuštění
npm start
```

### Supabase (backend)

1. Vytvoř projekt na [supabase.com](https://supabase.com)
2. Zkopíruj `.env.example` → `.env.local`
3. Vyplň `EXPO_PUBLIC_SUPABASE_URL` a `EXPO_PUBLIC_SUPABASE_ANON_KEY`

```bash
cp .env.example .env.local
```

---

## Struktura projektu

```
runclub-app/
├── app/                    # Expo Router — screens (file-based routing)
│   ├── (tabs)/             # Tab navigace
│   │   ├── index.tsx       # Mapa s běhy
│   │   ├── explore.tsx     # Procházení klubů
│   │   └── profile.tsx     # Profil uživatele
│   ├── event/[id].tsx      # Detail akce
│   └── _layout.tsx         # Root layout
├── components/             # Znovupoužitelné komponenty
├── lib/                    # Supabase client, helpers
├── assets/                 # Obrázky, ikony
├── tailwind.config.js      # NativeWind konfigurace
├── app.json                # Expo konfigurace
└── package.json            # Závislosti
```

---

## Licence

Soukromý projekt — © 2026 Martin Patera
