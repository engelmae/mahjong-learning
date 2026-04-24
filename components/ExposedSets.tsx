'use client'
import { ExposedSet as ExposedSetType, Tile } from '@/types/game'
import TileComponent from './Tile'

interface Props {
  sets: ExposedSetType[]
  ownerId: string
  myHand?: Tile[]
  onJokerSwap?: (setIndex: number, jokerIndex: number, jokerTile: Tile, replacementTile: Tile) => void
  small?: boolean
}

export default function ExposedSets({ sets, ownerId, myHand, onJokerSwap, small }: Props) {
  if (!sets || sets.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {sets.map((set, si) => (
        <div key={si} className="flex gap-1 bg-black/10 rounded p-1">
          {set.tiles.map((tile, ti) => {
            const canSwap =
              tile.isJoker &&
              myHand &&
              onJokerSwap &&
              myHand.some(
                handTile =>
                  !handTile.isJoker &&
                  handTile.suit === set.tiles.find(t => !t.isJoker)?.suit &&
                  handTile.value === set.tiles.find(t => !t.isJoker)?.value
              )

            const matchingHandTile =
              canSwap &&
              myHand?.find(
                handTile =>
                  !handTile.isJoker &&
                  handTile.suit === set.tiles.find(t => !t.isJoker)?.suit &&
                  handTile.value === set.tiles.find(t => !t.isJoker)?.value
              )

            return (
              <div key={tile.id} className="relative">
                <TileComponent tile={tile} small={small} />
                {canSwap && matchingHandTile && (
                  <button
                    onClick={() => onJokerSwap(si, ti, tile, matchingHandTile)}
                    className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold z-10 hover:bg-yellow-300"
                    title="Swap joker"
                  >
                    ⇄
                  </button>
                )}
              </div>
            )
          })}
          <span className="text-xs text-gray-500 self-end pb-1 ml-1 capitalize">{set.claimType}</span>
        </div>
      ))}
    </div>
  )
}
