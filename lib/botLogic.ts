import { Tile } from '@/types/game'

// How many other tiles in the hand share this tile's suit+value
function matchCount(tile: Tile, hand: Tile[]): number {
  return hand.filter(t => t !== tile && t.suit === tile.suit && t.value === tile.value).length
}

// Lower score = more isolated = better candidate to discard/pass
function isolationScore(tile: Tile, hand: Tile[]): number {
  if (tile.isJoker) return 999  // never discard jokers
  return matchCount(tile, hand)  // 0=isolated, 1=has pair, 2=triple
}

// Pick 3 tiles to pass during Charleston: most isolated first, no jokers if avoidable
export function botPickCharleston(hand: Tile[]): Tile[] {
  const sorted = [...hand].sort((a, b) => isolationScore(a, hand) - isolationScore(b, hand))
  return sorted.slice(0, 3)
}

// Pick the tile least worth keeping to discard
export function botPickDiscard(hand: Tile[]): Tile {
  const candidates = hand.filter(t => !t.isJoker)
  if (!candidates.length) return hand[0]
  const sorted = [...candidates].sort((a, b) => isolationScore(a, hand) - isolationScore(b, hand))
  return sorted[0]
}

// Decide whether to claim a discarded tile (pung or kong only — no chow/mahjong)
export function botDecideClaim(hand: Tile[], discardTile: Tile): 'kong' | 'pung' | null {
  if (discardTile.isJoker) return null
  const matches = hand.filter(
    t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value
  )
  if (matches.length >= 3) return 'kong'
  if (matches.length >= 2) return 'pung'
  return null
}

// Pick the tiles from hand to form the exposed set with the discarded tile
export function botPickExposeSet(hand: Tile[], discardTile: Tile, claimType: 'pung' | 'kong'): Tile[] {
  const needed = claimType === 'kong' ? 3 : 2
  const matches = hand.filter(
    t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value
  )
  return matches.slice(0, needed)
}
