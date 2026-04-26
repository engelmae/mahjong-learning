'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { createGame, createTestGame } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'

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
    <main className="min-h-screen bg-[#0f1923] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-2">🀄</div>
          <h1 className="text-3xl font-bold text-white">American Mahjong</h1>
          <p className="text-emerald-400 text-sm mt-1">Play with friends, anywhere</p>
          <p className="text-emerald-800 text-xs mt-1">{VERSION}</p>
        </div>

        {mode === 'home' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-yellow-400 text-black font-bold py-4 rounded-xl text-lg hover:bg-yellow-300 active:scale-95 transition-all"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl text-lg hover:bg-emerald-600 active:scale-95 transition-all"
            >
              Join Game
            </button>
            <button
              onClick={() => setMode('test')}
              className="w-full bg-[#152030] text-emerald-400 font-bold py-4 rounded-xl text-lg hover:bg-[#1c2e42] active:scale-95 transition-all border border-emerald-700"
            >
              Solo Test Mode
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-[#152030] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Create a Game</h2>
            <input
              type="text"
              placeholder="Your nickname"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              maxLength={20}
              className="w-full bg-emerald-800 text-white rounded-lg px-4 py-3 placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create & Get Link'}
            </button>
            <button onClick={() => setMode('home')} className="w-full text-emerald-400 text-sm hover:text-emerald-300">
              ← Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-[#152030] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Join a Game</h2>
            <input
              type="text"
              placeholder="Game code (e.g. AB12CD)"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              className="w-full bg-emerald-800 text-white rounded-lg px-4 py-3 placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase tracking-widest"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full bg-yellow-400 text-black font-bold py-3 rounded-lg hover:bg-yellow-300 active:scale-95 transition-all"
            >
              Join Game
            </button>
            <button onClick={() => setMode('home')} className="w-full text-emerald-400 text-sm hover:text-emerald-300">
              ← Back
            </button>
          </div>
        )}

        {mode === 'test' && (
          <div className="bg-[#152030] rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Solo Test Mode</h2>
            <p className="text-emerald-400 text-sm">Play against 3 bots. They draw and discard automatically.</p>
            <input
              type="text"
              placeholder="Your nickname"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleTestMode()}
              maxLength={20}
              autoFocus
              className="w-full bg-emerald-800 text-white rounded-lg px-4 py-3 placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleTestMode}
              disabled={loading}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Start Solo Game'}
            </button>
            <button onClick={() => { setMode('home'); setError('') }} className="w-full text-emerald-400 text-sm hover:text-emerald-300">
              ← Back
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
