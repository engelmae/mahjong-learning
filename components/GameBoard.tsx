'use client'
import { useState, useEffect, useMemo } from 'react'
import { GameState, Tile } from '@/types/game'
import TileComponent from './Tile'
import ExposedSets from './ExposedSets'
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
  const [claimTiles, setClaimTiles] = useState<Tile[]>([])
  const [showClaim, setShowClaim] = useState(false)
  const [claimCountdown, setClaimCountdown] = useState(0)
  const [handOrder, setHandOrder] = useState<string[]>([])

  const me = game.players[myPlayerId]
  const isMyTurn = game.currentTurn === myPlayerId
  const pending = game.pendingClaim
  const isMyDiscard = pending?.fromPlayerId === myPlayerId
  const canClaim = !!pending && !isMyDiscard && game.status === 'playing'

  const drag = useTileDrag(handOrder, setHandOrder)

  // Sync hand order: preserve arrangement, append new tiles
  useEffect(() => {
    const currentIds = (me?.hand ?? []).map(t => t.id)
    const currentIdSet = new Set(currentIds)
    setHandOrder(prev => {
      const retained = prev.filter(id => currentIdSet.has(id))
      const newIds = currentIds.filter(id => !new Set(retained).has(id))
      return [...retained, ...newIds]
    })
  }, [(me?.hand ?? []).map(t => t.id).join(',')])

  // Countdown timer for claim window
  useEffect(() => {
    if (!pending) { setShowClaim(false); return }
    if (isMyDiscard) return
    setShowClaim(true)
    const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
    setClaimCountdown(remaining)
    const interval = setInterval(() => {
      const r = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
      setClaimCountdown(r)
      if (r <= 0) { setShowClaim(false); clearInterval(interval) }
    }, 500)
    return () => clearInterval(interval)
  }, [pending?.tile?.id, isMyDiscard])

  // Reset on turn change
  useEffect(() => {
    setDrewThisTurn(false)
    setSelectedTile(null)
  }, [game.currentTurn])

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const opponents = playerIds.filter(id => id !== myPlayerId)

  // Map display IDs → tile objects
  const displayHand = useMemo(
    () => drag.displayIds.map(id => (me?.hand ?? []).find(t => t.id === id)).filter(Boolean) as Tile[],
    [drag.displayIds, me?.hand]
  )

  function sortHand() {
    const sorted = [...(me?.hand ?? [])].sort(tileSort)
    setHandOrder(sorted.map(t => t.id))
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
    if (type === 'mahjong') {
      await claimDiscard(gameId, myPlayerId, 'mahjong', [], pending.tile)
    } else {
      await claimDiscard(gameId, myPlayerId, type, claimTiles, pending.tile)
    }
    setClaimTiles([])
    setShowClaim(false)
  }

  async function handleDeclareWin() {
    await declareMahjong(gameId, myPlayerId)
  }

  async function handleJokerSwap(ownerId: string, setIndex: number, jokerIndex: number, jokerTile: Tile, replacementTile: Tile) {
    await swapJoker(gameId, ownerId, setIndex, jokerIndex, myPlayerId, replacementTile, jokerTile)
  }

  if (game.status === 'finished') {
    const winner = game.winner ? game.players[game.winner] : null
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#152030] text-white gap-6 p-8">
        <div className="text-6xl">🀄</div>
        <h2 className="text-3xl font-bold">Mah Jongg!</h2>
        {winner && (
          <p className="text-xl text-yellow-300">
            {game.winner === myPlayerId ? '🎉 You won!' : `${winner.nickname} wins!`}
          </p>
        )}
        <div className="w-full space-y-3">
          {playerIds.map(pid => {
            const p = game.players[pid]
            return (
              <div key={pid} className="bg-black/20 rounded-lg p-3">
                <p className="font-bold mb-2">{p.nickname} {pid === game.winner ? '👑' : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {p.hand.map(t => <TileComponent key={t.id} tile={t} small />)}
                </div>
                <ExposedSets sets={p.exposedSets} ownerId={pid} small />
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <button onClick={() => resetGame(gameId)} className="bg-yellow-400 text-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-300 active:scale-95">Play Again</button>
          <button onClick={onLeave} className="bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 active:scale-95">Leave</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#152030] text-white overflow-hidden">
      {/* Opponents */}
      <div className="flex-1 flex flex-col gap-0.5 p-1.5 overflow-hidden min-h-0">
        {opponents.map(pid => {
          const opp = game.players[pid]
          const isOppTurn = game.currentTurn === pid
          return (
            <div key={pid} className={`rounded px-1.5 py-1 ${isOppTurn ? 'bg-yellow-600/30 ring-1 ring-yellow-400' : 'bg-black/20'}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold shrink-0 max-w-[56px] truncate">{opp.nickname}</span>
                {isOppTurn && <span className="text-[10px] bg-yellow-400 text-black px-1 rounded shrink-0">▶</span>}
                <div className="flex gap-0.5 overflow-hidden flex-1">
                  {Array.from({ length: Math.min(opp.hand?.length ?? 0, 16) }).map((_, i) => (
                    <TileComponent key={i} tile={{ id: `fd-${i}`, suit: 'bam', value: 1, isJoker: false, label: '' }} faceDown small />
                  ))}
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">{opp.hand?.length ?? 0}</span>
              </div>
              {(opp.exposedSets?.length > 0 || opp.discards?.length > 0) && (
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <ExposedSets sets={opp.exposedSets ?? []} ownerId={pid} myHand={me?.hand}
                    onJokerSwap={isMyTurn ? (si, ji, jt, rt) => handleJokerSwap(pid, si, ji, jt, rt) : undefined} small />
                  {opp.discards && opp.discards.length > 0 && (
                    <div className="flex gap-0.5">
                      {opp.discards.slice(-6).map(t => <TileComponent key={t.id} tile={t} small />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div className="text-center text-xs text-emerald-400">
          🀫 {Math.max(0, (game.wall?.length ?? 0) - game.wallIndex)} tiles in wall
          <span className="text-emerald-800 ml-2">{VERSION}</span>
        </div>

        {showClaim && pending && !isMyDiscard && (
          <div className="bg-yellow-900/90 border border-yellow-400 rounded-lg p-2 space-y-1.5">
            <p className="text-yellow-300 font-bold text-center text-sm">Claim {pending.tile.label}? ({claimCountdown}s)</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={() => handleClaim('pung')} className="bg-blue-500 text-white px-3 py-1 rounded font-bold text-sm">Pung</button>
              <button onClick={() => handleClaim('kong')} className="bg-purple-500 text-white px-3 py-1 rounded font-bold text-sm">Kong</button>
              <button onClick={() => handleClaim('chow')} className="bg-green-500 text-white px-3 py-1 rounded font-bold text-sm">Chow</button>
              <button onClick={() => handleClaim('mahjong')} className="bg-yellow-500 text-black px-3 py-1 rounded font-bold text-sm">Mah Jongg!</button>
              <button onClick={() => passClaim(gameId)} className="bg-gray-600 text-white px-3 py-1 rounded font-bold text-sm">Pass</button>
            </div>
          </div>
        )}
      </div>

      {/* My area */}
      <div className={`shrink-0 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] border-t-2 ${isMyTurn ? 'border-yellow-400 bg-black/30' : 'border-emerald-700 bg-black/20'}`}>
        {(me?.exposedSets?.length > 0 || me?.discards?.length > 0) && (
          <div className="flex gap-2 mb-0.5 flex-wrap">
            <ExposedSets sets={me?.exposedSets ?? []} ownerId={myPlayerId} small />
            {me?.discards && me.discards.length > 0 && (
              <div className="flex gap-0.5 flex-wrap">
                {me.discards.slice(-6).map(t => <TileComponent key={t.id} tile={t} small />)}
              </div>
            )}
          </div>
        )}

        {/* Hand — small tiles, full width, drag-to-reorder */}
        <div
          ref={drag.containerRef}
          className="flex gap-1 overflow-x-auto"
          style={{ touchAction: drag.dragging ? 'none' : 'pan-x' }}
          onPointerMove={drag.onMove}
          onPointerUp={drag.onUp}
          onPointerCancel={drag.onCancel}
        >
          {displayHand.map(tile => (
            <div
              key={tile.id}
              data-drag-id={tile.id}
              onPointerDown={e => drag.onTileDown(e, tile.id)}
              style={drag.tileStyle(tile.id)}
            >
              <TileComponent
                tile={tile}
                small
                selected={!drag.dragging && isMyTurn && drewThisTurn && selectedTile?.id === tile.id}
                onClick={() => handleTileClick(tile)}
              />
            </div>
          ))}
        </div>

        {/* Action buttons — single row, never wraps */}
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={sortHand} className="text-xs text-emerald-400 border border-emerald-700 rounded px-2 py-1">Sort</button>
            <button onClick={onLeave} className="text-xs text-emerald-600 hover:text-red-400 py-1 px-1">Leave</button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isMyTurn && !drewThisTurn && (
              <button onClick={handleDraw} className="bg-emerald-500 text-white font-bold py-1.5 px-4 rounded-lg text-sm active:scale-95">
                Draw Tile
              </button>
            )}
            {isMyTurn && drewThisTurn && (
              <>
                <button
                  onClick={handleDiscard}
                  disabled={!selectedTile}
                  className={`font-bold py-1.5 px-3 rounded-lg text-sm transition-all ${selectedTile ? 'bg-red-500 text-white active:scale-95' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                >
                  {selectedTile ? `Discard (${selectedTile.label})` : 'Discard'}
                </button>
                <button onClick={handleDeclareWin} className="bg-yellow-400 text-black font-bold py-1.5 px-3 rounded-lg text-sm active:scale-95">
                  Mah Jongg!
                </button>
              </>
            )}
            {!isMyTurn && !canClaim && (
              <p className="text-emerald-400 text-xs">
                {game.currentTurn ? `Waiting for ${game.players[game.currentTurn]?.nickname ?? '…'}` : 'Waiting…'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
