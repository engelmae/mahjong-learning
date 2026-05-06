import type { Tile, ExposedSet } from '@/types/game'
import type { TileVisibility } from '@/types/handDefs'
import { scoreAllHands, distanceTo, buildDeckCounts } from './handMatching'
import { ALL_HAND_DEFS } from './handDefs'

// ─── Isolation heuristic (fallback) ──────────────────────────────────────────

function matchCount(tile: Tile, hand: Tile[]): number {
  return hand.filter(t => t !== tile && t.suit === tile.suit && t.value === tile.value).length
}

function isolationScore(tile: Tile, hand: Tile[]): number {
  if (tile.isJoker) return 999
  return matchCount(tile, hand)
}

// ─── TileVisibility builder (convenience) ────────────────────────────────────

export function buildVisibility(
  discarded: Tile[],
  opponentExposed: Tile[],
): TileVisibility {
  return { discarded, opponentExposed, deckCounts: buildDeckCounts() }
}

// ─── Core bot functions ───────────────────────────────────────────────────────

// Pass 3 tiles during Charleston.
// Strategy: for each candidate removal, compute the weighted-distance increase to the
// top-3 closest hands. Pick the 3 tiles whose combined removal costs the least.
export function botPickCharleston(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
): Tile[] {
  const candidates = hand.filter(t => !t.isJoker)
  if (candidates.length < 3) {
    // Fallback: isolation heuristic
    return [...hand].sort((a, b) => isolationScore(a, hand) - isolationScore(b, hand)).slice(0, 3)
  }

  const baseline = scoreAllHands(hand, exposed, vis)
  const top3 = baseline.filter(s => s.distance < Infinity).slice(0, 3)

  if (top3.length === 0) {
    // All hands unreachable — use isolation heuristic
    return [...candidates].sort((a, b) => isolationScore(a, hand) - isolationScore(b, hand)).slice(0, 3)
  }

  // Score each candidate by cost of removing it
  const costs = candidates.map(tile => {
    const withoutTile = hand.filter(t => t !== tile)
    const cost = top3.reduce((sum, hs) => {
      const newDist = distanceTo(withoutTile, exposed, hs.handDef, vis)
      return sum + (newDist - hs.distance)
    }, 0)
    return { tile, cost }
  })

  costs.sort((a, b) => a.cost - b.cost)
  return costs.slice(0, 3).map(c => c.tile)
}

// Discard the tile whose removal minimally increases weighted distance to the best target.
export function botPickDiscard(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
): Tile {
  const candidates = hand.filter(t => !t.isJoker)
  if (!candidates.length) return hand[0]

  const scores = scoreAllHands(hand, exposed, vis)
  const target = scores.find(s => s.distance < Infinity)

  if (!target) {
    // Fallback
    return [...candidates].sort((a, b) => isolationScore(a, hand) - isolationScore(b, hand))[0]
  }

  let bestTile = candidates[0]
  let bestCost = Infinity

  for (const tile of candidates) {
    const withoutTile = hand.filter(t => t !== tile)
    const newDist = distanceTo(withoutTile, exposed, target.handDef, vis)
    const cost = newDist - target.distance
    if (cost < bestCost) {
      bestCost = cost
      bestTile = tile
    }
  }

  return bestTile
}

// Decide whether to claim a discarded tile.
export function botDecideClaim(
  hand: Tile[],
  exposed: ExposedSet[],
  discardTile: Tile,
  vis: TileVisibility,
): 'mahjong' | 'kong' | 'pung' | null {
  if (discardTile.isJoker) return null

  // Check for Mahjong: simulate adding the discarded tile
  const withDiscard = [...hand, discardTile]
  if (botCheckWin(withDiscard, exposed, vis)) return 'mahjong'

  const matches = hand.filter(
    t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value
  )
  if (matches.length < 2) return null

  const claimType = matches.length >= 3 ? 'kong' : 'pung'

  // Only claim if weighted distance strictly decreases
  const beforeScore = scoreAllHands(hand, exposed, vis)
  const best = beforeScore.find(s => s.distance < Infinity)
  if (!best) return null

  // Simulate expose: remove tiles from hand, add to exposed
  const needed = claimType === 'kong' ? 3 : 2
  const toExpose = matches.slice(0, needed)
  const newHand = hand.filter(t => !toExpose.includes(t))
  const newExposed: ExposedSet[] = [...exposed, { tiles: [...toExpose, discardTile], claimType }]
  const afterDist = distanceTo(newHand, newExposed, best.handDef, vis)

  return afterDist < best.distance ? claimType : null
}

// Pick tiles from hand to form the exposed set with the discarded tile.
// Unchanged from original.
export function botPickExposeSet(hand: Tile[], discardTile: Tile, claimType: 'pung' | 'kong'): Tile[] {
  const needed = claimType === 'kong' ? 3 : 2
  const matches = hand.filter(
    t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value
  )
  return matches.slice(0, needed)
}

// Returns true if any hand definition has distance 0 (Mahjong).
export function botCheckWin(
  hand: Tile[],
  exposed: ExposedSet[],
  vis?: TileVisibility,
): boolean {
  const v = vis ?? buildVisibility([], [])
  return ALL_HAND_DEFS.some(def => distanceTo(hand, exposed, def, v) === 0)
}
