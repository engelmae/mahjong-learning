import { ref, set, update, get, onValue, off } from 'firebase/database'
import { getDb } from './firebase'
import { GameState, Tile, ExposedSet, CharlestionDirection, BotDifficulty } from '@/types/game'
import { buildDeck, shuffleDeck, dealHands } from './tiles'
import { pickDiscard, decideClaim, botPickExposeSet, botCheckWin, buildVisibility, clearBotBrain } from './botDifficulty'

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
  botCount: 1 | 2 | 3,
  difficulty: BotDifficulty = 'moderate'
) {
  const botNames = ['Amy', 'Ben', 'Cal']
  const state = blankGameState(hostId)
  state.players[hostId] = makePlayer(nickname, 0)
  state.botDifficulty = difficulty
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
  // Race guard: only draw if it's actually our turn and we haven't already drawn.
  // hand + sum(exposed set sizes) is 13 between turns and 14 after a draw or
  // claim — refuse the draw if we're already at 14 (prevents double-draw from
  // double-clicks or stale local state).
  if (game.currentTurn !== playerId) return
  const me = game.players[playerId]
  if (!me) return
  const handLen = me.hand?.length ?? 0
  const exposedTiles = (me.exposedSets ?? []).reduce((s, e) => s + (e.tiles?.length ?? 0), 0)
  if (handLen + exposedTiles >= 14) return
  const tile = game.wall[game.wallIndex]
  if (!tile) throw new Error('Wall is empty')

  await update(ref(getDb()), {
    [`games/${gameId}/wallIndex`]: game.wallIndex + 1,
    [`games/${gameId}/players/${playerId}/hand`]: [...me.hand, tile],
  })
}

export async function discardTile(gameId: string, playerId: string, tile: Tile) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  // Race guard: refuse if the tile isn't actually in hand (already discarded by a duplicate call)
  const handHasTile = (game.players[playerId]?.hand ?? []).some(t => t.id === tile.id)
  if (!handHasTile) return
  const newHand = game.players[playerId].hand.filter(t => t.id !== tile.id)
  const newDiscards = [...(game.players[playerId].discards ?? []), tile]

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const fromIdx = playerIds.indexOf(playerId)
  const nextTurn = playerIds[(fromIdx + 1) % playerIds.length]

  // Jokers are never callable — skip the claim window entirely
  if (tile.isJoker) {
    await update(ref(getDb()), {
      [`games/${gameId}/players/${playerId}/hand`]: newHand,
      [`games/${gameId}/players/${playerId}/discards`]: newDiscards,
      [`games/${gameId}/lastDiscard`]: { tile, fromPlayerId: playerId },
      [`games/${gameId}/pendingClaim`]: null,
      [`games/${gameId}/currentTurn`]: nextTurn,
    })
    return
  }

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
  // Race guard: only proceed if this discard is still pending and matches the tile.
  // Prevents a stale claim from re-firing after the discard already resolved.
  if (!game.pendingClaim || game.pendingClaim.tile.id !== discardedTile.id) return
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

// Player explicitly declines to claim. When every non-discarder player has
// declined (or already passed), short-circuit the claim window via passClaim.
// Bots vote via this same path so consensus works in mixed bot/human games.
export async function voteNoThanks(gameId: string, playerId: string) {
  const snap = await get(gameRef(gameId))
  const game = snap.val() as GameState
  if (!game.pendingClaim) return
  if (game.pendingClaim.fromPlayerId === playerId) return
  // Don't override someone actively in claim mode — they're still considering
  if (game.pendingClaim.claimingPlayerId === playerId) return

  await update(ref(getDb()), {
    [`games/${gameId}/pendingClaim/noThanksBy/${playerId}`]: true,
  })

  // Re-read so the consensus check uses post-write state — concurrent voters
  // would otherwise each see only their own vote and never trigger passClaim.
  const snap2 = await get(gameRef(gameId))
  const game2 = snap2.val() as GameState
  if (!game2.pendingClaim) return
  if (game2.pendingClaim.tile.id !== game.pendingClaim.tile.id) return
  const fresh = game2.pendingClaim.noThanksBy ?? {}
  const eligible = Object.keys(game2.players).filter(pid => pid !== game2.pendingClaim!.fromPlayerId)
  if (eligible.every(pid => fresh[pid])) {
    await passClaim(gameId)
  }
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

export async function enterClaimMode(gameId: string, playerId: string) {
  await update(ref(getDb()), {
    [`games/${gameId}/pendingClaim/claimingPlayerId`]: playerId,
  })
}

export async function exitClaimMode(gameId: string) {
  await update(ref(getDb()), {
    [`games/${gameId}/pendingClaim/claimingPlayerId`]: null,
    [`games/${gameId}/pendingClaim/expiresAt`]: Date.now() + 6000,
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
  const botExposed: ExposedSet[] = game.players[botId].exposedSets ?? []

  // Build tile visibility from all discards + opponent exposed sets
  const allDiscards = Object.values(game.players).flatMap(p => p.discards ?? [])
  const opponentExposed = Object.entries(game.players)
    .filter(([pid]) => pid !== botId)
    .flatMap(([, p]) => (p.exposedSets ?? []).flatMap((s: ExposedSet) => s.tiles))
  const vis = buildVisibility(allDiscards, opponentExposed)

  // Win check before discarding
  if (botCheckWin(newHand, botExposed, vis)) {
    await update(ref(getDb()), {
      [`games/${gameId}/wallIndex`]: game.wallIndex + 1,
      [`games/${gameId}/players/${botId}/hand`]: newHand,
    })
    await declareMahjong(gameId, botId)
    return
  }

  const difficulty = game.botDifficulty ?? 'moderate'
  const toDiscard = pickDiscard(newHand, botExposed, vis, gameId, botId, difficulty, game.players)
  const finalHand = newHand.filter(t => t.id !== toDiscard.id)
  const newDiscards = [...(game.players[botId].discards ?? []), toDiscard]

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const botIdx = playerIds.indexOf(botId)
  const nextTurn = playerIds[(botIdx + 1) % playerIds.length]

  // Jokers are never callable — skip claim window
  if (toDiscard.isJoker) {
    await update(ref(getDb()), {
      [`games/${gameId}/wallIndex`]: game.wallIndex + 1,
      [`games/${gameId}/players/${botId}/hand`]: finalHand,
      [`games/${gameId}/players/${botId}/discards`]: newDiscards,
      [`games/${gameId}/lastDiscard`]: { tile: toDiscard, fromPlayerId: botId },
      [`games/${gameId}/pendingClaim`]: null,
      [`games/${gameId}/currentTurn`]: nextTurn,
    })
    return
  }

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
  const botExposed: ExposedSet[] = game.players[botId].exposedSets ?? []
  const discardedTile = game.pendingClaim.tile

  const allDiscards = Object.values(game.players).flatMap(p => p.discards ?? [])
  const opponentExposed = Object.entries(game.players)
    .filter(([pid]) => pid !== botId)
    .flatMap(([, p]) => (p.exposedSets ?? []).flatMap((s: ExposedSet) => s.tiles))
  const vis = buildVisibility(allDiscards, opponentExposed)

  const difficulty = game.botDifficulty ?? 'moderate'
  const claimType = decideClaim(hand, botExposed, discardedTile, vis, gameId, botId, difficulty)
  if (!claimType) return false

  if (claimType === 'mahjong') {
    await claimDiscard(gameId, botId, 'mahjong', [], discardedTile)
    return true
  }

  const tilesFromHand = botPickExposeSet(hand, discardedTile, claimType)
  await claimDiscard(gameId, botId, claimType, tilesFromHand, discardedTile)

  // Brief pause then discard
  await new Promise(r => setTimeout(r, 700 + Math.random() * 600))

  const snap2 = await get(gameRef(gameId))
  const game2 = snap2.val() as GameState
  if (game2.currentTurn !== botId || game2.status !== 'playing') return true

  const newBotExposed2: ExposedSet[] = game2.players[botId].exposedSets ?? []
  const allDiscards2 = Object.values(game2.players).flatMap(p => p.discards ?? [])
  const oppExposed2 = Object.entries(game2.players)
    .filter(([pid]) => pid !== botId)
    .flatMap(([, p]) => (p.exposedSets ?? []).flatMap((s: ExposedSet) => s.tiles))
  const vis2 = buildVisibility(allDiscards2, oppExposed2)

  // Win check after claim (in case claiming completed the hand)
  if (botCheckWin(game2.players[botId].hand, newBotExposed2, vis2)) {
    await declareMahjong(gameId, botId)
    return true
  }

  const difficulty2 = game2.botDifficulty ?? 'moderate'
  const toDiscard = pickDiscard(game2.players[botId].hand, newBotExposed2, vis2, gameId, botId, difficulty2, game2.players)
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

  // Drop cached bot brains so the rematch picks fresh targets.
  clearBotBrain(gameId)

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

// Mid-game exits "pause" the seat so the same link can rejoin and pick up the
// hand. Pre-game (waiting) and post-game (finished/abandoned) exits remove the
// player entirely. Returns true if the seat was kept (rejoin possible).
export async function leaveGame(gameId: string, playerId: string): Promise<boolean> {
  const snap = await get(gameRef(gameId))
  if (!snap.exists()) return false
  const game = snap.val() as GameState

  const isMidGame = game.status === 'charleston' || game.status === 'playing'
  if (isMidGame && game.players[playerId]) {
    // Don't remove from Firebase — leave the seat & hand intact for rejoin.
    return true
  }

  const updates: Record<string, unknown> = {
    [`games/${gameId}/players/${playerId}`]: null,
  }

  const remainingEntries = Object.entries(game.players).filter(([pid]) => pid !== playerId)
  if (remainingEntries.length === 0) {
    await set(gameRef(gameId), null)
    return false
  }

  const remainingHumans = remainingEntries.filter(([, p]) => !p.isBot).length
  if (game.hostId === playerId || (game.status !== 'waiting' && remainingHumans === 0)) {
    updates[`games/${gameId}/status`] = 'abandoned'
  }

  await update(ref(getDb()), updates)
  return false
}
