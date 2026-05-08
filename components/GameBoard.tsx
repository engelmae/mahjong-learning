'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { ref, update } from 'firebase/database'
import { getDb } from '@/lib/firebase'
import { GameState, Tile, ExposedSet } from '@/types/game'
import TileComponent from './Tile'
import { drawTile, discardTile, claimDiscard, passClaim, voteNoThanks, enterClaimMode, exitClaimMode, declareMahjong, declareWallExhausted, swapJoker, resetGame } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'
import { useTileDrag } from '@/lib/useTileDrag'

const HAND_ORDER_KEY = (gameId: string, playerId: string) => `mahjong_handOrder_${gameId}_${playerId}`
const ESET_PREFIX = 'eset:'
const esetId = (set: ExposedSet) => `${ESET_PREFIX}${set.tiles[0]?.id ?? ''}`

const SUIT_ORDER: Record<string, number> = { bam: 0, crak: 1, dot: 2, wind: 3, dragon: 4, flower: 5, joker: 6 }
const WIND_ORDER: Record<string, number> = { E: 0, S: 1, W: 2, N: 3 }
const DRAGON_ORDER: Record<string, number> = { Red: 0, Green: 1, Soap: 2 }

function tileSort(a: Tile, b: Tile): number {
  const sd = (SUIT_ORDER[a.suit] ?? 9) - (SUIT_ORDER[b.suit] ?? 9)
  if (sd !== 0) return sd
  const av = typeof a.value === 'number' ? a.value : (WIND_ORDER[a.value as string] ?? DRAGON_ORDER[a.value as string] ?? 0)
  const bv = typeof b.value === 'number' ? b.value : (WIND_ORDER[b.value as string] ?? DRAGON_ORDER[b.value as string] ?? 0)
  return (av as number) - (bv as number)
}

const BTN_DRAW    = 'bg-emerald-400 hover:bg-emerald-300 text-black font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'
const BTN_DISCARD = 'bg-[#5aabff] hover:bg-[#7bbeff] text-black font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'
const BTN_CALL    = 'bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'
const BTN_MAHJONG = 'bg-violet-500 hover:bg-violet-400 text-white font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'
const BTN_MUTED   = 'bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'
const BTN_OUTLINE = 'border border-slate-500 text-slate-300 hover:bg-slate-700 font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'

interface Props {
  game: GameState
  gameId: string
  myPlayerId: string
  onLeave: () => void
}

export default function GameBoard({ game, gameId, myPlayerId, onLeave }: Props) {
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [drewThisTurn, setDrewThisTurn] = useState(false)
  const [drawnTileId, setDrawnTileId] = useState<string | null>(null)
  const [myAreaOrder, setMyAreaOrder] = useState<string[]>([])
  const [showDiscards, setShowDiscards] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [claimMode, setClaimMode] = useState(false)
  const [claimSelection, setClaimSelection] = useState<string[]>([])
  const [drawing, setDrawing] = useState(false)
  const [discardingId, setDiscardingId] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const prevHandRef = useRef<string[]>([])
  const claimModeRef = useRef(false)
  claimModeRef.current = claimMode
  const justClaimedRef = useRef(false)
  const pauseStartRef = useRef<number | null>(null)
  const localExpiresAtRef = useRef<number>(0)
  const myAreaOrderInitRef = useRef(false)

  const me = game.players[myPlayerId]
  const isMyTurn = game.currentTurn === myPlayerId
  const pending = game.pendingClaim
  const isMyDiscard = pending?.fromPlayerId === myPlayerId
  const someoneElseClaiming = !!pending?.claimingPlayerId && pending.claimingPlayerId !== myPlayerId
  const canClaim = !!pending && !isMyDiscard && game.status === 'playing'

  const pendingRef = useRef(pending)
  pendingRef.current = pending

  // Locked in once per discard tile — only recomputes when pending.tile.id changes,
  // so re-renders from claimMode/selection changes never produce a new duration string
  // that would restart the CSS animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const claimBarDuration = useMemo(
    () => pending ? Math.max(0.1, (pending.expiresAt - Date.now()) / 1000) : 0,
    [pending?.tile?.id]
  )

  const drag = useTileDrag(myAreaOrder, setMyAreaOrder)

  // Sync myAreaOrder: hand tiles + exposed set slots as a unified list.
  // Exposed sets are keyed by their first-tile id (stable across reorder writes).
  useEffect(() => {
    const tileIds = (me?.hand ?? []).map(t => t.id)
    const sIds = (me?.exposedSets ?? []).map(esetId)
    const allValid = new Set([...tileIds, ...sIds])
    setMyAreaOrder(prev => {
      // First mount: seed from localStorage to preserve order across the
      // charleston→playing transition and across page reloads.
      let seed = prev
      if (!myAreaOrderInitRef.current && prev.length === 0 && typeof window !== 'undefined') {
        myAreaOrderInitRef.current = true
        try {
          const saved = window.localStorage.getItem(HAND_ORDER_KEY(gameId, myPlayerId))
          if (saved) seed = JSON.parse(saved) as string[]
        } catch {}
      }
      const retained = seed.filter(id => allValid.has(id))
      const retainedSet = new Set(retained)
      const newSIds = sIds.filter(id => !retainedSet.has(id))
      const newTIds = tileIds.filter(id => !retainedSet.has(id))
      return [...retained, ...newSIds, ...newTIds]
    })
  }, [(me?.hand ?? []).map(t => t.id).join(','), (me?.exposedSets ?? []).map(esetId).join(','), gameId, myPlayerId])

  // Persist hand-order locally so it survives across reloads and the
  // charleston→playing transition.
  useEffect(() => {
    if (myAreaOrder.length === 0) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(HAND_ORDER_KEY(gameId, myPlayerId), JSON.stringify(myAreaOrder))
    } catch {}
  }, [myAreaOrder, gameId, myPlayerId])

  // Sync exposed-set order to opponents: when the user reorders eset entries
  // in their bottom strip, write the reordered exposedSets array to Firebase
  // so all clients see the new order.
  useEffect(() => {
    const sets = me?.exposedSets ?? []
    if (sets.length < 2) return
    const desiredEsetIds = myAreaOrder.filter(id => id.startsWith(ESET_PREFIX))
    if (desiredEsetIds.length !== sets.length) return
    // Build the reordered array
    const byId = new Map(sets.map(s => [esetId(s), s]))
    const reordered = desiredEsetIds.map(id => byId.get(id)).filter(Boolean) as ExposedSet[]
    if (reordered.length !== sets.length) return
    const currentKey = sets.map(esetId).join('|')
    const nextKey = reordered.map(esetId).join('|')
    if (currentKey === nextKey) return
    update(ref(getDb()), {
      [`games/${gameId}/players/${myPlayerId}/exposedSets`]: reordered,
    })
  }, [myAreaOrder, me?.exposedSets, gameId, myPlayerId])

  // Detect drawn tile (hand grows by 1)
  useEffect(() => {
    const currentIds = (me?.hand ?? []).map(t => t.id)
    const prev = prevHandRef.current
    if (currentIds.length === prev.length + 1) {
      const prevSet = new Set(prev)
      const newId = currentIds.find(id => !prevSet.has(id))
      if (newId) setDrawnTileId(newId)
    }
    prevHandRef.current = currentIds
  }, [(me?.hand ?? []).map(t => t.id).join(',')])

  // Claim countdown + auto-advance passClaim
  useEffect(() => {
    if (!pending) { setShowClaim(false); return }

    if (isMyDiscard) {
      // Don't auto-advance while someone is actively in claim mode
      if (pending.claimingPlayerId) return
      const remaining = Math.max(0, pending.expiresAt - Date.now())
      const t = setTimeout(() => passClaim(gameId), remaining + 300)
      return () => clearTimeout(t)
    }

    setShowClaim(true)
    localExpiresAtRef.current = pending.expiresAt
    pauseStartRef.current = null
    const tick = () => {
      if (claimModeRef.current) return
      if (pendingRef.current?.claimingPlayerId) return  // someone else is considering
      if (Date.now() >= localExpiresAtRef.current) {
        setShowClaim(false)
        passClaim(gameId)
      }
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [pending?.tile?.id, pending?.claimingPlayerId, isMyDiscard])

  useEffect(() => {
    if (!showClaim) { setClaimMode(false); setClaimSelection([]) }
  }, [showClaim])

  // Pause/resume the JS expiry clock in sync with the CSS animation
  useEffect(() => {
    if (claimMode) {
      pauseStartRef.current = Date.now()
    } else if (pauseStartRef.current !== null) {
      const remainingAtPause = localExpiresAtRef.current - pauseStartRef.current
      localExpiresAtRef.current = Date.now() + Math.max(0, remainingAtPause)
      pauseStartRef.current = null
    }
  }, [claimMode])

  useEffect(() => {
    if (justClaimedRef.current) {
      justClaimedRef.current = false
      setDrewThisTurn(true)
    } else {
      setDrewThisTurn(false)
    }
    setSelectedTile(null)
    setDrawnTileId(null)
  }, [game.currentTurn])

  // Wall exhaustion: when the active player would draw but nothing remains, end the game
  const wallLeft = Math.max(0, (game.wall?.length ?? 0) - game.wallIndex)
  useEffect(() => {
    if (game.status === 'playing' && isMyTurn && !drewThisTurn && wallLeft === 0) {
      declareWallExhausted(gameId)
    }
  }, [wallLeft, isMyTurn, drewThisTurn, game.status])

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const opponents = playerIds.filter(id => id !== myPlayerId)

  function sortHand() {
    const sIds = (me?.exposedSets ?? []).map(esetId)
    const sortedTileIds = [...(me?.hand ?? [])].sort(tileSort).map(t => t.id)
    setMyAreaOrder([...sIds, ...sortedTileIds])
  }

  function handleTileClick(tile: Tile) {
    if (drag.consumeClick()) return
    if (claimMode) {
      setClaimSelection(prev =>
        prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id]
      )
      return
    }
    if (isMyTurn && drewThisTurn) {
      setSelectedTile(prev => prev?.id === tile.id ? null : tile)
    }
  }

  async function handleDraw() {
    if (drawing) return
    setDrawing(true)
    try {
      await drawTile(gameId, myPlayerId)
      setDrewThisTurn(true)
    } finally {
      setDrawing(false)
    }
  }

  async function handleDiscard() {
    if (!selectedTile || discardingId) return
    const tile = selectedTile
    setDiscardingId(tile.id)
    try {
      await discardTile(gameId, myPlayerId, tile)
      setSelectedTile(null)
      setDrewThisTurn(false)
    } finally {
      setDiscardingId(null)
    }
  }

  async function handleEnterClaimMode() {
    setClaimMode(true)
    await enterClaimMode(gameId, myPlayerId)
  }

  async function handleCancelClaimMode() {
    setClaimMode(false)
    setClaimSelection([])
    await exitClaimMode(gameId)
  }

  async function handleExpose() {
    if (!pending || claimSelection.length < 2) return
    const type = claimSelection.length >= 3 ? 'kong' : 'pung'
    const tiles = (me?.hand ?? []).filter(t => claimSelection.includes(t.id))
    justClaimedRef.current = true
    await claimDiscard(gameId, myPlayerId, type, tiles, pending.tile)
    setClaimMode(false)
    setClaimSelection([])
    setShowClaim(false)
  }

  async function handleMahjong() {
    try {
      if (pending) {
        await claimDiscard(gameId, myPlayerId, 'mahjong', [], pending.tile)
      } else {
        await declareMahjong(gameId, myPlayerId)
      }
    } catch (e) {
      console.error('Mahjong error:', e)
    }
  }

  async function handleJokerSwap(ownerId: string, setIndex: number, jokerIndex: number, jokerTile: Tile, replacementTile: Tile) {
    await swapJoker(gameId, ownerId, setIndex, jokerIndex, myPlayerId, replacementTile, jokerTile)
  }

  function tileName(tile: Tile): string {
    if (tile.isJoker) return 'a Joker'
    if (tile.suit === 'flower') return 'a Flower'
    if (tile.suit === 'wind') {
      const WIND_NAMES: Record<string, string> = { N: 'a North', S: 'a South', E: 'an East', W: 'a West' }
      return WIND_NAMES[String(tile.value)] ?? `a ${tile.value} Wind`
    }
    if (tile.suit === 'dragon') return String(tile.value)
    const s = tile.suit.charAt(0).toUpperCase() + tile.suit.slice(1)
    return `${tile.value} ${s}`
  }

  function getStatusText(): string {
    if (pending?.claimingPlayerId && !claimMode) {
      const name = game.players[pending.claimingPlayerId]?.nickname ?? '…'
      return isMyDiscard ? `${name} is calling…` : `${name} is calling…`
    }
    if (showClaim && canClaim) {
      if (claimMode) return 'Tap tiles to expose'
      const thrower = game.players[pending!.fromPlayerId]?.nickname ?? '…'
      return `${thrower} threw ${tileName(pending!.tile)}…`
    }
    if (pending && isMyDiscard) return `You threw ${tileName(pending.tile)}…`
    if (isMyTurn && !drewThisTurn) return 'Your turn to draw…'
    if (isMyTurn && drewThisTurn && !selectedTile) return 'Select your discard…'
    if (isMyTurn && drewThisTurn && selectedTile) return 'Confirm your discard…'
    if (game.currentTurn && !isMyTurn) {
      const name = game.players[game.currentTurn]?.nickname ?? '…'
      return `${name}'s turn`
    }
    return 'Waiting…'
  }

  function getStatusColor(): string {
    if (showClaim && canClaim) return claimMode ? 'text-emerald-400' : 'text-amber-400'
    if (pending && isMyDiscard) return 'text-amber-400'
    if (isMyTurn) return 'text-emerald-400'
    return 'text-slate-400'
  }

  // ── Finished ──────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const isDraw = game.winner === 'draw'
    const winner = !isDraw && game.winner ? game.players[game.winner] : null
    return (
      <div className="flex flex-col h-full bg-[#152030] text-white gap-2 p-3 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-3xl">{isDraw ? '🀫' : '🀄'}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold leading-tight">{isDraw ? 'Wall Exhausted' : 'Mahjong!'}</h2>
            {isDraw
              ? <p className="text-sm text-slate-400">No tiles remain — game is a draw</p>
              : winner && <p className="text-sm text-yellow-300">{game.winner === myPlayerId ? '🎉 You won!' : `${winner.nickname} wins!`}</p>
            }
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => resetGame(gameId)} className="bg-yellow-400 text-black font-bold py-1.5 px-3 rounded-lg hover:bg-yellow-300 active:scale-95 text-sm">Play Again</button>
            <button onClick={onLeave} className="bg-slate-600 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-slate-500 active:scale-95 text-sm">Exit</button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
          {playerIds.map(pid => {
            const p = game.players[pid]
            const sortedHand = [...(p.hand ?? [])].sort(tileSort)
            const exposedTiles = (p.exposedSets ?? []).flatMap(s => s.tiles)
            return (
              <div key={pid} className={`rounded-lg px-2 py-1 flex items-center gap-2 ${!isDraw && pid === game.winner ? 'bg-yellow-900/40 border border-yellow-400/60' : 'bg-black/20'}`}>
                <p className="font-bold text-xs shrink-0 w-14 truncate">{p.nickname}{!isDraw && pid === game.winner ? ' 👑' : ''}</p>
                <div className="flex gap-0.5 overflow-x-auto">
                  {sortedHand.map(t => <TileComponent key={t.id} tile={t} small />)}
                  {exposedTiles.map((t, i) => <TileComponent key={`e-${i}`} tile={t} small />)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Info panel helpers ─────────────────────────────────────────────────────
  const lastDiscardTile = pending?.tile ?? game.lastDiscard?.tile ?? null
  const lastDiscardBy = pending
    ? game.players[pending.fromPlayerId]?.nickname
    : game.lastDiscard ? game.players[game.lastDiscard.fromPlayerId]?.nickname : null

  const myNoThanksVote = !!pending?.noThanksBy?.[myPlayerId]
  const noThanksCount = Object.keys(pending?.noThanksBy ?? {}).length
  const eligibleVoters = pending
    ? Object.keys(game.players).filter(pid => pid !== pending.fromPlayerId).length
    : 0

  function renderActionPanel() {
    if (showClaim && canClaim) {
      if (claimMode) {
        const canExpose = claimSelection.length >= 2
        return (
          <>
            <button onClick={handleExpose} disabled={!canExpose}
              className={canExpose ? BTN_CALL + ' btn-pulse-amber' : BTN_MUTED + ' opacity-40 cursor-not-allowed'}>
              Expose ({claimSelection.length + 1})
            </button>
            <button onClick={handleCancelClaimMode} className={BTN_OUTLINE}>Cancel</button>
          </>
        )
      }
      if (someoneElseClaiming) {
        const name = game.players[pending!.claimingPlayerId!]?.nickname ?? '…'
        return (
          <button disabled className={BTN_MUTED + ' opacity-50 text-xs'}>
            {name} is calling…
          </button>
        )
      }
      if (myNoThanksVote) {
        return (
          <button disabled className={BTN_MUTED + ' opacity-60 text-xs'}>
            Waiting · {noThanksCount}/{eligibleVoters} passed
          </button>
        )
      }
      return (
        <>
          <button onClick={handleEnterClaimMode} className={BTN_CALL + ' btn-pulse-amber'}>Wait · Call</button>
          <button onClick={() => voteNoThanks(gameId, myPlayerId)} className={BTN_OUTLINE}>
            No Thanks {noThanksCount > 0 ? `(${noThanksCount}/${eligibleVoters})` : ''}
          </button>
        </>
      )
    }
    if (isMyTurn && !drewThisTurn) {
      return (
        <button onClick={handleDraw} disabled={drawing}
          className={drawing ? BTN_MUTED + ' opacity-40 cursor-not-allowed' : BTN_DRAW + ' btn-pulse-green'}>
          {drawing ? 'Drawing…' : 'Draw'}
        </button>
      )
    }
    if (isMyTurn && drewThisTurn) {
      return (
        <button onClick={handleDiscard} disabled={!selectedTile || !!discardingId}
          className={selectedTile && !discardingId ? BTN_DISCARD + ' btn-pulse-blue' : BTN_MUTED + ' opacity-40 cursor-not-allowed'}>
          {discardingId ? 'Discarding…' : 'Discard'}
        </button>
      )
    }
    return null
  }

  const showMahjongBtn = (isMyTurn && drewThisTurn) || (showClaim && canClaim && !claimMode)

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#152030] text-white overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Top: opponents (left) + info panel (right) */}
      <div className="flex-1 flex gap-1.5 p-1.5 overflow-hidden min-h-0">

        {/* Opponent rows + status bar */}
        <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0 min-w-0">
          {opponents.map(pid => {
            const opp = game.players[pid]
            const isOppTurn = game.currentTurn === pid
            const isCalling = pending?.claimingPlayerId === pid
            // Render exposed sets in the array order the owner chose (drag-reorder
            // propagates from owner's bottom strip via Firebase).
            const expEntries = (opp.exposedSets ?? []).flatMap((set, si) =>
              set.tiles.map((t, ti) => ({ t, set, origSi: si, ti }))
            )

            return (
              <div key={pid} className={`rounded px-1 py-0.5 shrink-0 border ${isOppTurn ? 'bg-yellow-600/20 border-yellow-500/60' : isCalling ? 'bg-amber-900/20 border-amber-500/40' : 'bg-black/20 border-transparent'}`}>
                <div className="flex items-center gap-0.5 overflow-x-auto">
                  <span className="text-[10px] font-semibold shrink-0 w-10 truncate leading-tight">
                    {opp.nickname}{isCalling ? ' 🤔' : ''}
                  </span>
                  {/* Face-down tiles — tiny variant so 13+ fit on a phone landscape row */}
                  {Array.from({ length: Math.min(opp.hand?.length ?? 0, 20) }).map((_, i) => (
                    <TileComponent key={i} tile={{ id: `fd-${pid}-${i}`, suit: 'bam', value: 1, isJoker: false, label: '' }} faceDown tiny />
                  ))}
                  {/* Divider between hidden and exposed */}
                  {expEntries.length > 0 && (
                    <div className="w-px bg-slate-500/60 self-stretch mx-0.5 shrink-0" />
                  )}
                  {/* Exposed tiles */}
                  {expEntries.map(({ t, set, origSi, ti }) => {
                    const matchTile = isMyTurn && t.isJoker
                      ? me?.hand.find(h => !h.isJoker && h.suit === set.tiles.find(x => !x.isJoker)?.suit && h.value === set.tiles.find(x => !x.isJoker)?.value)
                      : undefined
                    return (
                      <div key={t.id} className="relative shrink-0">
                        <TileComponent tile={t} small />
                        {matchTile && (
                          <button
                            onClick={() => handleJokerSwap(pid, origSi, ti, t, matchTile)}
                            className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold z-10"
                          >⇄</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Status bar */}
          <div className="flex items-center gap-2 px-1 mt-auto shrink-0">
            <p className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap leading-none">{wallLeft} in wall · {VERSION}</p>
            <p className={`text-xs font-bold ${getStatusColor()} flex-1 text-center leading-none`}>{getStatusText()}</p>
          </div>
        </div>

        {/* Right: last discard + action buttons */}
        <div className="shrink-0 w-[108px] flex flex-col gap-1.5 items-center">
          {lastDiscardTile ? (
            <div className="flex flex-col items-center gap-0.5 w-full">
              {/* Ring wraps only the tile, not the whole column */}
              <div className={canClaim ? 'ring-2 ring-amber-400 rounded-lg p-0.5 inline-flex' : ''}>
                <TileComponent tile={lastDiscardTile} />
              </div>
              {lastDiscardBy && <span className="text-[9px] text-slate-400 text-center">{lastDiscardBy}</span>}
              {pending && (canClaim || isMyDiscard) && (
                <div className="w-full h-[3px] bg-slate-700/60 rounded-full overflow-hidden">
                  {/* Use separate animation sub-properties so only animationPlayState
                      changes between renders — the shorthand would restart the animation
                      each time Date.now() produces a different duration string. */}
                  <div
                    key={pending.tile.id}
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      animationName: 'claim-bar-shrink',
                      animationDuration: `${claimBarDuration}s`,
                      animationTimingFunction: 'linear',
                      animationFillMode: 'forwards',
                      animationPlayState: claimMode ? 'paused' : 'running',
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="w-[52px] h-[70px] rounded-lg border border-slate-700 flex items-center justify-center">
              <span className="text-slate-700 text-[9px] text-center">discard</span>
            </div>
          )}

          <div className="flex flex-col gap-1 w-full">
            {renderActionPanel()}
          </div>

          <div className="mt-auto w-full flex flex-col gap-1">
            {showMahjongBtn && (
              <button onClick={handleMahjong} className={BTN_MAHJONG}>Mahjong</button>
            )}
            <button
              onClick={() => setShowDiscards(true)}
              className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2 active:scale-95 transition-all w-full"
            >
              Discards »
            </button>
          </div>
        </div>
      </div>

      {/* My area — unified hand + exposed sets in one draggable row */}
      <div className={`shrink-0 flex items-center gap-1 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t-2 bg-black/20 transition-colors ${isMyTurn ? 'border-emerald-400 shadow-[0_-3px_12px_rgba(52,211,153,0.25)]' : 'border-slate-700/50'}`}>

        <div
          ref={drag.containerRef}
          className={`flex flex-wrap items-end gap-0.5 flex-1 min-w-0 pt-3 pb-2 ${drag.dragging ? 'overflow-visible' : ''}`}
          style={{ touchAction: drag.dragging ? 'none' : 'pan-x' }}
          onPointerMove={drag.onMove}
          onPointerUp={drag.onUp}
          onPointerCancel={drag.onCancel}
        >
          {drag.displayIds.map(id => {
            // Exposed set block — id is `eset:${firstTileId}` (stable across reorder writes)
            if (id.startsWith(ESET_PREFIX)) {
              const firstId = id.slice(ESET_PREFIX.length)
              const set = (me?.exposedSets ?? []).find(s => s.tiles[0]?.id === firstId)
              if (!set) return null
              return (
                <div
                  key={id}
                  data-drag-id={id}
                  onPointerDown={e => drag.onTileDown(e, id)}
                  style={drag.tileStyle(id)}
                  className="relative flex gap-0.5 bg-amber-900/60 border border-amber-500/70 rounded-md px-0.5 pt-3 pb-0.5 shrink-0"
                >
                  <span className="absolute top-0.5 left-0 right-0 text-center text-[7px] text-amber-300 font-bold leading-none tracking-wide">
                    {set.claimType.toUpperCase()}
                  </span>
                  {set.tiles.map((t, ti) => <TileComponent key={`${id}-${ti}`} tile={t} medium />)}
                </div>
              )
            }

            // Hand tile
            const tile = (me?.hand ?? []).find(t => t.id === id)
            if (!tile) return null
            const isDrawn = tile.id === drawnTileId && drewThisTurn
            const isClaimSel = claimMode && claimSelection.includes(tile.id)
            return (
              <div
                key={id}
                data-drag-id={id}
                onPointerDown={e => drag.onTileDown(e, id)}
                style={{
                  ...drag.tileStyle(id),
                  outline: isClaimSel ? '2px solid #f59e0b' : (isDrawn && selectedTile?.id !== tile.id ? '2px solid #34d399' : undefined),
                  outlineOffset: '2px',
                  borderRadius: 8,
                }}
              >
                <TileComponent
                  tile={tile}
                  medium
                  selected={!drag.dragging && !claimMode && isMyTurn && drewThisTurn && selectedTile?.id === tile.id}
                  onClick={() => handleTileClick(tile)}
                />
                {isDrawn && !drag.dragging && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
                    <div className="tile-shimmer-streak" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Sort + Exit */}
        <div className="flex flex-col gap-1.5 shrink-0 items-stretch pl-1.5" style={{ minWidth: 62 }}>
          <button
            onClick={sortHand}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2.5 active:scale-95 transition-all text-center"
          >Sort</button>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2.5 active:scale-95 transition-all text-center"
          >Exit</button>
        </div>
      </div>

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowExitConfirm(false)}>
          <div className="bg-[#152030] rounded-xl p-5 max-w-sm w-full border border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-base mb-2">Leave game?</h3>
            <p className="text-slate-300 text-sm mb-4">
              Your hand will be saved. Open the same link to rejoin and pick up where you left off.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowExitConfirm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg py-2 active:scale-95">
                Stay
              </button>
              <button onClick={() => { setShowExitConfirm(false); onLeave() }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg py-2 active:scale-95">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discards modal */}
      {showDiscards && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowDiscards(false)}>
          <div className="bg-[#152030] rounded-xl p-3 w-full max-h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold text-sm">Discards</h3>
              <button onClick={() => setShowDiscards(false)} className="text-slate-400 text-lg leading-none px-1">✕</button>
            </div>
            {playerIds.map(pid => {
              const p = game.players[pid]
              if (!p.discards?.length) return null
              return (
                <div key={pid} className="mb-3">
                  <p className="text-emerald-400 text-xs font-bold mb-1">{p.nickname} ({p.discards.length})</p>
                  <div className="flex flex-wrap gap-0.5">
                    {p.discards.map(t => <TileComponent key={t.id} tile={t} small />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
