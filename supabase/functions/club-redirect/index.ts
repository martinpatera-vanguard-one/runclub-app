/**
 * Supabase Edge Function: club-redirect
 * Route: GET /functions/v1/club-redirect?slug=:slug
 *        (nebo přes custom domain: GET /k/:slug)
 *
 * STAV: připraveno, čeká na:
 *   1. slug sloupec v tabulce clubs (migration: ALTER TABLE clubs ADD COLUMN slug text UNIQUE)
 *   2. Vlastní doménu (runclub.app) a nastavení custom domain v Supabase
 *   3. OG image endpoint nebo statický obrázek na CDN
 *   4. App Store / Google Play URL aplikace
 *
 * Nasazení až bude připraveno:
 *   supabase functions deploy club-redirect
 *
 * TODO: doplnit hodnoty označené %%PLACEHOLDER%%
 */

// Deno runtime (Supabase edge)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// %%PLACEHOLDER%% — doplnit až bude doména a App Store odkaz
const APP_STORE_URL = 'https://apps.apple.com/app/%%APP_ID%%'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=%%BUNDLE_ID%%'
const BASE_URL = 'https://runclub.app' // vlastní doména
const OG_IMAGE_FALLBACK = `${BASE_URL}/og-default.png` // statický fallback OG obrázek

serve(async (req: Request) => {
  const url = new URL(req.url)

  // Slug přijde buď z path (/k/slug) nebo z query (?slug=...)
  const slug =
    url.pathname.split('/').filter(Boolean).pop() ??
    url.searchParams.get('slug')

  if (!slug) {
    return new Response('Not found', { status: 404 })
  }

  // Supabase klient — env vars jsou automaticky dostupné v edge runtime
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Načti klub podle slugu
  const { data: club, error } = await supabase
    .from('clubs')
    .select('id, name, description, location')
    .eq('slug', slug)
    .single()

  if (error || !club) {
    return new Response('Klub nenalezen', { status: 404 })
  }

  function escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }

  const safeName = escapeHtml(club.name)
  const safeLocation = club.location ? escapeHtml(club.location) : null
  const title = safeName
  const description = club.description
    ? escapeHtml(club.description)
    : `Běžecký klub ${safeName}${safeLocation ? ` · ${safeLocation}` : ''}. Přidej se!`
  // %%PLACEHOLDER%% — až bude OG image endpoint, použít dynamický obrázek
  const ogImage = OG_IMAGE_FALLBACK
  const deepLink = `runclub://klub/${club.id}`
  const webUrl = `${BASE_URL}/k/${escapeHtml(slug)}`

  // HTML stránka s OG meta tagy a auto-redirectem
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — RunClub</title>

  <!-- OG / Twitter meta tagy -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${webUrl}" />
  <meta property="og:title" content="${title} — RunClub" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} — RunClub" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />

  <!-- Universal link / deep link -->
  <!-- %%PLACEHOLDER%% apple-app-site-association musí být nasazeno na doméně -->
  <meta name="apple-itunes-app" content="app-id=%%APP_ID%%, app-argument=${deepLink}" />

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1A1A1A;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .badge {
      background: #FF4500;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      border-radius: 20px;
      padding: 5px 12px;
      margin-bottom: 20px;
      display: inline-block;
    }
    h1 { font-size: 28px; font-weight: 800; margin-bottom: 10px; }
    p { font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 32px; line-height: 1.5; }
    .btn {
      display: inline-block;
      background: #FF4500;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      border-radius: 16px;
      padding: 14px 32px;
      text-decoration: none;
      margin-bottom: 12px;
    }
    .btn-outline {
      display: inline-block;
      border: 1.5px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.7);
      font-size: 14px;
      border-radius: 16px;
      padding: 12px 28px;
      text-decoration: none;
    }
    .url { font-size: 11px; color: rgba(255,255,255,0.25); margin-top: 32px; }
  </style>
</head>
<body>
  <div class="badge">RunClub</div>
  <h1>${title}</h1>
  <p>${description}</p>

  <a class="btn" href="${deepLink}" id="deeplink">Otevřít v aplikaci</a><br/>
  <a class="btn-outline" href="${APP_STORE_URL}" id="store">Stáhnout RunClub</a>

  <p class="url">${webUrl}</p>

  <script>
    // Zkus otevřít deep link, po 2s přesměruj na App Store
    window.location.href = '${deepLink}'
    setTimeout(() => {
      const ua = navigator.userAgent
      if (/android/i.test(ua)) {
        window.location.href = '${PLAY_STORE_URL}'
      } else {
        window.location.href = '${APP_STORE_URL}'
      }
    }, 2000)
  </script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
})
