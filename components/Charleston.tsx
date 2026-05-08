'use client'
import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { Tile, GameState } from '@/types/game'
import TileComponent from './Tile'
import { submitCharlestionPass } from '@/lib/gameActions'
import { useTileDrag } from '@/lib/useTileDrag'

const PASS_SEQUENCE = [
  { dir: 'right'  },
  { dir: 'across' },
  { dir: 'left'   },
  { dir: 'left'   },
  { dir: 'across' },
  { dir: 'right'  },
]

const DIR_LABEL: Record<string, string> = { right: 'Pass Right', across: 'Pass Across', left: 'Pass Left' }
const DIR_SYMBOL: Record<string, string> = { right: '→', across: '↕', left: '←' }

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

const HAND_ORDER_KEY = (gameId: string, playerId: string) => `mahjong_handOrder_${gameId}_${playerId}`

export default function Charleston({ game, gameId, myPlayerId, onLeave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [handOrder, setHandOrder] = useState<string[]>([])
  const [receivedTileIds, setReceivedTileIds] = useState<Set<string>>(new Set())
  const prevHandRef = useRef<string[]>([])
  const prevRoundRef = useRef(-1)

  const me = game.players[myPlayerId]
  const alreadySubmitted = me?.charlestionReady
  const roundIndex = game.charlestionRound
  const currentPass = PASS_SEQUENCE[roundIndex] ?? PASS_SEQUENCE[0]
  const playersReady = Object.values(game.players).filter(p => p.charlestionReady).length
  const totalPlayers = Object.keys(game.players).length
  const hand = me?.hand ?? []

  const sortedPlayerIds = Object.keys(game.players).sort(
    (a, b) => game.players[a].seatIndex - game.players[b].seatIndex
  )
  const myIdx = sortedPlayerIds.indexOf(myPlayerId)
  const n = sortedPlayerIds.length
  const recipientOffset = currentPass.dir === 'right' ? 1 : currentPass.dir === 'across' ? 2 : n - 1
  const recipientId = sortedPlayerIds[(myIdx + recipientOffset) % n]
  const recipientName = game.players[recipientId]?.nickname ?? '…'

  const drag = useTileDrag(handOrder, setHandOrder)

  useEffect(() => {
    const currentIds = hand.map(t => t.id)
    const currentIdSet = new Set(currentIds)
    const prev = prevHandRef.current
    const roundChanged = prevRoundRef.current !== roundIndex
    const isInitialMount = prev.length === 0 && currentIds.length > 0

    setHandOrder(prevOrder => {
      let seed = prevOrder
      // First mount: seed from localStorage if the user has a saved order from
      // the lobby/previous session for this game (preserves intent across reloads).
      if (isInitialMount && prevOrder.length === 0 && typeof window !== 'undefined') {
        try {
          const saved = window.localStorage.getItem(HAND_ORDER_KEY(gameId, myPlayerId))
          if (saved) seed = JSON.parse(saved) as string[]
        } catch {}
      }
      const seedSet = new Set(seed)
      const retained = seed.filter(id => currentIdSet.has(id))
      const retainedSet = new Set(retained)
      const newIds = currentIds.filter(id => !retainedSet.has(id) && !seedSet.has(id))
      // Tiles that were in seed but missing from prevOrder (rare): also include any current
      // ids not yet in retained
      const tail = currentIds.filter(id => !retainedSet.has(id) && !newIds.includes(id))
      return [...retained, ...newIds, ...tail]
    })

    if (roundChanged) {
      prevRoundRef.current = roundIndex
      setSelected(new Set())
      if (prev.length > 0) {
        const prevSet = new Set(prev)
        const newIds = currentIds.filter(id => !prevSet.has(id))
        setReceivedTileIds(new Set(newIds))
      }
    }

    prevHandRef.current = currentIds
  }, [hand.map(t => t.id).join(','), roundIndex, gameId, myPlayerId])

  // Persist hand order so GameBoard can restore it when the game starts.
  useEffect(() => {
    if (handOrder.length === 0) return
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(HAND_ORDER_KEY(gameId, myPlayerId), JSON.stringify(handOrder))
    } catch {}
  }, [handOrder, gameId, myPlayerId])

  function sortHand() {
    setHandOrder([...hand].sort(tileSort).map(t => t.id))
  }

  function handleTileClick(tile: Tile) {
    if (drag.consumeClick()) return
    if (alreadySubmitted) return
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

  const passReady = selected.size === 3 && !drag.dragging && !alreadySubmitted && !submitting

  return (
    <div className="flex flex-col h-full bg-[#152030] text-white px-3 pt-3 pb-2 gap-2"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>

      {/* Row 1: Exit (left), direction label (center), Pass button (right).
          Below: small ready-count line so all players can see progress. */}
      <div className="flex items-center gap-2">
        <div className="w-20 shrink-0">
          <button onClick={onLeave}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-4 py-2 active:scale-95 transition-all">
            Exit
          </button>
        </div>
        <p className="flex-1 text-center text-base font-bold">
          {DIR_LABEL[currentPass.dir]}
          <span className="text-slate-400 font-normal text-sm"> → {recipientName}</span>
        </p>
        <div className="w-20 shrink-0 flex justify-end">
          {alreadySubmitted ? (
            <span className="text-emerald-400 text-sm font-semibold px-1">
              ✓ {playersReady}/{totalPlayers}
            </span>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!passReady}
              className={[
                'py-1.5 px-3 rounded-lg font-bold text-sm transition-all active:scale-95',
                passReady
                  ? 'bg-[#5aabff] text-black'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              Pass {selected.size}/3
            </button>
          )}
        </div>
      </div>
      {!alreadySubmitted && (
        <p className="text-center text-[11px] text-slate-400 -mt-1">
          Tap a tile to select · long-press to drag-reorder · {playersReady}/{totalPlayers} ready
        </p>
      )}

      {/* Row 2: 6-stage pass tracker */}
      <div className="flex items-center justify-center gap-1.5">
        {PASS_SEQUENCE.map((stage, i) => {
          const isPast = i < roundIndex
          const isCurrent = i === roundIndex
          const isFarFuture = i >= 3 && roundIndex < 3
          return (
            <Fragment key={i}>
              {i === 3 && <div className="w-px h-5 bg-slate-600 mx-0.5 self-stretch" />}
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200',
                isCurrent
                  ? 'bg-[#5aabff] text-black scale-110 shadow-[0_0_8px_rgba(90,171,255,0.5)]'
                  : isPast
                    ? 'bg-emerald-800 text-emerald-400'
                    : isFarFuture
                      ? 'bg-slate-800 text-slate-700'
                      : 'bg-slate-700 text-slate-400',
              ].join(' ')}>
                {isPast ? '✓' : DIR_SYMBOL[stage.dir]}
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Tiles + Sort */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="flex justify-end mb-1 pr-1">
          <button onClick={sortHand}
            className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold rounded-lg px-3 py-1.5 active:scale-95 transition-all">
            Sort
          </button>
        </div>
        <div className="flex justify-center w-full overflow-x-auto">
          <div
            ref={drag.containerRef}
            className={`flex flex-nowrap gap-1 justify-center pt-3 pb-1 transition-opacity duration-500 ${alreadySubmitted ? 'opacity-40' : 'opacity-100'}`}
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
                    style={{ borderRadius: 8, position: 'relative' }}
                  >
                    <TileComponent
                      tile={tile}
                      medium
                      selected={!drag.dragging && !alreadySubmitted && selected.has(tile.id)}
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
    </div>
  )
}
