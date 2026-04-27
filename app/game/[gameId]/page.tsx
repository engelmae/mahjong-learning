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

  // ── Shared layout helpers ─────────────────────────────────────────────────
  const UtilScreen = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4 overflow-auto">
      {children}
    </main>
  )
  const TwoCol = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 w-full max-w-2xl">
      <div className="text-center sm:text-left sm:w-48 shrink-0">{left}</div>
      <div className="w-full max-w-sm sm:flex-1">{right}</div>
    </div>
  )
  const Brand = ({ sub }: { sub?: string }) => (
    <>
      <div className="text-4xl mb-1">🀄</div>
      <h1 className="text-white font-bold text-lg">American Mahjong</h1>
      {sub && <p className="text-emerald-400 text-sm mt-0.5">{sub}</p>}
    </>
  )

  // ── Nickname modal ────────────────────────────────────────────────────────
  if (showNicknameModal) {
    return (
      <UtilScreen>
        <TwoCol
          left={<Brand sub={`Game: ${gameId}`} />}
          right={
            <div className="bg-[#152030] rounded-2xl p-5 space-y-3 border border-slate-700/50">
              <h2 className="text-white font-bold text-lg">Enter your name</h2>
              <input
                type="text"
                placeholder="Nickname"
                value={nickname}
                onChange={e => { setNickname(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                maxLength={20}
                autoFocus
                className="w-full bg-[#1c2e42] text-white rounded-lg px-4 py-3 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-slate-700"
              />
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button onClick={handleJoin} disabled={joining}
                className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50">
                {joining ? 'Joining…' : 'Join Game'}
              </button>
              <button onClick={() => router.push('/')} className="w-full text-slate-400 text-sm hover:text-slate-200 py-1 transition-colors">
                ← Back to home
              </button>
            </div>
          }
        />
      </UtilScreen>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!game || !myPlayerId) {
    return (
      <UtilScreen>
        <div className="text-emerald-300 text-lg animate-pulse">Loading game…</div>
      </UtilScreen>
    )
  }

  // ── Not in game ───────────────────────────────────────────────────────────
  if (!game.players[myPlayerId]) {
    return (
      <UtilScreen>
        <div className="text-center text-white space-y-4">
          <p className="text-amber-400">You are not in this game.</p>
          <button onClick={() => router.push('/')} className="bg-yellow-400 text-black font-bold py-2 px-6 rounded-lg hover:bg-yellow-300 active:scale-95">
            Home
          </button>
        </div>
      </UtilScreen>
    )
  }

  const players = Object.values(game.players).sort((a, b) => a.seatIndex - b.seatIndex)
  const isHost = game.hostId === myPlayerId
  const playerCount = players.length

  // ── Waiting lobby ─────────────────────────────────────────────────────────
  if (game.status === 'waiting') {
    return (
      <UtilScreen>
        <TwoCol
          left={
            <>
              <Brand sub="Game Lobby" />
              <p className="text-sm text-slate-400 mt-1">Code: <span className="font-mono font-bold text-white">{gameId}</span></p>
            </>
          }
          right={
            <div className="space-y-3 w-full">
              {botIds.length > 0 ? (
                <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4">
                  <p className="text-emerald-300 text-sm font-semibold text-center">Solo Test Mode</p>
                  <p className="text-emerald-500 text-xs text-center mt-1">3 bots will play automatically</p>
                </div>
              ) : (
                <div className="bg-[#152030] rounded-xl p-4 space-y-2 border border-slate-700/50">
                  <p className="text-slate-300 text-sm font-medium">Share with friends:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-[#0f1923] text-slate-300 text-xs rounded px-2 py-2 truncate border border-slate-700">
                      {typeof window !== 'undefined' ? window.location.href : ''}
                    </code>
                    <button onClick={copyLink}
                      className="bg-yellow-400 text-black font-bold px-3 py-2 rounded text-sm hover:bg-yellow-300 shrink-0 active:scale-95 transition-all">
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-[#152030] rounded-xl p-4 space-y-1.5 border border-slate-700/50">
                <p className="text-slate-300 text-sm font-medium mb-2">Players ({playerCount}/4)</p>
                {players.map(p => (
                  <div key={p.seatIndex} className="flex items-center gap-2 text-white text-sm">
                    <span className="text-emerald-500">#{p.seatIndex + 1}</span>
                    <span>{p.nickname}</span>
                    {game.players[game.hostId]?.seatIndex === p.seatIndex && (
                      <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-bold">Host</span>
                    )}
                  </div>
                ))}
                {playerCount < 4 && (
                  <p className="text-slate-500 text-xs pt-1">Waiting for {4 - playerCount} more…</p>
                )}
              </div>

              {isHost && playerCount === 4 && (
                <button onClick={handleDeal} disabled={dealing}
                  className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl text-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50">
                  {dealing ? 'Dealing…' : 'Deal Tiles & Start!'}
                </button>
              )}
              {!isHost && (
                <p className="text-center text-slate-400 text-sm py-1">
                  {playerCount < 4 ? 'Waiting for more players…' : 'Waiting for host to deal…'}
                </p>
              )}
              <button onClick={handleLeave} className="w-full text-slate-500 hover:text-slate-300 text-sm py-1.5 transition-colors">
                Leave Game
              </button>
            </div>
          }
        />
      </UtilScreen>
    )
  }

  // ── Abandoned ─────────────────────────────────────────────────────────────
  if (game.status === 'abandoned') {
    return (
      <UtilScreen>
        <div className="text-center space-y-4">
          <div className="text-5xl">😔</div>
          <h2 className="text-white font-bold text-xl">Game Ended</h2>
          <p className="text-slate-400">A player left the game.</p>
          <button onClick={() => router.push('/')} className="bg-yellow-400 text-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-300 active:scale-95">
            Back to Home
          </button>
        </div>
      </UtilScreen>
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
        <main className="fixed inset-0 bg-[#152030] overflow-hidden">
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
      <main className="fixed inset-0 bg-[#152030] overflow-hidden">
        <GameBoard game={game} gameId={gameId} myPlayerId={myPlayerId} onLeave={handleLeave} />
      </main>
    </>
  )
}
