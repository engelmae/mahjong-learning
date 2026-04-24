import { ref, set, update, get, onValue, off } from 'firebase/database'
import { getDb } from './firebase'
import { GameState, Tile, ExposedSet, CharlestionDirection } from '@/types/game'
import { buildDeck, shuffleDeck, dealHands } from './tiles'

// ── helpers ──────────────────────────────────────────────────────────────────

function gameRef(gameId: string) {
  return ref(getDb(), `games/${gameId}`)
}

function playerRef(gameId: string, playerId: string) {
  return ref(getDb(), `games/${gameId}/players/${playerId}`)
}

// ── create / join ─────────────────────────────────────────────────────────────

export async function createGame(gameId: string, hostId: string, nickname: string) {
  const initialState: GameState = {
    status: 'waiting',
    hostId,
    players: {
      [hostId]: {
        nickname,
        seatIndex: 0,
        hand: [],
        exposedSets: [],
        discards: [],
        isReady: false,
        charlestionSelection: [],
        charlestionReady: false,
      },
    },
    wall: [],
    wallIndex: 0,
    currentTurn: '',
    lastDiscard: null,
    pendingClaim: null,
    charlestionRound: 0,
    charlestionDirection: 'right',
    winner: null,
  }
  await set(gameRef(gameId), initialState)
}

export async function joinGame(gameId: string, playerId: string, nickname: string) {
  const snap = await get(gameRef(gameId))
  if (!snap.exists()) throw new Error('Game not found')
  const game = snap.val() as GameState
  const seatIndex = Object.keys(game.players).length
  if (seatIndex >= 4) throw new Error('Game is full')

  await update(playerRef(gameId, playerId), {
    nickname,
    seatIndex,
    hand: [],
    exposedSets: [],
    discards: [],
    isReady: false,
    charlestionSelection: [],
    charlestionReady: false,
  })
}

// ── subscribe ─────────────────────────────────────────────────────────────────

export function subscribeToGame(gameId: string, callback: (game: GameState | null) => void) {
  const r = gameRef(gameId)
  const handler = (snap: any) => callback(snap.exists() ? (snap.val() as GameState) : null)
  onValue(r, handler)
  return () => off(r, 'value', handler)
}

// ── deal ──────────────────────────────────────────────────────────────────────

export async function dealGame(gameId: string) {
  const deck = shuffleDeck(buildDeck())
  const { hands, wall } = dealHands(deck)

  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )

  const updates: Record<string, unknown> = {
    [`games/${gameId}/wall`]: wall,
    [`games/${gameId}/wallIndex`]: 0,
    [`games/${gameId}/status`]: 'charleston',
    [`games/${gameId}/charlestionRound`]: 0,
    [`games/${gameId}/charlestionDirection`]: 'right',
  }

  playerIds.forEach((pid, i) => {
    updates[`games/${gameId}/players/${pid}/hand`] = hands[i] ?? []
    updates[`games/${gameId}/players/${pid}/charlestionSelection`] = []
    updates[`games/${gameId}/players/${pid}/charlestionReady`] = false
  })

  await update(ref(getDb()), updates)
}

// ── charleston ────────────────────────────────────────────────────────────────

export async function submitCharlestionPass(
  gameId: string,
  playerId: string,
  selectedTiles: Tile[]
) {
  await update(ref(getDb()), {
    [`games/${gameId}/players/${playerId}/charlestionSelection`]: selectedTiles,
    [`games/${gameId}/players/${playerId}/charlestionReady`]: true,
  })

  // Check if all players are ready
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const players = game.players
  const allReady = Object.values(players).every(p => p.charlestionReady)

  if (allReady) {
    await processCharlestionRound(gameId, game)
  }
}

async function processCharlestionRound(gameId: string, game: GameState) {
  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const dir = game.charlestionDirection
  const players = game.players

  // Build new hands by removing selected tiles and receiving from neighbor
  const selections = playerIds.map(pid => players[pid].charlestionSelection ?? [])
  const hands = playerIds.map(pid => {
    const selectedIds = new Set((players[pid].charlestionSelection ?? []).map((t: Tile) => t.id))
    return players[pid].hand.filter((t: Tile) => !selectedIds.has(t.id))
  })

  // Determine who receives whose tiles
  const n = playerIds.length // 4
  const received: Tile[][] = hands.map(() => [])

  if (dir === 'right') {
    // seat 0 passes to seat 1, seat 1 to seat 2, etc.
    for (let i = 0; i < n; i++) {
      const to = (i + 1) % n
      received[to].push(...selections[i])
    }
  } else if (dir === 'across') {
    for (let i = 0; i < n; i++) {
      const to = (i + 2) % n
      received[to].push(...selections[i])
    }
  } else {
    // left: seat 0 passes to seat 3, etc.
    for (let i = 0; i < n; i++) {
      const to = (i + n - 1) % n
      received[to].push(...selections[i])
    }
  }

  const nextRound = game.charlestionRound + 1
  const directions: CharlestionDirection[] = ['right', 'across', 'left']
  const nextDir = directions[nextRound] ?? 'left'
  const done = nextRound >= 3

  const updates: Record<string, unknown> = {
    [`games/${gameId}/charlestionRound`]: nextRound,
    [`games/${gameId}/charlestionDirection`]: nextDir,
    [`games/${gameId}/status`]: done ? 'playing' : 'charleston',
    [`games/${gameId}/currentTurn`]: done ? playerIds[0] : '',
  }

  playerIds.forEach((pid, i) => {
    updates[`games/${gameId}/players/${pid}/hand`] = [...hands[i], ...received[i]]
    updates[`games/${gameId}/players/${pid}/charlestionSelection`] = []
    updates[`games/${gameId}/players/${pid}/charlestionReady`] = false
  })

  await update(ref(getDb()), updates)
}

// ── gameplay ──────────────────────────────────────────────────────────────────

export async function drawTile(gameId: string, playerId: string) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const tile = game.wall[game.wallIndex]
  if (!tile) throw new Error('Wall is empty')

  await update(ref(getDb()), {
    [`games/${gameId}/wallIndex`]: game.wallIndex + 1,
    [`games/${gameId}/players/${playerId}/hand`]: [...game.players[playerId].hand, tile],
  })
}

export async function discardTile(gameId: string, playerId: string, tile: Tile) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const newHand = game.players[playerId].hand.filter(t => t.id !== tile.id)
  const newDiscards = [...(game.players[playerId].discards ?? []), tile]

  await update(ref(getDb()), {
    [`games/${gameId}/players/${playerId}/hand`]: newHand,
    [`games/${gameId}/players/${playerId}/discards`]: newDiscards,
    [`games/${gameId}/lastDiscard`]: { tile, fromPlayerId: playerId },
    [`games/${gameId}/pendingClaim`]: {
      tile,
      fromPlayerId: playerId,
      expiresAt: Date.now() + 8000,
    },
    [`games/${gameId}/currentTurn`]: '',
  })
}

export async function claimDiscard(
  gameId: string,
  claimantId: string,
  claimType: 'pung' | 'kong' | 'chow' | 'mahjong',
  tilesFromHand: Tile[],
  discardedTile: Tile
) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const hand = game.players[claimantId].hand
  const usedIds = new Set(tilesFromHand.map(t => t.id))
  const newHand = hand.filter(t => !usedIds.has(t.id))
  const setTiles = [...tilesFromHand, discardedTile]
  const exposedSet: ExposedSet = { tiles: setTiles, claimType }
  const newExposed = [...(game.players[claimantId].exposedSets ?? []), exposedSet]

  // Remove from the discard pile of the person who discarded
  const fromPid = game.lastDiscard!.fromPlayerId
  const fromDiscards = (game.players[fromPid].discards ?? []).filter(t => t.id !== discardedTile.id)

  const updates: Record<string, unknown> = {
    [`games/${gameId}/players/${claimantId}/hand`]: newHand,
    [`games/${gameId}/players/${claimantId}/exposedSets`]: newExposed,
    [`games/${gameId}/players/${fromPid}/discards`]: fromDiscards,
    [`games/${gameId}/pendingClaim`]: null,
    [`games/${gameId}/lastDiscard`]: null,
  }

  if (claimType === 'mahjong') {
    updates[`games/${gameId}/status`] = 'finished'
    updates[`games/${gameId}/winner`] = claimantId
  } else {
    updates[`games/${gameId}/currentTurn`] = claimantId
  }

  await update(ref(getDb()), updates)
}

export async function passClaim(gameId: string) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  if (!game.pendingClaim) return

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const fromPid = game.pendingClaim.fromPlayerId
  const fromIdx = playerIds.indexOf(fromPid)
  const nextIdx = (fromIdx + 1) % playerIds.length
  const nextPid = playerIds[nextIdx]

  await update(ref(getDb()), {
    [`games/${gameId}/pendingClaim`]: null,
    [`games/${gameId}/lastDiscard`]: null,
    [`games/${gameId}/currentTurn`]: nextPid,
  })
}

export async function declareMahjong(gameId: string, playerId: string) {
  await update(ref(getDb()), {
    [`games/${gameId}/status`]: 'finished',
    [`games/${gameId}/winner`]: playerId,
  })
}

export async function swapJoker(
  gameId: string,
  setOwnerId: string,
  setIndex: number,
  jokerIndexInSet: number,
  swapperId: string,
  replacementTile: Tile,
  jokerTile: Tile
) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState

  const ownerSets = [...game.players[setOwnerId].exposedSets]
  const targetSet = { ...ownerSets[setIndex], tiles: [...ownerSets[setIndex].tiles] }
  targetSet.tiles[jokerIndexInSet] = replacementTile
  ownerSets[setIndex] = targetSet

  const swapperHand = game.players[swapperId].hand.filter(t => t.id !== replacementTile.id)
  const swapperHandWithJoker = [...swapperHand, jokerTile]

  await update(ref(getDb()), {
    [`games/${gameId}/players/${setOwnerId}/exposedSets`]: ownerSets,
    [`games/${gameId}/players/${swapperId}/hand`]: swapperHandWithJoker,
  })
}

export async function resetGame(gameId: string) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  const playerIds = Object.keys(game.players)

  const updates: Record<string, unknown> = {
    [`games/${gameId}/status`]: 'waiting',
    [`games/${gameId}/wall`]: [],
    [`games/${gameId}/wallIndex`]: 0,
    [`games/${gameId}/currentTurn`]: '',
    [`games/${gameId}/lastDiscard`]: null,
    [`games/${gameId}/pendingClaim`]: null,
    [`games/${gameId}/charlestionRound`]: 0,
    [`games/${gameId}/charlestionDirection`]: 'right',
    [`games/${gameId}/winner`]: null,
  }

  playerIds.forEach(pid => {
    updates[`games/${gameId}/players/${pid}/hand`] = []
    updates[`games/${gameId}/players/${pid}/exposedSets`] = []
    updates[`games/${gameId}/players/${pid}/discards`] = []
    updates[`games/${gameId}/players/${pid}/isReady`] = false
    updates[`games/${gameId}/players/${pid}/charlestionSelection`] = []
    updates[`games/${gameId}/players/${pid}/charlestionReady`] = false
  })

  await update(ref(getDb()), updates)
}
