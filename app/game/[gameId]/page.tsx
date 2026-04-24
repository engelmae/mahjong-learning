'use client'
import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GameState } from '@/types/game'
import { subscribeToGame, joinGame, dealGame } from '@/lib/gameActions'
import Charleston from '@/components/Charleston'
import GameBoard from '@/components/GameBoard'

interface Props {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: Props) {
  const { gameId } = use(params)
  const router = useRouter()

  const [game, setGame] = useState<GameState | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string>('')
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dealing, setDealing] = useState(false)

  // Restore or prompt for identity
  useEffect(() => {
    const storedId = sessionStorage.getItem(`mahjong_player_${gameId}`)
    if (storedId) {
      setMyPlayerId(storedId)
    } else {
      setShowNicknameModal(true)
    }
  }, [gameId])

  // Subscribe to game state
  useEffect(() => {
    const unsub = subscribeToGame(gameId, setGame)
    return unsub
  }, [gameId])

  async function handleJoin() {
    if (!nickname.trim()) { setError('Enter a nickname'); return }
    setJoining(true)
    try {
      const playerId = crypto.randomUUID()
      await joinGame(gameId, playerId, nickname.trim())
      sessionStorage.setItem(`mahjong_player_${gameId}`, playerId)
      sessionStorage.setItem(`mahjong_nickname_${gameId}`, nickname.trim())
      setMyPlayerId(playerId)
      setShowNicknameModal(false)
    } catch (e: any) {
      setError(e.message ?? 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDeal() {
    setDealing(true)
    try {
      await dealGame(gameId)
    } finally {
      setDealing(false)
    }
  }

  // ── Nickname modal ────────────────────────────────────────────────────────
  if (showNicknameModal) {
    return (
      <main className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="bg-emerald-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🀄</div>
            <h2 className="text-white font-bold text-xl">Join Game</h2>
            <p className="text-emerald-400 text-sm">Code: {gameId}</p>
          </div>
          <input
            type="text"
            placeholder="Your nickname"
            value={nickname}
            onChange={e => { setNickname(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={20}
            autoFocus
            className="w-full bg-emerald-800 text-white rounded-lg px-4 py-3 placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
          >
            {joining ? 'Joining…' : 'Join Game'}
          </button>
          <button onClick={() => router.push('/')} className="w-full text-emerald-400 text-sm hover:text-emerald-300">
            ← Back to home
          </button>
        </div>
      </main>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!game || !myPlayerId) {
    return (
      <main className="min-h-screen bg-emerald-950 flex items-center justify-center">
        <div className="text-emerald-300 text-lg animate-pulse">Loading game…</div>
      </main>
    )
  }

  // ── Not in game ───────────────────────────────────────────────────────────
  if (!game.players[myPlayerId]) {
    return (
      <main className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="text-center text-white space-y-4">
          <p className="text-red-400">You are not in this game.</p>
          <button onClick={() => router.push('/')} className="bg-yellow-400 text-black font-bold py-2 px-6 rounded-lg">
            Home
          </button>
        </div>
      </main>
    )
  }

  const players = Object.values(game.players).sort((a, b) => a.seatIndex - b.seatIndex)
  const isHost = game.hostId === myPlayerId
  const playerCount = players.length

  // ── Waiting lobby ─────────────────────────────────────────────────────────
  if (game.status === 'waiting') {
    return (
      <main className="min-h-screen bg-emerald-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-1">🀄</div>
            <h1 className="text-white font-bold text-xl">Game Lobby</h1>
            <p className="text-emerald-400 text-sm">Code: <span className="font-mono font-bold text-white">{gameId}</span></p>
          </div>

          {/* Share link */}
          <div className="bg-emerald-900 rounded-xl p-4 space-y-2">
            <p className="text-emerald-300 text-sm font-medium">Share this link with friends:</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-emerald-800 text-white text-xs rounded px-2 py-2 truncate">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </code>
              <button
                onClick={copyLink}
                className="bg-yellow-400 text-black font-bold px-3 py-2 rounded text-sm hover:bg-yellow-300 shrink-0"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Players */}
          <div className="bg-emerald-900 rounded-xl p-4 space-y-2">
            <p className="text-emerald-300 text-sm font-medium">Players ({playerCount}/4):</p>
            {players.map(p => (
              <div key={p.seatIndex} className="flex items-center gap-2 text-white">
                <span className="text-emerald-400">#{p.seatIndex + 1}</span>
                <span className="font-medium">{p.nickname}</span>
                {game.players[game.hostId]?.seatIndex === p.seatIndex && (
                  <span className="text-xs bg-yellow-400 text-black px-1 rounded">Host</span>
                )}
              </div>
            ))}
            {playerCount < 4 && (
              <p className="text-emerald-500 text-xs">Waiting for {4 - playerCount} more player{4 - playerCount !== 1 ? 's' : ''}…</p>
            )}
          </div>

          {isHost && playerCount === 4 && (
            <button
              onClick={handleDeal}
              disabled={dealing}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl text-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
            >
              {dealing ? 'Dealing…' : 'Deal Tiles & Start!'}
            </button>
          )}
          {!isHost && (
            <p className="text-center text-emerald-400 text-sm">
              {playerCount < 4 ? 'Waiting for more players…' : 'Waiting for host to deal…'}
            </p>
          )}
        </div>
      </main>
    )
  }

  // ── Charleston ────────────────────────────────────────────────────────────
  if (game.status === 'charleston') {
    return (
      <>
        <div className="landscape-required">
          <div className="text-5xl">📱↔️</div>
          <p className="text-xl font-bold">Rotate your phone to landscape to play</p>
        </div>
        <main className="h-screen bg-emerald-900 overflow-hidden">
          <Charleston game={game} gameId={gameId} myPlayerId={myPlayerId} />
        </main>
      </>
    )
  }

  // ── Playing / Finished ────────────────────────────────────────────────────
  return (
    <>
      <div className="landscape-required">
        <div className="text-5xl">📱↔️</div>
        <p className="text-xl font-bold">Rotate your phone to landscape to play</p>
      </div>
      <main className="h-screen bg-emerald-900 overflow-hidden">
        <GameBoard game={game} gameId={gameId} myPlayerId={myPlayerId} />
      </main>
    </>
  )
}
