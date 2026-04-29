import { ref, set, update, get, onValue, off } from 'firebase/database'
import { getDb } from './firebase'
import { GameState, Tile, ExposedSet, CharlestionDirection } from '@/types/game'
import { buildDeck, shuffleDeck, dealHands } from './tiles'
import { botPickDiscard, botDecideClaim, botPickExposeSet } from './botLogic'

// ── helpers ───────────────────────────────────────────────────────────────────

function gameRef(gameId: string) {
  return ref(getDb(), `games/${gameId}`)
}

function playerRef(gameId: string, playerId: string) {
  return ref(getDb(), `games/${gameId}/players/${playerId}`)
}

function makePlayer(nickname: string, seatIndex: number, isBot = false) {
  return {
    nickname,
    seatIndex,
    hand: [],
    exposedSets: [],
    discards: [],
    isReady: false,
    charlestionSelection: [],
    charlestionReady: false,
    ...(isBot ? { isBot: true } : {}),
  }
}

function blankGameState(hostId: string): GameState {
  return {
    status: 'waiting',
    hostId,
    players: {},
    wall: [],
    wallIndex: 0,
    currentTurn: '',
    lastDiscard: null,
    pendingClaim: null,
    charlestionRound: 0,
    charlestionDirection: 'right',
    winner: null,
  }
}

// ── create / join ─────────────────────────────────────────────────────────────

export async function createGame(gameId: string, hostId: string, nickname: string) {
  const state = blankGameState(hostId)
  state.players[hostId] = makePlayer(nickname, 0)
  await set(gameRef(gameId), state)
}

export async function createGameWithBots(
  gameId: string,
  hostId: string,
  nickname: string,
  botCount: 1 | 2 | 3
) {
  const botNames = ['Bot Amy', 'Bot Ben', 'Bot Cal']
  const state = blankGameState(hostId)
  state.players[hostId] = makePlayer(nickname, 0)
  for (let i = 0; i < botCount; i++) {
    const botId = `bot${i}_${gameId}`
    state.players[botId] = makePlayer(botNames[i], i + 1, true)
  }
  await set(gameRef(gameId), state)
}

export async function joinGame(gameId: string, playerId: string, nickname: string) {
  const snap = await get(gameRef(gameId))
  if (!snap.exists()) throw new Error('Game not found')
  const game = snap.val() as GameState
  const seatIndex = Object.keys(game.players).length
  if (seatIndex >= 4) throw new Error('Game is full')

  await update(playerRef(gameId, playerId), makePlayer(nickname, seatIndex))
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

  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  if (Object.values(game.players).every(p => p.charlestionReady)) {
    await processCharlestionRound(gameId, game)
  }
}

async function processCharlestionRound(gameId: string, game: GameState) {
  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const dir = game.charlestionDirection
  const players = game.players

  const selections = playerIds.map(pid => players[pid].charlestionSelection ?? [])
  const hands = playerIds.map(pid => {
    const selectedIds = new Set((players[pid].charlestionSelection ?? []).map((t: Tile) => t.id))
    return players[pid].hand.filter((t: Tile) => !selectedIds.has(t.id))
  })

  const n = playerIds.length
  const received: Tile[][] = hands.map(() => [])

  if (dir === 'right') {
    for (let i = 0; i < n; i++) received[(i + 1) % n].push(...selections[i])
  } else if (dir === 'across') {
    for (let i = 0; i < n; i++) received[(i + 2) % n].push(...selections[i])
  } else {
    for (let i = 0; i < n; i++) received[(i + n - 1) % n].push(...selections[i])
  }

  const nextRound = game.charlestionRound + 1
  const directions: CharlestionDirection[] = ['right', 'across', 'left', 'left', 'across', 'right']
  const nextDir = directions[nextRound] ?? 'right'
  const done = nextRound >= 6

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

// ── bot actions ───────────────────────────────────────────────────────────────

// Bot draws a tile then discards — used for normal turns
export async function botTakeTurn(gameId: string, botId: string) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  if (game.currentTurn !== botId || game.status !== 'playing') return

  const tile = game.wall[game.wallIndex]
  if (!tile) return  // wall exhausted — GameBoard effect handles it

  const newHand = [...game.players[botId].hand, tile]
  const toDiscard = botPickDiscard(newHand)
  const finalHand = newHand.filter(t => t.id !== toDiscard.id)
  const newDiscards = [...(game.players[botId].discards ?? []), toDiscard]

  await update(ref(getDb()), {
    [`games/${gameId}/wallIndex`]: game.wallIndex + 1,
    [`games/${gameId}/players/${botId}/hand`]: finalHand,
    [`games/${gameId}/players/${botId}/discards`]: newDiscards,
    [`games/${gameId}/lastDiscard`]: { tile: toDiscard, fromPlayerId: botId },
    [`games/${gameId}/pendingClaim`]: {
      tile: toDiscard,
      fromPlayerId: botId,
      expiresAt: Date.now() + 8000,
    },
    [`games/${gameId}/currentTurn`]: '',
  })
}

// Bot claims a discard then immediately discards — used when a bot wins the claim window
export async function botClaimAndDiscard(gameId: string, botId: string): Promise<boolean> {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  if (!game.pendingClaim || game.pendingClaim.fromPlayerId === botId) return false
  if (game.status !== 'playing') return false

  const hand = game.players[botId].hand
  const discardedTile = game.pendingClaim.tile
  const claimType = botDecideClaim(hand, discardedTile)
  if (!claimType) return false

  const tilesFromHand = botPickExposeSet(hand, discardedTile, claimType)
  await claimDiscard(gameId, botId, claimType, tilesFromHand, discardedTile)

  // Brief pause then discard
  await new Promise(r => setTimeout(r, 700 + Math.random() * 600))

  const snap2 = await get(gameRef(gameId))
  const game2 = snap2.val() as GameState
  if (game2.currentTurn !== botId || game2.status !== 'playing') return true

  const toDiscard = botPickDiscard(game2.players[botId].hand)
  await discardTile(gameId, botId, toDiscard)
  return true
}

// ── game lifecycle ────────────────────────────────────────────────────────────

export async function declareMahjong(gameId: string, playerId: string) {
  await update(ref(getDb()), {
    [`games/${gameId}/status`]: 'finished',
    [`games/${gameId}/winner`]: playerId,
  })
}

export async function declareWallExhausted(gameId: string) {
  await update(ref(getDb()), {
    [`games/${gameId}/status`]: 'finished',
    [`games/${gameId}/winner`]: 'draw',
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

export async function leaveGame(gameId: string, playerId: string) {
  const snap = await get(gameRef(gameId))
  if (!snap.exists()) return
  const game = snap.val() as GameState

  const updates: Record<string, unknown> = {
    [`games/${gameId}/players/${playerId}`]: null,
  }

  const remainingEntries = Object.entries(game.players).filter(([pid]) => pid !== playerId)
  if (remainingEntries.length === 0) {
    await set(gameRef(gameId), null)
    return
  }

  const remainingHumans = remainingEntries.filter(([, p]) => !p.isBot).length
  if (game.hostId === playerId || (game.status !== 'waiting' && remainingHumans === 0)) {
    updates[`games/${gameId}/status`] = 'abandoned'
  }

  await update(ref(getDb()), updates)
}
