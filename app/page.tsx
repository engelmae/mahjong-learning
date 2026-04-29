'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { createGame, createGameWithBots } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'

const INPUT = "w-full bg-[#1c2e42] text-white rounded-lg px-4 py-3 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-slate-700"
const BTN_PRIMARY = "w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
const BTN_SECONDARY = "w-full bg-emerald-700 text-white font-bold py-3 rounded-lg hover:bg-emerald-600 active:scale-95 transition-all"
const BTN_BACK = "w-full text-slate-400 text-sm hover:text-slate-200 py-2 transition-colors"

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home')
  const [botCount, setBotCount] = useState<0 | 1 | 2 | 3>(0)

  async function handleCreate() {
    if (!nickname.trim()) { setError('Enter a nickname'); return }
    setLoading(true)
    try {
      const gameId = nanoid(6).toUpperCase()
      const playerId = crypto.randomUUID()
      sessionStorage.setItem(`mahjong_player_${gameId}`, playerId)
      sessionStorage.setItem(`mahjong_nickname_${gameId}`, nickname.trim())
      if (botCount > 0) {
        await createGameWithBots(gameId, playerId, nickname.trim(), botCount as 1 | 2 | 3)
      } else {
        await createGame(gameId, playerId, nickname.trim())
      }
      router.push(`/game/${gameId}`)
    } catch (e: any) {
      setError(e.message ?? 'Failed to create game')
      setLoading(false)
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code) { setError('Enter a game code'); return }
    router.push(`/game/${code}`)
  }

  const createLabel = botCount === 3
    ? (loading ? 'Starting…' : 'Play Solo')
    : botCount > 0
    ? (loading ? 'Creating…' : 'Create Game')
    : (loading ? 'Creating…' : 'Create & Share Link')

  return (
    <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-4 overflow-auto">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full max-w-2xl">

        {/* Brand */}
        <div className="text-center sm:text-left sm:w-52 sm:pt-2 shrink-0">
          <div className="text-5xl sm:text-4xl mb-2">🀄</div>
          <h1 className="text-2xl sm:text-xl font-bold text-white">American Mahjong</h1>
          <p className="text-emerald-400 text-sm mt-1">Play with friends, anywhere</p>
          <p className="text-slate-700 text-xs mt-1">{VERSION}</p>
        </div>

        {/* Forms */}
        <div className="w-full max-w-sm sm:flex-1">

          {mode === 'home' && (
            <div className="space-y-3">
              <button onClick={() => setMode('create')} className={BTN_PRIMARY}>Create Game</button>
              <button onClick={() => setMode('join')} className={BTN_SECONDARY}>Join Game</button>
            </div>
          )}

          {mode === 'create' && (
            <div className="bg-[#152030] rounded-2xl p-5 space-y-4 border border-slate-700/50">
              <h2 className="text-white font-bold text-lg">Create a Game</h2>

              <input
                type="text"
                placeholder="Your nickname"
                value={nickname}
                onChange={e => { setNickname(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                maxLength={20}
                autoFocus
                className={INPUT}
              />

              {/* Bot count selector */}
              <div>
                <p className="text-slate-400 text-sm mb-2">Bot opponents</p>
                <div className="flex gap-2">
                  {([0, 1, 2, 3] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setBotCount(n)}
                      className={[
                        'flex-1 py-2 rounded-lg font-bold text-sm transition-all active:scale-95',
                        botCount === n
                          ? 'bg-yellow-400 text-black'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-1.5">
                  {botCount === 0
                    ? 'Share the link with up to 3 friends'
                    : botCount === 3
                    ? 'Play solo against 3 bots — starts immediately'
                    : `${botCount} bot${botCount > 1 ? 's' : ''} fill the remaining seat${botCount > 1 ? 's' : ''} — share link for ${3 - botCount} more`}
                </p>
              </div>

              {error && <p className="text-amber-400 text-sm">{error}</p>}

              <button onClick={handleCreate} disabled={loading} className={BTN_PRIMARY}>
                {createLabel}
              </button>
              <button onClick={() => { setMode('home'); setError(''); setBotCount(0) }} className={BTN_BACK}>← Back</button>
            </div>
          )}

          {mode === 'join' && (
            <div className="bg-[#152030] rounded-2xl p-5 space-y-3 border border-slate-700/50">
              <h2 className="text-white font-bold text-lg">Join a Game</h2>
              <input
                type="text"
                placeholder="Game code (e.g. AB12CD)"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                maxLength={6}
                autoFocus
                className={INPUT + ' uppercase tracking-widest'}
              />
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button onClick={handleJoin} className={BTN_PRIMARY}>Join Game</button>
              <button onClick={() => { setMode('home'); setError('') }} className={BTN_BACK}>← Back</button>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
