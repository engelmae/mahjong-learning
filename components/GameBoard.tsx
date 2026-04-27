'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { GameState, Tile } from '@/types/game'
import TileComponent from './Tile'
import { drawTile, discardTile, claimDiscard, passClaim, declareMahjong, swapJoker, resetGame } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'
import { useTileDrag } from '@/lib/useTileDrag'

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

// Button colors keyed to their matching tile highlight colors
const BTN_DRAW    = 'bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'   // matches drawn tile #facc15
const BTN_DISCARD = 'bg-[#5aabff] hover:bg-[#7bbeff] text-black font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'      // matches selected tile #5aabff
const BTN_CALL    = 'bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'  // matches claim selection #34d399
const BTN_MAHJONG = 'bg-violet-500 hover:bg-violet-400 text-white font-semibold py-2 rounded-lg text-sm w-full active:scale-95 transition-all'    // distinct
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
  const [handOrder, setHandOrder] = useState<string[]>([])
  const [showDiscards, setShowDiscards] = useState(false)
  const [claimCountdown, setClaimCountdown] = useState(0)
  const [showClaim, setShowClaim] = useState(false)
  const [claimMode, setClaimMode] = useState(false)
  const [claimSelection, setClaimSelection] = useState<string[]>([])
  const prevHandRef = useRef<string[]>([])
  const claimModeRef = useRef(false)
  claimModeRef.current = claimMode

  const me = game.players[myPlayerId]
  const isMyTurn = game.currentTurn === myPlayerId
  const pending = game.pendingClaim
  const isMyDiscard = pending?.fromPlayerId === myPlayerId
  const canClaim = !!pending && !isMyDiscard && game.status === 'playing'

  const drag = useTileDrag(handOrder, setHandOrder)

  useEffect(() => {
    const currentIds = (me?.hand ?? []).map(t => t.id)
    const currentIdSet = new Set(currentIds)
    setHandOrder(prev => {
      const retained = prev.filter(id => currentIdSet.has(id))
      const newIds = currentIds.filter(id => !new Set(retained).has(id))
      return [...retained, ...newIds]
    })
  }, [(me?.hand ?? []).map(t => t.id).join(',')])

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

  // Countdown display + auto-advance passClaim (frozen when player is selecting tiles to expose)
  useEffect(() => {
    if (!pending) { setShowClaim(false); return }

    if (isMyDiscard) {
      // Own discard: no UI needed, but still auto-advance after window closes
      const remaining = Math.max(0, pending.expiresAt - Date.now())
      const t = setTimeout(() => passClaim(gameId), remaining + 300)
      return () => clearTimeout(t)
    }

    setShowClaim(true)
    const tick = () => {
      if (claimModeRef.current) return  // player pressed Call — freeze display, skip auto-advance
      const r = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
      setClaimCountdown(r)
      if (r <= 0) {
        setShowClaim(false)
        passClaim(gameId)
      }
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [pending?.tile?.id, isMyDiscard])

  // Auto-cancel claim mode when window closes
  useEffect(() => {
    if (!showClaim) { setClaimMode(false); setClaimSelection([]) }
  }, [showClaim])

  useEffect(() => {
    setDrewThisTurn(false)
    setSelectedTile(null)
    setDrawnTileId(null)
  }, [game.currentTurn])

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const opponents = playerIds.filter(id => id !== myPlayerId)

  const displayHand = useMemo(
    () => drag.displayIds.map(id => (me?.hand ?? []).find(t => t.id === id)).filter(Boolean) as Tile[],
    [drag.displayIds, me?.hand]
  )

  function sortHand() {
    setHandOrder([...(me?.hand ?? [])].sort(tileSort).map(t => t.id))
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
    await drawTile(gameId, myPlayerId)
    setDrewThisTurn(true)
  }

  async function handleDiscard() {
    if (!selectedTile) return
    await discardTile(gameId, myPlayerId, selectedTile)
    setSelectedTile(null)
    setDrewThisTurn(false)
  }

  async function handleExpose() {
    if (!pending || claimSelection.length < 2) return
    const type = claimSelection.length >= 3 ? 'kong' : 'pung'
    const tiles = (me?.hand ?? []).filter(t => claimSelection.includes(t.id))
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

  // Status text and color for the bar below opponents
  function getStatusText(): string {
    if (showClaim && canClaim) {
      if (claimMode) return 'Tap tiles to expose'
      return `${claimCountdown}s left to claim`
    }
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
    if (isMyTurn) return 'text-emerald-400'
    return 'text-slate-400'
  }

  // ── Finished ──────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = game.winner ? game.players[game.winner] : null
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#152030] text-white gap-4 p-4 overflow-y-auto">
        <div className="text-5xl">🀄</div>
        <h2 className="text-2xl font-bold">Mahjong!</h2>
        {winner && (
          <p className="text-lg text-yellow-300">{game.winner === myPlayerId ? '🎉 You won!' : `${winner.nickname} wins!`}</p>
        )}
        <div className="w-full space-y-2">
          {playerIds.map(pid => {
            const p = game.players[pid]
            return (
              <div key={pid} className={`rounded-lg p-2 ${pid === game.winner ? 'bg-yellow-900/40 ring-2 ring-yellow-400' : 'bg-black/20'}`}>
                <p className="font-bold mb-1 text-sm">{p.nickname}{pid === game.winner ? ' 👑' : ''}</p>
                <div className="flex flex-wrap gap-0.5">
                  {p.hand.map(t => <TileComponent key={t.id} tile={t} small />)}
                  {p.exposedSets.flatMap((s, si) => s.tiles.map((t, ti) => (
                    <TileComponent key={`${si}-${ti}`} tile={t} small />
                  )))}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => resetGame(gameId)} className="bg-yellow-400 text-black font-bold py-2 px-6 rounded-lg hover:bg-yellow-300 active:scale-95">Play Again</button>
          <button onClick={onLeave} className="bg-slate-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-500 active:scale-95">Exit</button>
        </div>
      </div>
    )
  }

  // ── Info panel ─────────────────────────────────────────────────────────────
  const lastDiscardTile = pending?.tile ?? game.lastDiscard?.tile ?? null
  const lastDiscardBy = pending
    ? game.players[pending.fromPlayerId]?.nickname
    : game.lastDiscard ? game.players[game.lastDiscard.fromPlayerId]?.nickname : null

  const wallLeft = Math.max(0, (game.wall?.length ?? 0) - game.wallIndex)

  // Only claim/draw/discard action buttons — status text lives in the opponents status bar
  function renderActionPanel() {
    if (showClaim && canClaim) {
      if (claimMode) {
        const canExpose = claimSelection.length >= 2
        return (
          <>
            <button onClick={handleExpose} disabled={!canExpose}
              className={canExpose ? BTN_CALL : BTN_MUTED + ' opacity-40 cursor-not-allowed'}>
              Expose ({claimSelection.length})
            </button>
            <button onClick={() => { setClaimMode(false); setClaimSelection([]) }} className={BTN_OUTLINE}>Cancel</button>
          </>
        )
      }
      return (
        <button onClick={() => setClaimMode(true)} className={BTN_CALL}>Call</button>
      )
    }
    if (isMyTurn && !drewThisTurn) {
      return <button onClick={handleDraw} className={BTN_DRAW}>Draw</button>
    }
    if (isMyTurn && drewThisTurn) {
      return (
        <button onClick={handleDiscard} disabled={!selectedTile}
          className={selectedTile ? BTN_DISCARD : BTN_MUTED + ' opacity-40 cursor-not-allowed'}>
          Discard
        </button>
      )
    }
    return null
  }

  // Mahjong button shows in bottom strip (left of Sort/Exit) when relevant
  const showMahjongBtn = (isMyTurn && drewThisTurn) || (showClaim && canClaim && !claimMode)

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#152030] text-white overflow-hidden">

      {/* Top: opponents (left) + info panel (right) */}
      <div className="flex-1 flex gap-1.5 p-1.5 overflow-hidden min-h-0">

        {/* Opponent rows + status bar */}
        <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0 min-w-0">
          {opponents.map(pid => {
            const opp = game.players[pid]
            const isOppTurn = game.currentTurn === pid
            const jokerSets = (opp.exposedSets ?? []).filter(s => s.tiles.some(t => t.isJoker))
            const otherSets = (opp.exposedSets ?? []).filter(s => !s.tiles.some(t => t.isJoker))
            const expEntries = [...jokerSets, ...otherSets].flatMap((set) =>
              set.tiles.map((t, ti) => ({ t, set, origSi: (opp.exposedSets ?? []).indexOf(set), ti }))
            ).slice(0, 8)

            return (
              <div key={pid} className={`rounded px-1 py-0.5 shrink-0 ${isOppTurn ? 'bg-yellow-600/20 ring-1 ring-yellow-500/60' : 'bg-black/20'}`}>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold shrink-0 w-14 truncate">{opp.nickname}</span>
                  <div className="flex gap-0.5 overflow-hidden flex-1 min-w-0">
                    {Array.from({ length: Math.min(opp.hand?.length ?? 0, 20) }).map((_, i) => (
                      <TileComponent key={i} tile={{ id: `fd-${pid}-${i}`, suit: 'bam', value: 1, isJoker: false, label: '' }} faceDown small />
                    ))}
                  </div>
                </div>
                {expEntries.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 overflow-x-auto">
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
                )}
              </div>
            )
          })}

          {/* Status bar: wall count far left, turn/claim status to the right */}
          <div className="flex items-center gap-2 px-1 mt-auto shrink-0">
            <p className="text-[9px] text-slate-600 shrink-0 whitespace-nowrap leading-none">{wallLeft} in wall · {VERSION}</p>
            <p className={`text-[10px] font-bold ${getStatusColor()} flex-1 text-center leading-none`}>{getStatusText()}</p>
          </div>
        </div>

        {/* Right: last discard + action buttons + discards */}
        <div className="shrink-0 w-[108px] flex flex-col gap-1.5 items-center">
          {/* Last discarded tile */}
          {lastDiscardTile ? (
            <div className={`flex flex-col items-center gap-0.5 ${canClaim ? 'ring-2 ring-amber-400 rounded-lg p-0.5' : ''}`}>
              <TileComponent tile={lastDiscardTile} />
              {lastDiscardBy && <span className="text-[9px] text-slate-400 text-center">{lastDiscardBy}</span>}
            </div>
          ) : (
            <div className="w-[52px] h-[70px] rounded-lg border border-slate-700 flex items-center justify-center">
              <span className="text-slate-700 text-[9px] text-center">discard</span>
            </div>
          )}

          {/* Action panel — buttons only */}
          <div className="flex flex-col gap-1 w-full">
            {renderActionPanel()}
          </div>

          {/* Discards button */}
          <div className="mt-auto w-full">
            <button
              onClick={() => setShowDiscards(true)}
              className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2 active:scale-95 transition-all w-full"
            >
              Discards »
            </button>
          </div>
        </div>
      </div>

      {/* My area — glows emerald when it's my turn */}
      <div className={`shrink-0 flex items-center gap-1 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t-2 bg-black/20 transition-colors ${isMyTurn ? 'border-emerald-400 shadow-[0_-3px_12px_rgba(52,211,153,0.25)]' : 'border-slate-700/50'}`}>

        {/* Exposed sets — each set in its own amber box with type label */}
        {(me?.exposedSets?.length ?? 0) > 0 && (
          <div className="flex gap-1 shrink-0 pr-1.5 border-r-2 border-slate-500 overflow-x-auto max-w-[35%] items-center">
            {(me?.exposedSets ?? []).map((set, si) => (
              <div key={si} className="relative flex gap-0.5 bg-amber-900/60 border border-amber-500/70 rounded-md px-0.5 pt-3 pb-0.5 shrink-0">
                <span className="absolute top-0.5 left-0 right-0 text-center text-[7px] text-amber-300 font-bold leading-none tracking-wide">
                  {set.claimType.toUpperCase()}
                </span>
                {set.tiles.map((t, ti) => <TileComponent key={`${si}-${ti}`} tile={t} small />)}
              </div>
            ))}
          </div>
        )}

        {/* Hand */}
        <div
          ref={drag.containerRef}
          className="flex gap-0.5 overflow-x-auto flex-1 min-w-0 pt-3 pb-2"
          style={{ touchAction: drag.dragging ? 'none' : 'pan-x' }}
          onPointerMove={drag.onMove}
          onPointerUp={drag.onUp}
          onPointerCancel={drag.onCancel}
        >
          {displayHand.map(tile => {
            const isDrawn = tile.id === drawnTileId && drewThisTurn
            const isClaimSel = claimMode && claimSelection.includes(tile.id)
            return (
              <div
                key={tile.id}
                data-drag-id={tile.id}
                onPointerDown={e => drag.onTileDown(e, tile.id)}
                style={{
                  ...drag.tileStyle(tile.id),
                  outline: isClaimSel ? '2px solid #34d399' : (isDrawn && selectedTile?.id !== tile.id ? '2px solid #facc15' : undefined),
                  outlineOffset: '2px',
                  borderRadius: 8,
                }}
              >
                <TileComponent
                  tile={tile}
                  small
                  selected={!drag.dragging && !claimMode && isMyTurn && drewThisTurn && selectedTile?.id === tile.id}
                  onClick={() => handleTileClick(tile)}
                />
              </div>
            )
          })}
        </div>

        {/* Mahjong button — left of Sort/Exit, shown when declaration is possible */}
        {showMahjongBtn && (
          <div className="self-stretch flex pl-1 shrink-0">
            <button
              onClick={handleMahjong}
              className="bg-violet-500 hover:bg-violet-400 text-white text-[11px] font-bold rounded-lg px-2 active:scale-95 transition-all text-center w-full"
              style={{ minWidth: 50 }}
            >
              Mahjong!
            </button>
          </div>
        )}

        {/* Sort + Exit */}
        <div className="flex flex-col gap-1.5 shrink-0 items-stretch pl-1.5" style={{ minWidth: 62 }}>
          <button
            onClick={sortHand}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2.5 active:scale-95 transition-all text-center"
          >Sort</button>
          <button
            onClick={onLeave}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2.5 active:scale-95 transition-all text-center"
          >Exit</button>
        </div>
      </div>

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
