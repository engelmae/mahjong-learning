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
  const prevHandRef = useRef<string[]>([])

  const me = game.players[myPlayerId]
  const isMyTurn = game.currentTurn === myPlayerId
  const pending = game.pendingClaim
  const isMyDiscard = pending?.fromPlayerId === myPlayerId
  const canClaim = !!pending && !isMyDiscard && game.status === 'playing'

  const drag = useTileDrag(handOrder, setHandOrder)

  // Sync hand order: preserve custom arrangement, append new tiles at end
  useEffect(() => {
    const currentIds = (me?.hand ?? []).map(t => t.id)
    const currentIdSet = new Set(currentIds)
    setHandOrder(prev => {
      const retained = prev.filter(id => currentIdSet.has(id))
      const newIds = currentIds.filter(id => !new Set(retained).has(id))
      return [...retained, ...newIds]
    })
  }, [(me?.hand ?? []).map(t => t.id).join(',')])

  // Track which tile was just drawn (hand grows by exactly 1)
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

  // Claim countdown
  useEffect(() => {
    if (!pending) { setShowClaim(false); return }
    if (isMyDiscard) return
    setShowClaim(true)
    const tick = () => {
      const r = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
      setClaimCountdown(r)
      if (r <= 0) setShowClaim(false)
    }
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [pending?.tile?.id, isMyDiscard])

  // Reset on turn change
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

  async function handleClaim(type: 'pung' | 'kong' | 'chow' | 'mahjong') {
    if (!pending) return
    await claimDiscard(gameId, myPlayerId, type, [], pending.tile)
    setShowClaim(false)
  }

  async function handleJokerSwap(ownerId: string, setIndex: number, jokerIndex: number, jokerTile: Tile, replacementTile: Tile) {
    await swapJoker(gameId, ownerId, setIndex, jokerIndex, myPlayerId, replacementTile, jokerTile)
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = game.winner ? game.players[game.winner] : null
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#152030] text-white gap-4 p-4 overflow-y-auto">
        <div className="text-5xl">🀄</div>
        <h2 className="text-2xl font-bold">Mah Jongg!</h2>
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
          <button onClick={onLeave} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 active:scale-95">Leave</button>
        </div>
      </div>
    )
  }

  // ── Info panel helpers ────────────────────────────────────────────────────
  const lastDiscardTile = pending?.tile ?? game.lastDiscard?.tile ?? null
  const lastDiscardBy = pending
    ? game.players[pending.fromPlayerId]?.nickname
    : game.lastDiscard
      ? game.players[game.lastDiscard.fromPlayerId]?.nickname
      : null

  function renderActionPanel() {
    if (showClaim && pending && !isMyDiscard) {
      return (
        <div className="flex flex-col gap-1 w-full">
          <p className="text-yellow-300 text-[10px] font-bold text-center">{claimCountdown}s</p>
          <button onClick={() => handleClaim('pung')} className="bg-blue-500 text-white py-1 rounded font-bold text-xs w-full active:scale-95">Pung</button>
          <button onClick={() => handleClaim('kong')} className="bg-purple-500 text-white py-1 rounded font-bold text-xs w-full active:scale-95">Kong</button>
          <button onClick={() => handleClaim('chow')} className="bg-green-600 text-white py-1 rounded font-bold text-xs w-full active:scale-95">Chow</button>
          <button onClick={() => handleClaim('mahjong')} className="bg-yellow-400 text-black py-1 rounded font-bold text-xs w-full active:scale-95">Mah Jongg!</button>
          <button onClick={() => passClaim(gameId)} className="bg-gray-600 text-white py-1 rounded text-xs w-full active:scale-95">Pass</button>
        </div>
      )
    }
    if (isMyTurn && !drewThisTurn) {
      return <button onClick={handleDraw} className="bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm w-full active:scale-95">Draw</button>
    }
    if (isMyTurn && drewThisTurn) {
      return (
        <div className="flex flex-col gap-1 w-full">
          <button
            onClick={handleDiscard}
            disabled={!selectedTile}
            className={`font-bold py-2 rounded-lg text-sm w-full transition-all ${selectedTile ? 'bg-red-500 text-white active:scale-95' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
          >
            Discard
          </button>
          <button onClick={() => declareMahjong(gameId, myPlayerId)} className="bg-yellow-400 text-black font-bold py-1.5 rounded-lg text-xs w-full active:scale-95">
            Mah Jongg!
          </button>
        </div>
      )
    }
    return (
      <p className="text-emerald-400 text-[10px] text-center leading-snug">
        {game.currentTurn ? `${game.players[game.currentTurn]?.nickname ?? '…'}'s turn` : 'Waiting…'}
      </p>
    )
  }

  // ── Main game layout ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#152030] text-white overflow-hidden">

      {/* Top: opponents (left) + info panel (right) */}
      <div className="flex-1 flex gap-1.5 p-1.5 overflow-hidden min-h-0">

        {/* Opponent rows */}
        <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0 min-w-0">
          {opponents.map(pid => {
            const opp = game.players[pid]
            const isOppTurn = game.currentTurn === pid
            // Flatten exposed tiles: joker-containing sets first, capped at 8
            const jokerSets = (opp.exposedSets ?? []).filter(s => s.tiles.some(t => t.isJoker))
            const otherSets = (opp.exposedSets ?? []).filter(s => !s.tiles.some(t => t.isJoker))
            const expEntries = [...jokerSets, ...otherSets].flatMap((set, si) =>
              set.tiles.map((t, ti) => ({ t, set, origSi: (opp.exposedSets ?? []).indexOf(set), ti }))
            ).slice(0, 8)

            return (
              <div key={pid} className={`rounded px-1 py-0.5 shrink-0 ${isOppTurn ? 'bg-yellow-600/30 ring-1 ring-yellow-400' : 'bg-black/20'}`}>
                {/* Hand row: name + face-down tiles */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold shrink-0 w-14 truncate">{opp.nickname}</span>
                  {isOppTurn && <span className="text-[9px] bg-yellow-400 text-black px-0.5 rounded shrink-0">▶</span>}
                  <div className="flex gap-0.5 overflow-hidden flex-1 min-w-0">
                    {Array.from({ length: Math.min(opp.hand?.length ?? 0, 20) }).map((_, i) => (
                      <TileComponent key={i} tile={{ id: `fd-${pid}-${i}`, suit: 'bam', value: 1, isJoker: false, label: '' }} faceDown small />
                    ))}
                  </div>
                </div>
                {/* Exposed sets (up to 8 tiles, joker sets first) */}
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

          <div className="text-[10px] text-emerald-800 mt-auto">
            {Math.max(0, (game.wall?.length ?? 0) - game.wallIndex)} in wall · {VERSION}
          </div>
        </div>

        {/* Right: info + action panel */}
        <div className="shrink-0 w-[108px] flex flex-col gap-1.5 items-center">
          {/* Last discarded tile */}
          {lastDiscardTile ? (
            <div className={`flex flex-col items-center gap-0.5 ${canClaim ? 'ring-2 ring-yellow-400 rounded-lg p-0.5' : ''}`}>
              <TileComponent tile={lastDiscardTile} />
              {lastDiscardBy && <span className="text-[9px] text-gray-400 text-center">{lastDiscardBy}</span>}
            </div>
          ) : (
            <div className="w-[52px] h-[70px] rounded-lg border border-emerald-900 flex items-center justify-center">
              <span className="text-emerald-900 text-[9px] text-center">no discard</span>
            </div>
          )}

          {/* Action panel */}
          {renderActionPanel()}

          {/* All discards */}
          <button
            onClick={() => setShowDiscards(true)}
            className="text-[10px] text-emerald-700 hover:text-emerald-500 underline mt-auto leading-tight"
          >
            All discards ▸
          </button>
        </div>
      </div>

      {/* My area: exposed sets | hand | sort+leave */}
      <div className={`shrink-0 flex items-center gap-1 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t-2 ${isMyTurn ? 'border-yellow-400 bg-black/30' : 'border-emerald-700 bg-black/20'}`}>

        {/* Exposed sets inline, left of hand */}
        {(me?.exposedSets?.length ?? 0) > 0 && (
          <div className="flex gap-0.5 shrink-0 pr-1 border-r border-emerald-700 overflow-x-auto max-w-[30%]">
            {(me?.exposedSets ?? []).flatMap((s, si) =>
              s.tiles.map((t, ti) => <TileComponent key={`${si}-${ti}`} tile={t} small />)
            )}
          </div>
        )}

        {/* Hand — drag to reorder, tap to select for discard */}
        <div
          ref={drag.containerRef}
          className="flex gap-0.5 overflow-x-auto flex-1 min-w-0"
          style={{ touchAction: drag.dragging ? 'none' : 'pan-x' }}
          onPointerMove={drag.onMove}
          onPointerUp={drag.onUp}
          onPointerCancel={drag.onCancel}
        >
          {displayHand.map(tile => {
            const isDrawn = tile.id === drawnTileId && drewThisTurn
            return (
              <div
                key={tile.id}
                data-drag-id={tile.id}
                onPointerDown={e => drag.onTileDown(e, tile.id)}
                style={{
                  ...drag.tileStyle(tile.id),
                  outline: isDrawn && selectedTile?.id !== tile.id ? '2px solid #facc15' : undefined,
                  outlineOffset: '2px',
                  borderRadius: 8,
                }}
              >
                <TileComponent
                  tile={tile}
                  small
                  selected={!drag.dragging && isMyTurn && drewThisTurn && selectedTile?.id === tile.id}
                  onClick={() => handleTileClick(tile)}
                />
              </div>
            )
          })}
        </div>

        {/* Sort + Leave */}
        <div className="flex flex-col gap-1 shrink-0 items-center pl-0.5">
          <button onClick={sortHand} className="text-[10px] text-emerald-400 border border-emerald-700 rounded px-1.5 py-0.5 leading-tight">Sort</button>
          <button onClick={onLeave} className="text-[10px] text-emerald-600 hover:text-red-400 leading-tight">Leave</button>
        </div>
      </div>

      {/* All discards modal */}
      {showDiscards && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowDiscards(false)}>
          <div className="bg-[#152030] rounded-xl p-3 w-full max-h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-bold text-sm">All Discards</h3>
              <button onClick={() => setShowDiscards(false)} className="text-gray-400 text-lg leading-none px-1">✕</button>
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
