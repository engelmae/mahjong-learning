export type Suit = 'bam' | 'crak' | 'dot' | 'wind' | 'dragon' | 'flower' | 'joker'
export type Wind = 'N' | 'S' | 'E' | 'W'
export type Dragon = 'Red' | 'Green' | 'Soap'
export type GameStatus = 'waiting' | 'charleston' | 'playing' | 'finished' | 'abandoned'
export type CharlestionDirection = 'right' | 'across' | 'left'

export interface Tile {
  id: string
  suit: Suit
  value: number | Wind | Dragon | 'Flower' | 'Joker'
  isJoker: boolean
  label: string
}

export interface ExposedSet {
  tiles: Tile[]
  claimType: 'pung' | 'kong' | 'chow' | 'mahjong'
}

export interface Player {
  nickname: string
  seatIndex: number
  hand: Tile[]
  exposedSets: ExposedSet[]
  discards: Tile[]
  isReady: boolean
  charlestionSelection: Tile[]
  charlestionReady: boolean
}

export interface PendingClaim {
  tile: Tile
  fromPlayerId: string
  expiresAt: number
}

export interface GameState {
  status: GameStatus
  hostId: string
  players: Record<string, Player>
  wall: Tile[]
  wallIndex: number
  currentTurn: string
  lastDiscard: { tile: Tile; fromPlayerId: string } | null
  pendingClaim: PendingClaim | null
  charlestionRound: number
  charlestionDirection: CharlestionDirection
  winner: string | null
}
