'use client'
import { useState } from 'react'
import { Tile, GameState } from '@/types/game'
import TileComponent from './Tile'
import { submitCharlestionPass } from '@/lib/gameActions'

// 6 passes: 1st Right, 1st Across, 1st Left, 2nd Left, 2nd Across, 2nd Right
const PASS_SEQUENCE = [
  { label: '→ First Right',  dir: 'right'  },
  { label: '↕ First Across', dir: 'across' },
  { label: '← First Left',   dir: 'left'   },
  { label: '← Second Left',  dir: 'left'   },
  { label: '↕ Second Across',dir: 'across' },
  { label: '→ Second Right', dir: 'right'  },
]

interface Props {
  game: GameState
  gameId: string
  myPlayerId: string
  onLeave: () => void
}

export default function Charleston({ game, gameId, myPlayerId, onLeave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const me = game.players[myPlayerId]
  const alreadySubmitted = me?.charlestionReady
  const roundIndex = game.charlestionRound
  const currentPass = PASS_SEQUENCE[roundIndex] ?? PASS_SEQUENCE[0]
  const playersReady = Object.values(game.players).filter(p => p.charlestionReady).length
  const totalPlayers = Object.keys(game.players).length

  const hand = me?.hand ?? []

  function toggleTile(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 3) {
        next.add(id)
      }
      return next
    })
  }

  async function handleSubmit() {
    const tiles = hand.filter(t => selected.has(t.id))
    setSubmitting(true)
    try {
      await submitCharlestionPass(gameId, myPlayerId, tiles)
    } finally {
      setSubmitting(false)
      setSelected(new Set())
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#152030] text-white p-3 gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 text-center">
          <h2 className="text-lg font-bold">Charleston — Pass {roundIndex + 1}/6</h2>
          <p className="text-emerald-300 text-sm">{currentPass.label}</p>
          <p className="text-xs text-emerald-400">
            {playersReady}/{totalPlayers} players ready
          </p>
        </div>
        <button onClick={onLeave} className="text-xs text-emerald-500 hover:text-red-400 shrink-0 px-1">
          Leave
        </button>
      </div>

      {alreadySubmitted ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-300">Tiles passed! Waiting for others…</p>
            <p className="text-xs text-emerald-500 mt-1">
              {playersReady}/{totalPlayers} ready
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-emerald-300 text-center">
            Tap 3 tiles to pass {currentPass.label.toLowerCase()}
          </p>

          {/* Hand */}
          <div className="flex-1 flex items-end justify-center">
            <div className="flex flex-wrap gap-1 justify-center">
              {hand.map(tile => (
                <TileComponent
                  key={tile.id}
                  tile={tile}
                  selected={selected.has(tile.id)}
                  onClick={() => toggleTile(tile.id)}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={selected.size !== 3 || submitting}
            className={[
              'py-3 rounded-lg font-bold text-lg transition-all',
              selected.size === 3
                ? 'bg-yellow-400 text-black hover:bg-yellow-300 active:scale-95'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {submitting ? 'Passing…' : `Pass ${selected.size}/3 tiles`}
          </button>
        </>
      )}
    </div>
  )
}
