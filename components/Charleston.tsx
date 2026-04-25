'use client'
import { useState, useEffect } from 'react'
import { Tile, GameState } from '@/types/game'
import TileComponent from './Tile'
import { submitCharlestionPass } from '@/lib/gameActions'

const PASS_SEQUENCE = [
  { label: '→ First Right',  dir: 'right'  },
  { label: '↕ First Across', dir: 'across' },
  { label: '← First Left',   dir: 'left'   },
  { label: '← Second Left',  dir: 'left'   },
  { label: '↕ Second Across',dir: 'across' },
  { label: '→ Second Right', dir: 'right'  },
]

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

export default function Charleston({ game, gameId, myPlayerId, onLeave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [handOrder, setHandOrder] = useState<string[]>([])
  const [movingTile, setMovingTile] = useState<string | null>(null)

  const me = game.players[myPlayerId]
  const alreadySubmitted = me?.charlestionReady
  const roundIndex = game.charlestionRound
  const currentPass = PASS_SEQUENCE[roundIndex] ?? PASS_SEQUENCE[0]
  const playersReady = Object.values(game.players).filter(p => p.charlestionReady).length
  const totalPlayers = Object.keys(game.players).length
  const hand = me?.hand ?? []

  // Sync hand order
  useEffect(() => {
    const currentIds = hand.map(t => t.id)
    const currentIdSet = new Set(currentIds)
    setHandOrder(prev => {
      const retained = prev.filter(id => currentIdSet.has(id))
      const newIds = currentIds.filter(id => !new Set(retained).has(id))
      return [...retained, ...newIds]
    })
  }, [hand.map(t => t.id).join(',')])

  // Clear selection and moving when round advances
  useEffect(() => {
    setSelected(new Set())
    setMovingTile(null)
  }, [roundIndex])

  function sortHand() {
    const sorted = [...hand].sort(tileSort)
    setHandOrder(sorted.map(t => t.id))
    setMovingTile(null)
  }

  function handleTileClick(tile: Tile) {
    if (movingTile !== null) {
      if (movingTile === tile.id) {
        setMovingTile(null)
      } else {
        setHandOrder(prev => {
          const next = [...prev]
          const ai = next.indexOf(movingTile)
          const bi = next.indexOf(tile.id)
          if (ai !== -1 && bi !== -1) [next[ai], next[bi]] = [next[bi], next[ai]]
          return next
        })
        setMovingTile(null)
      }
    } else {
      toggleTile(tile.id)
    }
  }

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

  const orderedHand = handOrder.map(id => hand.find(t => t.id === id)).filter(Boolean) as Tile[]

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
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm text-emerald-300">
              {movingTile ? 'Tap another tile to swap' : `Tap 3 tiles to pass ${currentPass.label.toLowerCase()}`}
            </p>
            <button
              onClick={sortHand}
              className="text-xs text-emerald-400 hover:text-emerald-200 border border-emerald-700 hover:border-emerald-500 rounded px-2 py-0.5 shrink-0"
            >
              Sort
            </button>
          </div>

          {/* Hand */}
          <div className="flex-1 flex items-end justify-center">
            <div className="flex flex-wrap gap-1 justify-center">
              {orderedHand.map(tile => (
                <TileComponent
                  key={tile.id}
                  tile={tile}
                  selected={movingTile === tile.id ? true : selected.has(tile.id)}
                  onClick={() => handleTileClick(tile)}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={selected.size !== 3 || submitting || movingTile !== null}
            className={[
              'py-3 rounded-lg font-bold text-lg transition-all',
              selected.size === 3 && !movingTile
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
