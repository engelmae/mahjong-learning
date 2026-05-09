// Difficulty wrapper around botLogic.ts.
// botLogic.ts stays the pure-optimal core. This file applies the seven
// BotConfig levers from PLAN.md to make Beginner play loose and Difficult
// play sharp. The BotBrain cache (target hand + draws-since-adapt) lives in
// memory on the host client only — not persisted to Firebase.

import type { Tile, ExposedSet, BotDifficulty } from '@/types/game'
import type { TileVisibility, HandScore, VarBinding } from '@/types/handDefs'
import { scoreAllHands, distanceTo } from './handMatching'
import {
  botPickDiscard as corePickDiscard,
  botPickCharleston as corePickCharleston,
  botDecideClaim as coreDecideClaim,
  botPickExposeSet,
  botCheckWin,
  buildVisibility,
} from './botLogic'

// Re-export pure helpers so call sites only need to import botDifficulty.
export { botPickExposeSet, botCheckWin, buildVisibility }

// ─── Config table ────────────────────────────────────────────────────────────

export interface BotConfig {
  targetPoolSize: number             // pick primary from top-N closest (1=optimal)
  adaptFrequency: number             // re-pick target every N draws (Infinity=never)
  backupHandCount: number            // backup targets to maintain alongside primary
  errorRate: number                  // chance of substituting a random legal choice
  attachmentProb: number             // chance of keeping a "special" tile
  avoidExposedFeeds: boolean         // penalize discards matching opponent exposed sets
  inferDangerFromDiscards: boolean   // penalize discards into opponent suit-voids
}

export const BOT_CONFIGS: Record<BotDifficulty, BotConfig> = {
  beginner:  { targetPoolSize: 15, adaptFrequency: Infinity, backupHandCount: 0, errorRate: 0.35, attachmentProb: 0.30, avoidExposedFeeds: false, inferDangerFromDiscards: false },
  easy:      { targetPoolSize: 8,  adaptFrequency: 6,        backupHandCount: 1, errorRate: 0.20, attachmentProb: 0.15, avoidExposedFeeds: false, inferDangerFromDiscards: false },
  moderate:  { targetPoolSize: 3,  adaptFrequency: 3,        backupHandCount: 2, errorRate: 0.05, attachmentProb: 0.05, avoidExposedFeeds: true,  inferDangerFromDiscards: false },
  difficult: { targetPoolSize: 1,  adaptFrequency: 1,        backupHandCount: 3, errorRate: 0.01, attachmentProb: 0,    avoidExposedFeeds: true,  inferDangerFromDiscards: true },
}

// ─── In-memory brain cache (host-only) ───────────────────────────────────────

interface BotBrain {
  primaryHandDefId: string
  primaryVariation: VarBinding
  backupHandDefIds: string[]
  drawsSinceAdapt: number
}

const brainCache = new Map<string, BotBrain>()
const brainKey = (gameId: string, botId: string) => `${gameId}:${botId}`

export function clearBotBrain(gameId: string, botId?: string) {
  if (botId) brainCache.delete(brainKey(gameId, botId))
  else for (const k of [...brainCache.keys()]) if (k.startsWith(`${gameId}:`)) brainCache.delete(k)
}

function pickFromPool(
  scores: HandScore[],
  poolSize: number,
): { primary: HandScore; backups: HandScore[] } {
  const reachable = scores.filter(s => s.distance < Infinity)
  const fallback = scores[0]
  if (reachable.length === 0) return { primary: fallback, backups: [] }
  const pool = reachable.slice(0, Math.max(1, poolSize))
  const primary = pool[Math.floor(Math.random() * pool.length)]
  const backups = reachable.filter(s => s.handDef.id !== primary.handDef.id)
  return { primary, backups }
}

function ensureBrain(
  gameId: string,
  botId: string,
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
  config: BotConfig,
  forceAdapt: boolean,
): { brain: BotBrain; scores: HandScore[]; adapted: boolean } {
  const key = brainKey(gameId, botId)
  const scores = scoreAllHands(hand, exposed, vis)
  const existing = brainCache.get(key)
  const needsAdapt =
    forceAdapt ||
    !existing ||
    (existing && config.adaptFrequency !== Infinity && existing.drawsSinceAdapt >= config.adaptFrequency)

  if (needsAdapt) {
    const { primary, backups } = pickFromPool(scores, config.targetPoolSize)
    const brain: BotBrain = {
      primaryHandDefId: primary.handDef.id,
      primaryVariation: primary.bestBinding,
      backupHandDefIds: backups.slice(0, config.backupHandCount).map(s => s.handDef.id),
      drawsSinceAdapt: 0,
    }
    brainCache.set(key, brain)
    return { brain, scores, adapted: true }
  }
  return { brain: existing!, scores, adapted: false }
}

function bumpAdaptCounter(gameId: string, botId: string) {
  const k = brainKey(gameId, botId)
  const b = brainCache.get(k)
  if (b) b.drawsSinceAdapt += 1
}

function targetsFromBrain(brain: BotBrain, scores: HandScore[]): { primary: HandScore; backups: HandScore[] } {
  const primary = scores.find(s => s.handDef.id === brain.primaryHandDefId) ?? scores[0]
  const backups = brain.backupHandDefIds
    .map(id => scores.find(s => s.handDef.id === id))
    .filter((s): s is HandScore => !!s && s.distance < Infinity)
  return { primary, backups }
}

// ─── Detail records ──────────────────────────────────────────────────────────

export interface TilePoolEntry {
  tile: Tile
  cost: number
  rank: number
  flagged: 'special' | 'exposed-feed' | 'void' | null
}

export interface CharlestonDetail {
  config: BotConfig
  difficulty: BotDifficulty
  primary: HandScore
  backups: HandScore[]
  tilePool: TilePoolEntry[]
  randomFire: boolean
  adapted: boolean
}

export interface DiscardDetail {
  config: BotConfig
  difficulty: BotDifficulty
  primary: HandScore
  backups: HandScore[]
  tilePool: TilePoolEntry[]
  optimalChoice: Tile
  randomFire: boolean
  attachmentFired: boolean
  dodgedTiles: Tile[]
  inferredVoids: VoidNote[]
  adapted: boolean
}

export interface ClaimDetail {
  config: BotConfig
  difficulty: BotDifficulty
  primary: HandScore
  backups: HandScore[]
  before: number
  after: number
  claimType: 'pung' | 'kong' | 'mahjong' | null
  randomFire: boolean
}

export interface VoidNote { playerId: string; suit: string }

// ─── Lever helpers ───────────────────────────────────────────────────────────

function isSpecialTile(tile: Tile, hand: Tile[]): boolean {
  if (tile.isJoker) return true
  if (tile.suit === 'dragon' || tile.suit === 'flower') return true
  // Pair-completing: at least one matching tile elsewhere in hand
  const matches = hand.filter(t => t !== tile && t.suit === tile.suit && t.value === tile.value).length
  return matches >= 1
}

function buildExposedFeedMap(allPlayers: Record<string, { exposedSets?: ExposedSet[]; isBot?: boolean } | undefined>, selfId: string): Set<string> {
  const set = new Set<string>()
  for (const [pid, p] of Object.entries(allPlayers)) {
    if (pid === selfId || !p?.exposedSets) continue
    for (const ex of p.exposedSets) for (const t of ex.tiles) set.add(`${t.suit}|${t.value}`)
  }
  return set
}

function buildVoidMap(
  players: Record<string, { discards?: Tile[] } | undefined>,
  selfId: string,
): { voids: Map<string, Set<string>>; allDiscardCount: number } {
  // For each opponent: set of "suits" they have NEVER discarded.
  // We distinguish suits by the discard-suit category (bam/crak/dot/wind/dragon/flower/joker).
  const voids = new Map<string, Set<string>>()
  let allDiscardCount = 0
  for (const [pid, p] of Object.entries(players)) {
    if (pid === selfId) continue
    const discards = p?.discards ?? []
    allDiscardCount += discards.length
    const suitsSeen = new Set<string>(discards.map(t => t.suit as string))
    const allSuits = ['bam', 'crak', 'dot', 'wind', 'dragon', 'flower']
    voids.set(pid, new Set(allSuits.filter(s => !suitsSeen.has(s))))
  }
  return { voids, allDiscardCount }
}

// ─── Charleston ──────────────────────────────────────────────────────────────

export function pickCharlestonDetailed(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
): { tiles: Tile[]; detail: CharlestonDetail } {
  const config = BOT_CONFIGS[difficulty]

  // Charleston is pre-game, so always seed (or refresh) the brain on first call.
  const { brain, scores, adapted } = ensureBrain(gameId, botId, hand, exposed, vis, config, /*forceAdapt*/ false)
  const { primary, backups } = targetsFromBrain(brain, scores)

  const candidates = hand.filter(t => !t.isJoker)
  const targets = backups.length ? [primary, ...backups] : [primary]

  // Cost = aggregate weighted-distance increase across targets if this tile were removed.
  const entries: TilePoolEntry[] = candidates.map(tile => {
    const without = hand.filter(t => t !== tile)
    const cost = targets.reduce(
      (s, t) => s + Math.max(0, distanceTo(without, exposed, t.handDef, vis) - t.distance),
      0,
    )
    return { tile, cost, rank: 0, flagged: isSpecialTile(tile, hand) ? 'special' : null }
  })
  entries.sort((a, b) => a.cost - b.cost)
  entries.forEach((e, i) => (e.rank = i))

  // errorRate: substitute a fully-random legal selection.
  let randomFire = false
  let chosen: Tile[]
  if (Math.random() < config.errorRate) {
    randomFire = true
    const shuffled = [...candidates].sort(() => Math.random() - 0.5)
    chosen = shuffled.slice(0, 3)
  } else {
    chosen = entries.slice(0, 3).map(e => e.tile)
  }

  // Fallback to core if we somehow ended up with <3 (e.g. mostly jokers)
  if (chosen.length < 3) chosen = corePickCharleston(hand, exposed, vis)

  const detail: CharlestonDetail = {
    config, difficulty, primary, backups,
    tilePool: entries, randomFire, adapted,
  }
  return { tiles: chosen, detail }
}

export function pickCharleston(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
): Tile[] {
  return pickCharlestonDetailed(hand, exposed, vis, gameId, botId, difficulty).tiles
}

// ─── Discard ─────────────────────────────────────────────────────────────────

export function pickDiscardDetailed(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
  opponents: Record<string, { exposedSets?: ExposedSet[]; discards?: Tile[]; isBot?: boolean } | undefined> = {},
): { tile: Tile; detail: DiscardDetail } {
  const config = BOT_CONFIGS[difficulty]

  // A discard implies a draw just happened — increment then check if adapt fires.
  bumpAdaptCounter(gameId, botId)
  const { brain, scores, adapted } = ensureBrain(gameId, botId, hand, exposed, vis, config, /*forceAdapt*/ false)
  const { primary, backups } = targetsFromBrain(brain, scores)

  const candidates = hand.filter(t => !t.isJoker)
  if (!candidates.length) {
    const fallback = corePickDiscard(hand, exposed, vis)
    return {
      tile: fallback,
      detail: { config, difficulty, primary, backups, tilePool: [], optimalChoice: fallback, randomFire: false, attachmentFired: false, dodgedTiles: [], inferredVoids: [], adapted },
    }
  }

  const targets = backups.length ? [primary, ...backups] : [primary]
  const exposedFeed = config.avoidExposedFeeds ? buildExposedFeedMap(opponents, botId) : new Set<string>()
  const { voids } = config.inferDangerFromDiscards
    ? buildVoidMap(opponents, botId)
    : { voids: new Map<string, Set<string>>() }

  // Aggregate void-count per suit (deeper void = more opponents collecting it).
  const voidDepth = new Map<string, number>()
  const inferredVoids: VoidNote[] = []
  for (const [pid, suits] of voids) {
    for (const s of suits) {
      voidDepth.set(s, (voidDepth.get(s) ?? 0) + 1)
      inferredVoids.push({ playerId: pid, suit: s })
    }
  }

  const entries: TilePoolEntry[] = candidates.map(tile => {
    const without = hand.filter(t => t !== tile)
    const baseCost = targets.reduce(
      (s, t) => s + Math.max(0, distanceTo(without, exposed, t.handDef, vis) - t.distance),
      0,
    )
    const k = `${tile.suit}|${tile.value}`
    let flagged: TilePoolEntry['flagged'] = null
    let penalty = 0
    if (exposedFeed.has(k)) { penalty += 4; flagged = 'exposed-feed' }
    const depth = voidDepth.get(tile.suit) ?? 0
    if (depth > 0) { penalty += depth * 1.5; flagged = flagged ?? 'void' }
    if (!flagged && isSpecialTile(tile, hand)) flagged = 'special'
    return { tile, cost: baseCost + penalty, rank: 0, flagged }
  })
  entries.sort((a, b) => a.cost - b.cost)
  entries.forEach((e, i) => (e.rank = i))

  const optimalChoice = entries[0].tile
  let chosen = optimalChoice
  let randomFire = false
  let attachmentFired = false
  const dodgedTiles: Tile[] = []

  // errorRate
  if (Math.random() < config.errorRate) {
    randomFire = true
    chosen = candidates[Math.floor(Math.random() * candidates.length)]
  } else if (Math.random() < config.attachmentProb) {
    // Look for a "special" tile near the top of the discard ranking and try
    // to keep it by picking the next non-special candidate within +1 cost.
    const optimalIsSpecial = isSpecialTile(optimalChoice, hand)
    if (optimalIsSpecial) {
      const alt = entries.find(e => !isSpecialTile(e.tile, hand) && e.cost - entries[0].cost <= 1)
      if (alt) {
        chosen = alt.tile
        attachmentFired = true
        dodgedTiles.push(optimalChoice)
      }
    }
  }

  const detail: DiscardDetail = {
    config, difficulty, primary, backups,
    tilePool: entries, optimalChoice, randomFire, attachmentFired, dodgedTiles, inferredVoids, adapted,
  }
  return { tile: chosen, detail }
}

export function pickDiscard(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
  opponents: Record<string, { exposedSets?: ExposedSet[]; discards?: Tile[]; isBot?: boolean } | undefined> = {},
): Tile {
  return pickDiscardDetailed(hand, exposed, vis, gameId, botId, difficulty, opponents).tile
}

// ─── Claim decision ──────────────────────────────────────────────────────────

export function decideClaimDetailed(
  hand: Tile[],
  exposed: ExposedSet[],
  discardTile: Tile,
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
): { claim: 'pung' | 'kong' | 'mahjong' | null; detail: ClaimDetail } {
  const config = BOT_CONFIGS[difficulty]
  const { brain, scores } = ensureBrain(gameId, botId, hand, exposed, vis, config, /*forceAdapt*/ false)
  const { primary, backups } = targetsFromBrain(brain, scores)

  // Always run core to get the optimal claim decision.
  const optimal = coreDecideClaim(hand, exposed, discardTile, vis)
  const before = primary.distance

  let after = before
  if (optimal && optimal !== 'mahjong') {
    const matches = hand.filter(
      t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value,
    )
    const needed = optimal === 'kong' ? 3 : 2
    const toExpose = matches.slice(0, needed)
    const newHand = hand.filter(t => !toExpose.includes(t))
    const newExposed: ExposedSet[] = [...exposed, { tiles: [...toExpose, discardTile], claimType: optimal }]
    after = distanceTo(newHand, newExposed, primary.handDef, vis)
  } else if (optimal === 'mahjong') {
    after = 0
  }

  // errorRate: with probability, flip the decision (decline if optimal said claim,
  // attempt to claim if optimal said pass and a pung is even possible).
  let claim = optimal
  let randomFire = false
  if (Math.random() < config.errorRate) {
    randomFire = true
    if (optimal && optimal !== 'mahjong') {
      claim = null
    } else if (!optimal) {
      // Could the bot legally pung? If so, flip to pung.
      const matches = hand.filter(
        t => !t.isJoker && t.suit === discardTile.suit && t.value === discardTile.value,
      )
      if (matches.length >= 2) claim = matches.length >= 3 ? 'kong' : 'pung'
    }
    // Never flip a winning Mahjong claim into a pass.
  }

  const detail: ClaimDetail = {
    config, difficulty, primary, backups, before, after,
    claimType: claim, randomFire,
  }
  return { claim, detail }
}

export function decideClaim(
  hand: Tile[],
  exposed: ExposedSet[],
  discardTile: Tile,
  vis: TileVisibility,
  gameId: string,
  botId: string,
  difficulty: BotDifficulty,
): 'pung' | 'kong' | 'mahjong' | null {
  return decideClaimDetailed(hand, exposed, discardTile, vis, gameId, botId, difficulty).claim
}
