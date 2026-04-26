'use client'
import { useState, useEffect, useMemo } from 'react'
import { Tile, GameState } from '@/types/game'
import TileComponent from './Tile'
import { submitCharlestionPass } from '@/lib/gameActions'
import { VERSION } from '@/lib/version'
import { useTileDrag } from '@/lib/useTileDrag'

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

  const me = game.players[myPlayerId]
  const alreadySubmitted = me?.charlestionReady
  const roundIndex = game.charlestionRound
  const currentPass = PASS_SEQUENCE[roundIndex] ?? PASS_SEQUENCE[0]
  const playersReady = Object.values(game.players).filter(p => p.charlestionReady).length
  const totalPlayers = Object.keys(game.players).length
  const hand = me?.hand ?? []

  const drag = useTileDrag(handOrder, setHandOrder)

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

  // Clear selection when round advances
  useEffect(() => {
    setSelected(new Set())
  }, [roundIndex])

  function sortHand() {
    setHandOrder([...hand].sort(tileSort).map(t => t.id))
  }

  function handleTileClick(tile: Tile) {
    if (drag.consumeClick()) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(tile.id)) {
        next.delete(tile.id)
      } else if (next.size < 3) {
        next.add(tile.id)
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

  const displayHand = useMemo(
    () => drag.displayIds.map(id => hand.find(t => t.id === id)).filter(Boolean) as Tile[],
    [drag.displayIds, hand]
  )

  return (
    <div className="flex flex-col h-full bg-[#152030] text-white p-3 gap-2">
      {/* Header */}
      <div className="flex items-start justify-between">
        <button onClick={sortHand} className="text-xs text-emerald-400 border border-emerald-600 rounded px-2 py-1 shrink-0 font-medium">
          Sort
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-lg font-bold">Charleston — Pass {roundIndex + 1}/6</h2>
          <p className="text-emerald-300 text-sm">{currentPass.label}</p>
          <p className="text-xs text-emerald-400">{playersReady}/{totalPlayers} players ready</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button onClick={onLeave} className="text-xs text-emerald-500 hover:text-red-400 px-1">Leave</button>
          <span className="text-xs text-emerald-800">{VERSION}</span>
        </div>
      </div>

      {alreadySubmitted ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-emerald-300">Tiles passed! Waiting for others…</p>
            <p className="text-xs text-emerald-500 mt-1">{playersReady}/{totalPlayers} ready</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-emerald-300 text-center">
            {drag.dragging ? 'Slide to position, release to drop' : `Tap 3 tiles to pass — or long-press to rearrange`}
          </p>

          {/* Hand */}
          <div className="flex-1 flex items-end justify-center overflow-hidden">
            <div
              ref={drag.containerRef}
              className="flex flex-wrap gap-1 justify-center"
              style={{ touchAction: drag.dragging ? 'none' : 'auto' }}
              onPointerMove={drag.onMove}
              onPointerUp={drag.onUp}
              onPointerCancel={drag.onCancel}
            >
              {displayHand.map(tile => (
                <div
                  key={tile.id}
                  data-drag-id={tile.id}
                  onPointerDown={e => drag.onTileDown(e, tile.id)}
                  style={drag.tileStyle(tile.id)}
                >
                  <TileComponent
                    tile={tile}
                    selected={!drag.dragging && selected.has(tile.id)}
                    onClick={() => handleTileClick(tile)}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={selected.size !== 3 || submitting || drag.dragging}
            className={[
              'py-3 rounded-lg font-bold text-lg transition-all',
              selected.size === 3 && !drag.dragging
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
