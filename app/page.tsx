'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { createGame, createTestGame } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'

const INPUT = "w-full bg-[#1c2e42] text-white rounded-lg px-4 py-3 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-slate-700"
const BTN_PRIMARY = "w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
const BTN_SECONDARY = "w-full bg-emerald-700 text-white font-bold py-3 rounded-lg hover:bg-emerald-600 active:scale-95 transition-all"
const BTN_GHOST = "w-full bg-[#152030] text-emerald-400 font-bold py-3 rounded-lg hover:bg-[#1c2e42] active:scale-95 transition-all border border-emerald-700/50"
const BTN_BACK = "w-full text-slate-400 text-sm hover:text-slate-200 py-2 transition-colors"

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'home' | 'create' | 'join' | 'test'>('home')

  async function handleCreate() {
    if (!nickname.trim()) { setError('Enter a nickname'); return }
    setLoading(true)
    try {
      const gameId = nanoid(6).toUpperCase()
      const playerId = crypto.randomUUID()
      sessionStorage.setItem(`mahjong_player_${gameId}`, playerId)
      sessionStorage.setItem(`mahjong_nickname_${gameId}`, nickname.trim())
      await createGame(gameId, playerId, nickname.trim())
      router.push(`/game/${gameId}`)
    } catch (e: any) {
      setError(e.message ?? 'Failed to create game')
      setLoading(false)
    }
  }

  async function handleTestMode() {
    if (!nickname.trim()) { setError('Enter a nickname'); return }
    setLoading(true)
    try {
      const gameId = nanoid(6).toUpperCase()
      const playerId = crypto.randomUUID()
      const botIds = await createTestGame(gameId, playerId, nickname.trim())
      sessionStorage.setItem(`mahjong_player_${gameId}`, playerId)
      sessionStorage.setItem(`mahjong_nickname_${gameId}`, nickname.trim())
      sessionStorage.setItem(`mahjong_bots_${gameId}`, JSON.stringify(botIds))
      router.push(`/game/${gameId}`)
    } catch (e: any) {
      setError(e.message ?? 'Failed to start test game')
      setLoading(false)
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code) { setError('Enter a game code'); return }
    router.push(`/game/${code}`)
  }

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
              <button onClick={() => setMode('test')} className={BTN_GHOST}>Solo Test Mode</button>
            </div>
          )}

          {mode === 'create' && (
            <div className="bg-[#152030] rounded-2xl p-5 space-y-3 border border-slate-700/50">
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
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button onClick={handleCreate} disabled={loading} className={BTN_PRIMARY}>
                {loading ? 'Creating…' : 'Create & Get Link'}
              </button>
              <button onClick={() => { setMode('home'); setError('') }} className={BTN_BACK}>← Back</button>
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

          {mode === 'test' && (
            <div className="bg-[#152030] rounded-2xl p-5 space-y-3 border border-slate-700/50">
              <h2 className="text-white font-bold text-lg">Solo Test Mode</h2>
              <p className="text-slate-400 text-sm">Play against 3 bots that draw and discard automatically.</p>
              <input
                type="text"
                placeholder="Your nickname"
                value={nickname}
                onChange={e => { setNickname(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleTestMode()}
                maxLength={20}
                autoFocus
                className={INPUT}
              />
              {error && <p className="text-amber-400 text-sm">{error}</p>}
              <button onClick={handleTestMode} disabled={loading} className={BTN_SECONDARY}>
                {loading ? 'Starting…' : 'Start Solo Game'}
              </button>
              <button onClick={() => { setMode('home'); setError('') }} className={BTN_BACK}>← Back</button>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
