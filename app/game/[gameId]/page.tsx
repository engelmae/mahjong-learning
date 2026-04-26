'use client'
import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameState } from '@/types/game'
import { subscribeToGame, joinGame, dealGame, leaveGame, botTakeTurn, submitCharlestionPass, passClaim } from '@/lib/gameActions'
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

  const [botIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(sessionStorage.getItem(`mahjong_bots_${gameId}`) ?? '[]') } catch { return [] }
  })
  const botActed = useRef<Set<string>>(new Set())

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

  // Auto-advance claim window when timer expires (all games)
  useEffect(() => {
    if (!game?.pendingClaim) return
    const remaining = Math.max(0, game.pendingClaim.expiresAt - Date.now())
    const t = setTimeout(() => passClaim(gameId), remaining + 300)
    return () => clearTimeout(t)
  }, [game?.pendingClaim?.tile?.id])

  // Bot engine (test mode only)
  useEffect(() => {
    if (!game || !botIds.length) return
    const acted = botActed.current

    if (game.status === 'charleston') {
      botIds.forEach(botId => {
        const p = game.players[botId]
        if (!p || p.charlestionReady) return
        const key = `char-${botId}-${game.charlestionRound}`
        if (acted.has(key)) return
        acted.add(key)
        const selection = [...p.hand].sort(() => Math.random() - 0.5).slice(0, 3)
        setTimeout(() => submitCharlestionPass(gameId, botId, selection), 600 + Math.random() * 600)
      })
    }

    if (game.status === 'playing' && game.currentTurn && botIds.includes(game.currentTurn)) {
      const botId = game.currentTurn
      const key = `turn-${botId}-${game.wallIndex}`
      if (acted.has(key)) return
      acted.add(key)
      setTimeout(() => botTakeTurn(gameId, botId), 1200 + Math.random() * 800)
    }
  }, [game?.status, game?.currentTurn, game?.charlestionRound])

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

  async function handleLeave() {
    if (!myPlayerId) { router.push('/'); return }
    await leaveGame(gameId, myPlayerId)
    sessionStorage.removeItem(`mahjong_player_${gameId}`)
    sessionStorage.removeItem(`mahjong_nickname_${gameId}`)
    router.push('/')
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
      <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-6">
        <div className="bg-[#152030] rounded-2xl p-6 w-full max-w-sm space-y-4">
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
      <main className="min-h-screen bg-[#0f1923] flex items-center justify-center">
        <div className="text-emerald-300 text-lg animate-pulse">Loading game…</div>
      </main>
    )
  }

  // ── Not in game ───────────────────────────────────────────────────────────
  if (!game.players[myPlayerId]) {
    return (
      <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-6">
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
      <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-1">🀄</div>
            <h1 className="text-white font-bold text-xl">Game Lobby</h1>
            <p className="text-emerald-400 text-sm">Code: <span className="font-mono font-bold text-white">{gameId}</span></p>
          </div>

          {/* Share link / test mode banner */}
          {botIds.length > 0 ? (
            <div className="bg-emerald-900/50 border border-emerald-600 rounded-xl p-4">
              <p className="text-emerald-300 text-sm font-medium text-center">Solo Test Mode</p>
              <p className="text-emerald-500 text-xs text-center mt-1">3 bots will play automatically</p>
            </div>
          ) : (
            <div className="bg-[#152030] rounded-xl p-4 space-y-2">
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
          )}

          {/* Players */}
          <div className="bg-[#152030] rounded-xl p-4 space-y-2">
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
          <button
            onClick={handleLeave}
            className="w-full text-emerald-500 hover:text-red-400 text-sm py-2"
          >
            Leave Game
          </button>
        </div>
      </main>
    )
  }

  // ── Abandoned ─────────────────────────────────────────────────────────────
  if (game.status === 'abandoned') {
    return (
      <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="text-5xl">😔</div>
          <h2 className="text-white font-bold text-xl">Game Ended</h2>
          <p className="text-emerald-400">A player left the game.</p>
          <button onClick={() => router.push('/')} className="bg-yellow-400 text-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-300">
            Back to Home
          </button>
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
        <main className="h-dvh bg-[#152030] overflow-hidden">
          <Charleston game={game} gameId={gameId} myPlayerId={myPlayerId} onLeave={handleLeave} />
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
      <main className="h-screen bg-[#152030] overflow-hidden">
        <GameBoard game={game} gameId={gameId} myPlayerId={myPlayerId} onLeave={handleLeave} />
      </main>
    </>
  )
}
