import { Tile, Suit } from '@/types/game'

const TILE_EMOJIS: Record<string, string> = {
  'bam-1': '🎋1', 'bam-2': '🎋2', 'bam-3': '🎋3', 'bam-4': '🎋4', 'bam-5': '🎋5',
  'bam-6': '🎋6', 'bam-7': '🎋7', 'bam-8': '🎋8', 'bam-9': '🎋9',
  'crak-1': '🀄1', 'crak-2': '🀄2', 'crak-3': '🀄3', 'crak-4': '🀄4', 'crak-5': '🀄5',
  'crak-6': '🀄6', 'crak-7': '🀄7', 'crak-8': '🀄8', 'crak-9': '🀄9',
  'dot-1': '●1', 'dot-2': '●2', 'dot-3': '●3', 'dot-4': '●4', 'dot-5': '●5',
  'dot-6': '●6', 'dot-7': '●7', 'dot-8': '●8', 'dot-9': '●9',
  'wind-N': 'N風', 'wind-S': 'S風', 'wind-E': 'E風', 'wind-W': 'W風',
  'dragon-Red': '中', 'dragon-Green': '發', 'dragon-Soap': '白',
  'flower-Flower': '🌸',
  'joker-Joker': '🃏',
}

function makeTile(suit: Suit, value: string | number, id: string): Tile {
  const key = `${suit}-${value}`
  return {
    id,
    suit,
    value: value as Tile['value'],
    isJoker: suit === 'joker',
    label: TILE_EMOJIS[key] ?? `${suit}${value}`,
  }
}

let _uidCounter = 0
function uid() {
  return `t${Date.now()}-${++_uidCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export function buildDeck(): Tile[] {
  const tiles: Tile[] = []

  const suits: Array<[Suit, (string | number)[]]> = [
    ['bam', [1,2,3,4,5,6,7,8,9]],
    ['crak', [1,2,3,4,5,6,7,8,9]],
    ['dot', [1,2,3,4,5,6,7,8,9]],
    ['wind', ['N','S','E','W']],
    ['dragon', ['Red','Green','Soap']],
  ]

  for (const [suit, values] of suits) {
    for (const val of values) {
      for (let i = 0; i < 4; i++) {
        tiles.push(makeTile(suit, val, uid()))
      }
    }
  }

  // 8 flowers
  for (let i = 0; i < 8; i++) {
    tiles.push(makeTile('flower', 'Flower', uid()))
  }

  // 8 jokers
  for (let i = 0; i < 8; i++) {
    tiles.push(makeTile('joker', 'Joker', uid()))
  }

  return tiles
}

export function shuffleDeck(tiles: Tile[]): Tile[] {
  const arr = [...tiles]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function dealHands(shuffled: Tile[]): {
  hands: [Tile[], Tile[], Tile[], Tile[]]
  wall: Tile[]
} {
  const hands: [Tile[], Tile[], Tile[], Tile[]] = [[], [], [], []]
  // Deal 13 tiles each
  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < 4; p++) {
      hands[p].push(shuffled[round * 4 + p])
    }
  }
  const wall = shuffled.slice(52)
  return { hands, wall }
}

export function tileColor(tile: Tile): string {
  switch (tile.suit) {
    case 'bam': return 'bg-green-100 border-green-500 text-green-900'
    case 'crak': return 'bg-red-100 border-red-500 text-red-900'
    case 'dot': return 'bg-blue-100 border-blue-500 text-blue-900'
    case 'wind': return 'bg-gray-100 border-gray-500 text-gray-900'
    case 'dragon': return 'bg-yellow-100 border-yellow-600 text-yellow-900'
    case 'flower': return 'bg-pink-100 border-pink-400 text-pink-900'
    case 'joker': return 'bg-purple-100 border-purple-500 text-purple-900'
    default: return 'bg-white border-gray-300'
  }
}
