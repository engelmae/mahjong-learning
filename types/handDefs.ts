import type { Tile, ExposedSet } from './game'

export type SuitVar = 'S1' | 'S2' | 'S3'
export type ValueVar = 'V1' | 'V2' | 'V3'
export type NumberSuit = 'bam' | 'crak' | 'dot'

// Dragon identity: exact name, suit-relative alias, or 'any'.
// match-SN = dragon whose color matches suit SN (bam→Green, crak→Red, dot→Soap)
// opp-S1   = dragon that does NOT match suit S1
// any      = any of the three dragons
export type DragonValue =
  | 'Red' | 'Green' | 'Soap'
  | 'match-S1' | 'match-S2' | 'match-S3'
  | 'opp-S1'
  | 'any'

export type GroupSpec =
  | NumberGroupSpec
  | WindGroupSpec
  | DragonGroupSpec
  | FlowerGroupSpec

export interface NumberGroupSpec {
  kind: 'number'
  suit: NumberSuit | SuitVar
  value: number | ValueVar
  // count:1 = single tile; count:2 = pair. Both require jokerOk:false.
  count: 1 | 2 | 3 | 4 | 5
  jokerOk: boolean
}

export interface WindGroupSpec {
  kind: 'wind'
  // 'NEWS' encodes one each of N, E, W, S (4 singles, jokerOk must be false)
  value: 'N' | 'S' | 'E' | 'W' | 'NEWS'
  count: 1 | 2 | 3 | 4 | 5
  jokerOk: boolean
}

export interface DragonGroupSpec {
  kind: 'dragon'
  value: DragonValue
  count: 1 | 2 | 3 | 4 | 5
  jokerOk: boolean
}

export interface FlowerGroupSpec {
  kind: 'flower'
  count: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  jokerOk: false
}

export type Constraint =
  | { op: 'sum';    lhs: ValueVar; rhs: ValueVar; result: ValueVar }
  | { op: 'in-set'; lhs: ValueVar; values: number[] }
  | { op: 'consec'; vars: ValueVar[] }

export type HandCategory =
  | 'year' | '2468' | 'like-numbers' | 'consec-run'
  | 'winds-dragons' | 'quints' | '13579' | '369' | 'singles-pairs'

export interface HandDef {
  id: string
  name: string
  category: HandCategory
  groups: GroupSpec[]
  points: number
  concealed: boolean
  constraints?: Constraint[]
}

export interface VarBinding {
  S1?: NumberSuit
  S2?: NumberSuit
  S3?: NumberSuit
  V1?: number
  V2?: number
  V3?: number
}

export interface TileVisibility {
  discarded: Tile[]
  opponentExposed: Tile[]
  // total copies in the full 152-tile deck: 4 for most, 8 for flowers, 8 for jokers
  deckCounts: Record<string, number>
}

export interface HandScore {
  handDef: HandDef
  distance: number      // 0.0 = Mahjong; float weighted by tile scarcity
  bestBinding: VarBinding
}
