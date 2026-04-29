/**
 * ClubStoryCard — 360×640px view určená pro zachycení jako PNG (9:16).
 * Renderuj ji mimo viditelnou oblast (position: absolute, off-screen)
 * a předej ref do shareStoryCard() z lib/share.ts.
 *
 * TODO: propojit s react-native-view-shot jakmile bude nainstalován.
 */

import { View, Text, StyleSheet } from 'react-native'
import { forwardRef } from 'react'

export type StoryClub = {
  name: string
  location: string | null
  memberCount: number
  nextRun?: {
    title: string
    when: string
    distanceKm?: number | null
    paceText?: string | null
  } | null
  // TODO: slug pro URL dole — doplnit až bude doména
  slug?: string | null
}

type Props = {
  club: StoryClub
}

export const ClubStoryCard = forwardRef<View, Props>(({ club }, ref) => {
  const stats = [
    club.nextRun?.distanceKm != null ? `${club.nextRun.distanceKm} km` : null,
    club.nextRun?.paceText ? `${club.nextRun.paceText} /km` : null,
  ].filter(Boolean).join(' · ')

  // TODO: až bude doména, použít `https://runclub.app/k/${club.slug}`
  const displayUrl = club.slug ? `runclub.app/k/${club.slug}` : 'runclub.app'

  return (
    <View ref={ref} style={styles.card}>
      {/* Dekorativní kruh vpravo nahoře */}
      <View style={styles.decorCircle} />
      <View style={styles.decorCircleSmall} />

      {/* Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          RunClub{club.location ? ` · ${club.location.split('–')[0].trim()}` : ''}
        </Text>
      </View>

      {/* Název klubu */}
      <Text style={styles.clubName} numberOfLines={2}>{club.name}</Text>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>👥 {club.memberCount} členů</Text>
        {club.location ? (
          <Text style={styles.metaText}>📍 {club.location}</Text>
        ) : null}
      </View>

      {/* Příští běh */}
      {club.nextRun ? (
        <View style={styles.nextRunCard}>
          <Text style={styles.nextRunLabel}>PŘÍŠTÍ BĚH</Text>
          <Text style={styles.nextRunTitle}>{club.nextRun.title}</Text>
          <Text style={styles.nextRunWhen}>{club.nextRun.when}</Text>
          {stats ? <Text style={styles.nextRunStats}>{stats}</Text> : null}
        </View>
      ) : (
        <View style={styles.nextRunCard}>
          <Text style={styles.nextRunLabel}>PŘÍŠTÍ BĚH</Text>
          <Text style={styles.nextRunEmpty}>Brzy vyhlásíme 🏃</Text>
        </View>
      )}

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* CTA */}
      <View style={styles.ctaBtn}>
        <Text style={styles.ctaText}>Přidej se k nám</Text>
      </View>

      {/* URL dole */}
      <Text style={styles.url}>{displayUrl}</Text>
    </View>
  )
})

ClubStoryCard.displayName = 'ClubStoryCard'

const ACCENT = '#FF4500'

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 640,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 32,
    paddingBottom: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: `${ACCENT}22`,
  },
  decorCircleSmall: {
    position: 'absolute',
    top: 60,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${ACCENT}11`,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  clubName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 38,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  nextRunCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextRunLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 1,
    marginBottom: 6,
  },
  nextRunTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  nextRunWhen: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  nextRunStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  nextRunEmpty: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  ctaBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  url: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})
