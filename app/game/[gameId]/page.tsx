'use client'
import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GameState } from '@/types/game'
import { subscribeToGame, joinGame, dealGame, leaveGame, botTakeTurn, botClaimAndDiscard, submitCharlestionPass, passClaim } from '@/lib/gameActions'
import { botPickCharleston, botDecideClaim, buildVisibility } from '@/lib/botLogic'
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

  // Clear acted set on game reset so bots can act fresh in the new game
  useEffect(() => {
    if (game?.status === 'waiting') botActed.current.clear()
  }, [game?.status])

  // Auto-deal when all seats are filled and the game has bots (host only)
  useEffect(() => {
    if (!game || !myPlayerId) return
    const isHost = game.hostId === myPlayerId
    if (!isHost || game.status !== 'waiting') return
    const players = Object.values(game.players)
    const hasBots = players.some(p => p.isBot)
    if (hasBots && players.length === 4) {
      const t = setTimeout(() => dealGame(gameId), 1500)
      return () => clearTimeout(t)
    }
  }, [game?.status, Object.keys(game?.players ?? {}).length, myPlayerId])

  // Bot engine — runs only on the host's client
  useEffect(() => {
    if (!game || !myPlayerId) return
    const isHost = game.hostId === myPlayerId
    if (!isHost) return

    const bots = Object.entries(game.players)
      .filter(([, p]) => p.isBot)
      .map(([id]) => id)
    if (!bots.length) return

    // Charleston: auto-submit for bots that haven't passed yet
    if (game.status === 'charleston') {
      bots.forEach(botId => {
        const p = game.players[botId]
        if (!p || p.charlestionReady) return
        const key = `char-${botId}-${game.charlestionRound}`
        if (botActed.current.has(key)) return
        botActed.current.add(key)
        const allDiscards = Object.values(game.players).flatMap(pl => pl.discards ?? [])
        const vis = buildVisibility(allDiscards, [])
        const selection = botPickCharleston(p.hand, p.exposedSets ?? [], vis)
        setTimeout(() => submitCharlestionPass(gameId, botId, selection), 600 + Math.random() * 600)
      })
      return
    }

    if (game.status !== 'playing') return

    // Claim window: check if any bot wants to pung/kong
    if (game.pendingClaim) {
      const pending = game.pendingClaim
      let botWillClaim = false

      for (const botId of bots) {
        if (botId === pending.fromPlayerId) continue
        const hand = game.players[botId]?.hand ?? []
        const botExposed = game.players[botId]?.exposedSets ?? []
        const allDiscards = Object.values(game.players).flatMap(pl => pl.discards ?? [])
        const visForClaim = buildVisibility(allDiscards, [])
        const claimType = botDecideClaim(hand, botExposed, pending.tile, visForClaim)
        if (!claimType) continue

        const key = `claim-${botId}-${pending.tile.id}`
        if (botActed.current.has(key)) { botWillClaim = true; break }
        botActed.current.add(key)
        // Pre-register the turn key so the turn branch below skips this bot's
        // upcoming currentTurn (set by claimDiscard) and doesn't try to draw
        botActed.current.add(`turn-${botId}-${game.wallIndex}`)

        setTimeout(() => botClaimAndDiscard(gameId, botId), 1000 + Math.random() * 1000)
        botWillClaim = true
        break  // only one bot claims per discard
      }

      // All bots passed: if the discarding player is human and every other player
      // is a bot, skip the countdown and advance the turn immediately.
      if (!botWillClaim && !pending.claimingPlayerId) {
        const discarder = game.players[pending.fromPlayerId]
        const otherHumans = Object.entries(game.players)
          .filter(([id, p]) => id !== pending.fromPlayerId && !p.isBot).length
        if (discarder && !discarder.isBot && otherHumans === 0) {
          const key = `autopass-${pending.tile.id}`
          if (!botActed.current.has(key)) {
            botActed.current.add(key)
            setTimeout(() => passClaim(gameId), 500)
          }
        }
      }

      return  // don't process turns while a claim window is open
    }

    // Normal turn: bot draws then discards
    if (!game.currentTurn || !bots.includes(game.currentTurn)) return
    const botId = game.currentTurn
    const key = `turn-${botId}-${game.wallIndex}`
    if (botActed.current.has(key)) return
    botActed.current.add(key)
    setTimeout(() => botTakeTurn(gameId, botId), 1200 + Math.random() * 800)

  }, [game?.status, game?.currentTurn, game?.charlestionRound, game?.pendingClaim?.tile?.id, myPlayerId])

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
  const botCount = players.filter(p => p.isBot).length
  const openSeats = 4 - playerCount

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
            <div className="space-y-2 w-full">
              {/* Share link — only when human seats are still open */}
              {openSeats > 0 && (
                <div className="bg-[#152030] rounded-xl px-3 py-2 space-y-1.5 border border-slate-700/50">
                  <p className="text-slate-300 text-sm font-medium">Share with friends:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-[#0f1923] text-slate-300 text-xs rounded px-2 py-1.5 truncate border border-slate-700">
                      {typeof window !== 'undefined' ? window.location.href : ''}
                    </code>
                    <button onClick={copyLink}
                      className="bg-yellow-400 text-black font-bold px-3 py-1.5 rounded text-sm hover:bg-yellow-300 shrink-0 active:scale-95 transition-all">
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Player list */}
              <div className="bg-[#152030] rounded-xl px-3 py-2 space-y-1 border border-slate-700/50">
                <p className="text-slate-300 text-sm font-medium mb-1">
                  Players ({playerCount - botCount}/{4 - botCount})
                </p>
                {players.map(p => (
                  <div key={p.seatIndex} className="flex items-center gap-2 text-white text-sm">
                    <span className="text-emerald-500">#{p.seatIndex + 1}</span>
                    <span>{p.nickname}</span>
                    {p.isBot && (
                      <span className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded font-bold">BOT</span>
                    )}
                    {game.players[game.hostId]?.seatIndex === p.seatIndex && !p.isBot && (
                      <span className="text-[10px] bg-yellow-400 text-black px-1.5 py-0.5 rounded font-bold">Host</span>
                    )}
                  </div>
                ))}
                {openSeats > 0 && (
                  <p className="text-slate-500 text-xs pt-0.5">Waiting for {openSeats} more player{openSeats > 1 ? 's' : ''}…</p>
                )}
              </div>

              {isHost && playerCount === 4 && (
                <button onClick={handleDeal} disabled={dealing}
                  className="w-full bg-yellow-400 text-black font-bold py-2.5 rounded-xl text-base hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50">
                  {dealing ? 'Dealing…' : 'Deal Tiles & Start!'}
                </button>
              )}
              {!isHost && (
                <p className="text-center text-slate-400 text-sm py-0.5">
                  {playerCount < 4 ? 'Waiting for more players…' : 'Waiting for host to deal…'}
                </p>
              )}
              <button onClick={handleLeave} className="w-full text-slate-500 hover:text-slate-300 text-sm py-1 transition-colors">
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
