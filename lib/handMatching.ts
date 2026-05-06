import { ALL_HAND_DEFS } from './handDefs'
import type {
  HandDef, HandScore, VarBinding, TileVisibility,
  GroupSpec, NumberGroupSpec, WindGroupSpec, DragonGroupSpec, FlowerGroupSpec,
  NumberSuit, DragonValue,
} from '../types/handDefs'
import type { Tile, ExposedSet } from '../types/game'

// ─── Tile key ────────────────────────────────────────────────────────────────

export function tileKey(suit: string, value: string | number): string {
  return `${suit}|${value}`
}

// Build the baseline deck counts for a 152-tile deck.
export function buildDeckCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  const suits = ['bam', 'crak', 'dot']
  for (const suit of suits) {
    for (let v = 1; v <= 9; v++) counts[tileKey(suit, v)] = 4
  }
  for (const wind of ['N', 'E', 'W', 'S']) counts[tileKey('wind', wind)] = 4
  for (const dragon of ['Red', 'Green', 'Soap']) counts[tileKey('dragon', dragon)] = 4
  counts[tileKey('flower', 'Flower')] = 8
  counts[tileKey('joker', 'Joker')] = 8
  return counts
}

// ─── Dragon resolution ───────────────────────────────────────────────────────

const SUIT_DRAGON: Record<NumberSuit, string> = { bam: 'Green', crak: 'Red', dot: 'Soap' }

function resolveDragon(value: DragonValue, binding: VarBinding): string[] {
  switch (value) {
    case 'Red': case 'Green': case 'Soap': return [value]
    case 'match-S1': return binding.S1 ? [SUIT_DRAGON[binding.S1]] : []
    case 'match-S2': return binding.S2 ? [SUIT_DRAGON[binding.S2]] : []
    case 'match-S3': return binding.S3 ? [SUIT_DRAGON[binding.S3]] : []
    case 'opp-S1': {
      if (!binding.S1) return []
      const match = SUIT_DRAGON[binding.S1]
      return Object.values(SUIT_DRAGON).filter(d => d !== match)
    }
    case 'any': return ['Red', 'Green', 'Soap']
  }
}

// ─── Constraint filtering ────────────────────────────────────────────────────

function* enumerateBindings(def: HandDef): Generator<VarBinding> {
  const suits: NumberSuit[] = ['bam', 'crak', 'dot']

  // Collect which suit/value vars appear in groups
  const usedSuits = new Set<'S1' | 'S2' | 'S3'>()
  const usedValues = new Set<'V1' | 'V2' | 'V3'>()
  for (const g of def.groups) {
    if (g.kind === 'number') {
      if (g.suit === 'S1' || g.suit === 'S2' || g.suit === 'S3') usedSuits.add(g.suit)
      if (g.value === 'V1' || g.value === 'V2' || g.value === 'V3') usedValues.add(g.value)
    }
    if (g.kind === 'dragon') {
      const dv = g.value as DragonValue
      if (dv === 'match-S1' || dv === 'opp-S1') usedSuits.add('S1')
      if (dv === 'match-S2') usedSuits.add('S2')
      if (dv === 'match-S3') usedSuits.add('S3')
    }
  }

  const suitVars = Array.from(usedSuits).sort()
  const valueVars = Array.from(usedValues).sort()

  // Suit permutations (S1≠S2≠S3)
  const suitPerms = permutations(suits, suitVars.length)

  for (const sp of suitPerms) {
    const sBinding: Partial<VarBinding> = {}
    for (let i = 0; i < suitVars.length; i++) {
      sBinding[suitVars[i]] = sp[i]
    }

    // Value cartesian product with constraint pre-filtering
    for (const vb of enumerateValueBindings(valueVars, def.constraints ?? [], sBinding as VarBinding)) {
      yield { ...sBinding, ...vb } as VarBinding
    }
  }
}

function* enumerateValueBindings(
  vars: ('V1' | 'V2' | 'V3')[],
  constraints: HandDef['constraints'],
  sBinding: VarBinding,
): Generator<Partial<VarBinding>> {
  if (vars.length === 0) { yield {}; return }

  const inSetMap: Partial<Record<'V1' | 'V2' | 'V3', number[]>> = {}
  const consecVars: ('V1' | 'V2' | 'V3')[][] = []
  for (const c of constraints ?? []) {
    if (c.op === 'in-set') inSetMap[c.lhs] = c.values
    if (c.op === 'consec') consecVars.push(c.vars as ('V1' | 'V2' | 'V3')[])
  }

  const ranges: number[][] = vars.map(v => inSetMap[v] ?? range(1, 9))

  function* recurse(idx: number, partial: Partial<VarBinding>): Generator<Partial<VarBinding>> {
    if (idx === vars.length) {
      // Validate consec constraints
      for (const seq of consecVars) {
        const vals = seq.map(v => partial[v])
        if (vals.some(x => x == null)) continue
        for (let i = 1; i < vals.length; i++) {
          if ((vals[i] as number) !== (vals[i - 1] as number) + 1) return
        }
      }
      yield partial
      return
    }
    const vv = vars[idx]
    for (const val of ranges[idx]) {
      yield* recurse(idx + 1, { ...partial, [vv]: val })
    }
  }
  yield* recurse(0, {})
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}

function permutations<T>(arr: T[], r: number): T[][] {
  if (r === 0) return [[]]
  const result: T[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.filter((_, j) => j !== i)
    for (const p of permutations(rest, r - 1)) result.push([arr[i], ...p])
  }
  return result
}

// ─── Group resolution & scoring ───────────────────────────────────────────────

interface FreqMap { [key: string]: number }

function buildFreqMap(tiles: Tile[]): FreqMap {
  const map: FreqMap = {}
  for (const t of tiles) {
    if (t.isJoker) continue
    const k = tileKey(t.suit, t.value)
    map[k] = (map[k] ?? 0) + 1
  }
  return map
}

// Resolve a group spec to a list of (key, count) requirements under a given binding.
// Returns null if binding is incomplete for this group.
function resolveGroup(g: GroupSpec, binding: VarBinding): Array<{ key: string; need: number }> | null {
  if (g.kind === 'flower') {
    return [{ key: tileKey('flower', 'Flower'), need: g.count }]
  }
  if (g.kind === 'wind') {
    if (g.value === 'NEWS') {
      return [
        { key: tileKey('wind', 'N'), need: 1 },
        { key: tileKey('wind', 'E'), need: 1 },
        { key: tileKey('wind', 'W'), need: 1 },
        { key: tileKey('wind', 'S'), need: 1 },
      ]
    }
    return [{ key: tileKey('wind', g.value), need: g.count }]
  }
  if (g.kind === 'dragon') {
    const resolved = resolveDragon(g.value, binding)
    if (resolved.length === 0) return null
    // For 'any' and 'opp-S1' we pick whichever dragon is cheapest (lowest deficit).
    // Return all options; caller will pick the best.
    return resolved.map(name => ({ key: tileKey('dragon', name), need: g.count }))
  }
  if (g.kind === 'number') {
    const suit = typeof g.suit === 'string' && (g.suit === 'S1' || g.suit === 'S2' || g.suit === 'S3')
      ? binding[g.suit]
      : g.suit as NumberSuit
    const val = typeof g.value === 'string' && (g.value === 'V1' || g.value === 'V2' || g.value === 'V3')
      ? binding[g.value]
      : g.value as number
    if (!suit || val == null) return null
    return [{ key: tileKey(suit as string, val), need: g.count }]
  }
  return null
}

// Score one binding. Returns Infinity if invalid.
function scoreBinding(
  def: HandDef,
  binding: VarBinding,
  allTiles: Tile[],
  jokerCount: number,
  vis: TileVisibility,
): number {
  const freq = buildFreqMap(allTiles)
  let hardDeficit = 0   // deficit in jokerOk:false groups — jokers cannot substitute
  let softDeficit = 0   // deficit in jokerOk:true groups — jokers may fill these
  let weightedScore = 0

  for (const g of def.groups) {
    const options = resolveGroup(g, binding)
    if (!options) return Infinity

    let bestDeficit = Infinity
    let bestWeight = Infinity
    let bestOptSet: Array<{ key: string; need: number }> | null = null

    for (const optSet of groupOptions(options, g)) {
      let deficit = 0
      let weight = 0
      const tempFreq = { ...freq }

      for (const { key, need } of optSet) {
        const have = Math.max(0, tempFreq[key] ?? 0)
        const raw = Math.max(0, need - have)
        deficit += raw
        if (raw > 0) weight += scarWeight(key, raw, vis)
        tempFreq[key] = have - need
      }

      if (deficit < bestDeficit || (deficit === bestDeficit && weight < bestWeight)) {
        bestDeficit = deficit
        bestWeight = weight
        bestOptSet = optSet
      }
    }

    // Commit only the best option's consumption to the shared freq map
    if (bestOptSet) {
      for (const { key, need } of bestOptSet) {
        freq[key] = Math.max(0, (freq[key] ?? 0) - need)
      }
    }

    if (bestDeficit > 0) {
      weightedScore += bestWeight
      if (g.jokerOk) {
        softDeficit += bestDeficit
      } else {
        hardDeficit += bestDeficit  // jokers CANNOT fill these
      }
    }
  }

  // Jokers may only substitute for jokerOk:true tiles
  const jokerFill = Math.min(jokerCount, softDeficit)
  const totalRaw = hardDeficit + softDeficit
  const avgWeight = totalRaw > 0 ? weightedScore / totalRaw : 0
  weightedScore -= jokerFill * avgWeight
  softDeficit -= jokerFill

  const remaining = hardDeficit + softDeficit
  if (remaining > 0) return Math.max(0, weightedScore)

  // All groups satisfied — verify no natural tiles were left unconsumed.
  // Every tile in the hand must participate in the winning pattern.
  const leftover = Object.values(freq).reduce((s, v) => s + Math.max(0, v), 0)
  if (leftover > 0) return leftover  // extra tiles ≠ valid mahjong

  return 0
}

// Given a list of (key, need) for a group, return the "option sets" to try.
// For single-key groups: just one option. For multi-key (any/opp dragon): each key is its own option.
function groupOptions(
  options: Array<{ key: string; need: number }>,
  _g: GroupSpec,
): Array<Array<{ key: string; need: number }>> {
  if (options.length === 1) return [options]
  // For multi-option groups each individual key is tried separately
  return options.map(o => [o])
}

function scarWeight(key: string, needCount: number, vis: TileVisibility): number {
  const total = vis.deckCounts[key] ?? 4
  const dead = countIn(key, vis.discarded) + countIn(key, vis.opponentExposed)
  const available = Math.max(1, total - dead)
  let w = 0
  for (let i = 0; i < needCount; i++) {
    w += total / Math.max(1, available - i)
  }
  return w
}

function countIn(key: string, tiles: Tile[]): number {
  return tiles.filter(t => !t.isJoker && tileKey(t.suit, t.value) === key).length
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function distanceTo(
  hand: Tile[],
  exposed: ExposedSet[],
  def: HandDef,
  vis: TileVisibility,
): number {
  const exposedTiles = exposed.flatMap(s => s.tiles)
  const allTiles = [...hand, ...exposedTiles]

  if (def.concealed && exposedTiles.length > 0) return Infinity

  const jokerCount = allTiles.filter(t => t.isJoker).length

  let best = Infinity
  for (const binding of enumerateBindings(def)) {
    const score = scoreBinding(def, binding, allTiles, jokerCount, vis)
    if (score < best) {
      best = score
      if (best === 0) break
    }
  }
  return best
}

export function scoreAllHands(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility,
): HandScore[] {
  const exposedTiles = exposed.flatMap(s => s.tiles)
  const allTiles = [...hand, ...exposedTiles]
  const jokerCount = allTiles.filter(t => t.isJoker).length

  const scores: HandScore[] = []

  for (const def of ALL_HAND_DEFS) {
    if (def.concealed && exposedTiles.length > 0) {
      scores.push({ handDef: def, distance: Infinity, bestBinding: {} })
      continue
    }

    let bestScore = Infinity
    let bestBinding: VarBinding = {}

    for (const binding of enumerateBindings(def)) {
      const score = scoreBinding(def, binding, allTiles, jokerCount, vis)
      if (score < bestScore) {
        bestScore = score
        bestBinding = binding
        if (bestScore === 0) break
      }
    }

    scores.push({ handDef: def, distance: bestScore, bestBinding })
  }

  return scores.sort((a, b) => a.distance - b.distance)
}
