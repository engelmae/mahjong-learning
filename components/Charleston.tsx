'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [receivedTileIds, setReceivedTileIds] = useState<Set<string>>(new Set())
  const prevHandRef = useRef<string[]>([])

  const me = game.players[myPlayerId]
  const alreadySubmitted = me?.charlestionReady
  const roundIndex = game.charlestionRound
  const currentPass = PASS_SEQUENCE[roundIndex] ?? PASS_SEQUENCE[0]
  const playersReady = Object.values(game.players).filter(p => p.charlestionReady).length
  const totalPlayers = Object.keys(game.players).length
  const hand = me?.hand ?? []

  const drag = useTileDrag(handOrder, setHandOrder)

  // Sync hand order and detect received tiles (batch of 3 appear after a pass)
  useEffect(() => {
    const currentIds = hand.map(t => t.id)
    const currentIdSet = new Set(currentIds)
    const prev = prevHandRef.current
    setHandOrder(prevOrder => {
      const retained = prevOrder.filter(id => currentIdSet.has(id))
      const newIds = currentIds.filter(id => !new Set(retained).has(id))
      return [...retained, ...newIds]
    })
    // Mark newly received tiles (3 arrive at once after a round completes)
    if (currentIds.length >= prev.length && prev.length > 0) {
      const prevSet = new Set(prev)
      const newIds = currentIds.filter(id => !prevSet.has(id))
      if (newIds.length > 0) setReceivedTileIds(new Set(newIds))
    }
    prevHandRef.current = currentIds
  }, [hand.map(t => t.id).join(',')])

  // Clear selection and received highlights when round advances
  useEffect(() => {
    setSelected(new Set())
    setReceivedTileIds(new Set())
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
    <div className="flex flex-col h-full bg-[#152030] text-white p-3 gap-2" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      {/* Header: title/info centered */}
      <div className="text-center">
        <h2 className="text-base font-bold">Charleston — Pass {roundIndex + 1}/6</h2>
        <p className="text-emerald-300 text-sm">{currentPass.label}</p>
        <p className="text-xs text-emerald-500">{playersReady}/{totalPlayers} ready · <span className="text-slate-700">{VERSION}</span></p>
      </div>

      {/* Body */}
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

          {/* Hand with Sort just above it */}
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex justify-end mb-1 pr-1">
              <button onClick={sortHand} className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2 active:scale-95 transition-all">Sort</button>
            </div>
            <div className="flex justify-center">
              <div
                ref={drag.containerRef}
                className="flex flex-wrap gap-1 justify-center pt-3 pb-1"
                style={{ touchAction: drag.dragging ? 'none' : 'auto' }}
                onPointerMove={drag.onMove}
                onPointerUp={drag.onUp}
                onPointerCancel={drag.onCancel}
              >
                {displayHand.map(tile => {
                  const isReceived = receivedTileIds.has(tile.id) && !selected.has(tile.id)
                  return (
                    <div
                      key={tile.id}
                      data-drag-id={tile.id}
                      onPointerDown={e => drag.onTileDown(e, tile.id)}
                      style={drag.tileStyle(tile.id)}
                    >
                      <div
                        className={isReceived ? 'tile-pop' : undefined}
                        style={{
                          outline: isReceived ? '2px solid #34d399' : undefined,
                          outlineOffset: '2px',
                          borderRadius: 8,
                          position: 'relative',
                        }}
                      >
                        <TileComponent
                          tile={tile}
                          selected={!drag.dragging && selected.has(tile.id)}
                          onClick={() => handleTileClick(tile)}
                        />
                        {isReceived && (
                          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
                            <div className="tile-shimmer-streak" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer: Pass button (when active) + Sort/Exit always bottom-right */}
      <div className="flex items-end gap-1.5">
        {alreadySubmitted ? (
          <div className="flex-1" />
        ) : (
          <button
            onClick={handleSubmit}
            disabled={selected.size !== 3 || submitting || drag.dragging}
            className={[
              'flex-1 py-3 rounded-lg font-bold text-lg transition-all',
              selected.size === 3 && !drag.dragging
                ? 'bg-[#5aabff] hover:bg-[#7bbeff] text-black active:scale-95'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {submitting ? 'Passing…' : `Pass ${selected.size}/3 tiles`}
          </button>
        )}
        <button onClick={onLeave} className="shrink-0 bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-2 active:scale-95 transition-all" style={{ minWidth: 52 }}>Exit</button>
      </div>
    </div>
  )
}
