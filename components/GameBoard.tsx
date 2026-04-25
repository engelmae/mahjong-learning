'use client'
import { useState, useEffect } from 'react'
import { GameState, Tile } from '@/types/game'
import TileComponent from './Tile'
import ExposedSets from './ExposedSets'
import { drawTile, discardTile, claimDiscard, passClaim, declareMahjong, swapJoker, resetGame } from '@/lib/gameActions'

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

  const me = game.players[myPlayerId]
  const isMyTurn = game.currentTurn === myPlayerId
  const pending = game.pendingClaim
  const isMyDiscard = pending?.fromPlayerId === myPlayerId
  const canClaim = !!pending && !isMyDiscard && game.status === 'playing'

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
      if (r <= 0) {
        setShowClaim(false)
        clearInterval(interval)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [pending?.tile?.id, isMyDiscard])

  // Reset draw state when turn changes
  useEffect(() => {
    setDrewThisTurn(false)
    setSelectedTile(null)
  }, [game.currentTurn])

  const playerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const opponents = playerIds.filter(id => id !== myPlayerId)

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

  async function handlePass() {
    await passClaim(gameId)
  }

  async function handleDeclareWin() {
    await declareMahjong(gameId, myPlayerId)
  }

  async function handleJokerSwap(
    ownerId: string,
    setIndex: number,
    jokerIndex: number,
    jokerTile: Tile,
    replacementTile: Tile
  ) {
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
        {/* Show all hands */}
        <div className="w-full space-y-3">
          {playerIds.map(pid => {
            const p = game.players[pid]
            return (
              <div key={pid} className="bg-black/20 rounded-lg p-3">
                <p className="font-bold mb-2">
                  {p.nickname} {pid === game.winner ? '👑' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.hand.map(t => <TileComponent key={t.id} tile={t} small />)}
                </div>
                <ExposedSets sets={p.exposedSets} ownerId={pid} small />
              </div>
            )
          })}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => resetGame(gameId)}
            className="bg-yellow-400 text-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-300 active:scale-95"
          >
            Play Again
          </button>
          <button
            onClick={onLeave}
            className="bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 active:scale-95"
          >
            Leave
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#152030] text-white overflow-hidden">
      {/* Opponents area - top portion */}
      <div className="flex-1 flex flex-col gap-1 p-2 overflow-hidden">
        {opponents.map(pid => {
          const opp = game.players[pid]
          const isOppTurn = game.currentTurn === pid
          return (
            <div key={pid} className={`rounded-lg p-2 ${isOppTurn ? 'bg-yellow-600/30 ring-1 ring-yellow-400' : 'bg-black/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold">{opp.nickname}</span>
                {isOppTurn && <span className="text-xs bg-yellow-400 text-black px-1 rounded">Their turn</span>}
                <span className="text-xs text-gray-400 ml-auto">{opp.hand?.length ?? 0} tiles</span>
              </div>
              {/* Face-down hand */}
              <div className="flex gap-0.5 overflow-hidden">
                {Array.from({ length: Math.min(opp.hand?.length ?? 0, 16) }).map((_, i) => (
                  <TileComponent key={i} tile={{ id: `fd-${i}`, suit: 'bam', value: 1, isJoker: false, label: '' }} faceDown small />
                ))}
              </div>
              <ExposedSets
                sets={opp.exposedSets ?? []}
                ownerId={pid}
                myHand={me?.hand}
                onJokerSwap={isMyTurn ? (si, ji, jt, rt) => handleJokerSwap(pid, si, ji, jt, rt) : undefined}
                small
              />
              {/* Discard pile - last few discards */}
              {opp.discards && opp.discards.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap">
                  {opp.discards.slice(-8).map(t => (
                    <TileComponent key={t.id} tile={t} small />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Wall count */}
        <div className="text-center text-xs text-emerald-400">
          🀫 {Math.max(0, (game.wall?.length ?? 0) - game.wallIndex)} tiles in wall
        </div>

        {/* Pending claim overlay */}
        {showClaim && pending && !isMyDiscard && (
          <div className="bg-yellow-900/90 border border-yellow-400 rounded-lg p-3 space-y-2">
            <p className="text-yellow-300 font-bold text-center">
              Claim {pending.tile.label}? ({claimCountdown}s)
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button onClick={() => handleClaim('pung')} className="bg-blue-500 text-white px-3 py-1.5 rounded font-bold text-sm hover:bg-blue-400">Pung</button>
              <button onClick={() => handleClaim('kong')} className="bg-purple-500 text-white px-3 py-1.5 rounded font-bold text-sm hover:bg-purple-400">Kong</button>
              <button onClick={() => handleClaim('chow')} className="bg-green-500 text-white px-3 py-1.5 rounded font-bold text-sm hover:bg-green-400">Chow</button>
              <button onClick={() => handleClaim('mahjong')} className="bg-yellow-500 text-black px-3 py-1.5 rounded font-bold text-sm hover:bg-yellow-400">Mah Jongg!</button>
              <button onClick={handlePass} className="bg-gray-600 text-white px-3 py-1.5 rounded font-bold text-sm hover:bg-gray-500">Pass</button>
            </div>
          </div>
        )}
      </div>

      {/* My area - bottom fixed strip */}
      <div className={`shrink-0 p-2 border-t-2 ${isMyTurn ? 'border-yellow-400 bg-black/30' : 'border-emerald-700 bg-black/20'}`}>
        {/* My exposed + discards */}
        <div className="flex gap-2 mb-1 flex-wrap">
          <ExposedSets
            sets={me?.exposedSets ?? []}
            ownerId={myPlayerId}
            small
          />
          {me?.discards && me.discards.length > 0 && (
            <div className="flex gap-0.5 flex-wrap">
              {me.discards.slice(-6).map(t => <TileComponent key={t.id} tile={t} small />)}
            </div>
          )}
        </div>

        {/* My hand - landscape: fits 14 tiles */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(me?.hand ?? []).map(tile => (
            <TileComponent
              key={tile.id}
              tile={tile}
              selected={selectedTile?.id === tile.id}
              onClick={isMyTurn && drewThisTurn ? () => setSelectedTile(prev => prev?.id === tile.id ? null : tile) : undefined}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-2 justify-center flex-wrap">
          {isMyTurn && !drewThisTurn && (
            <button
              onClick={handleDraw}
              className="bg-emerald-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-400 active:scale-95 text-sm"
            >
              Draw Tile
            </button>
          )}
          {isMyTurn && drewThisTurn && (
            <>
              <button
                onClick={handleDiscard}
                disabled={!selectedTile}
                className={`font-bold py-2 px-5 rounded-lg text-sm transition-all ${selectedTile ? 'bg-red-500 text-white hover:bg-red-400 active:scale-95' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
              >
                Discard {selectedTile ? `(${selectedTile.label})` : '(tap a tile)'}
              </button>
              <button
                onClick={handleDeclareWin}
                className="bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg hover:bg-yellow-300 active:scale-95 text-sm"
              >
                Mah Jongg! 🀄
              </button>
            </>
          )}
          {!isMyTurn && !canClaim && (
            <p className="text-emerald-400 text-sm py-2">
              {game.currentTurn ? `Waiting for ${game.players[game.currentTurn]?.nickname ?? '…'}` : 'Waiting…'}
            </p>
          )}
          <button
            onClick={onLeave}
            className="text-xs text-emerald-600 hover:text-red-400 py-2 px-2"
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  )
}
