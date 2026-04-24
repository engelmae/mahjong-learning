'use client'
import { Tile as TileType } from '@/types/game'
import { tileColor } from '@/lib/tiles'

interface Props {
  tile: TileType
  selected?: boolean
  faceDown?: boolean
  small?: boolean
  onClick?: () => void
  disabled?: boolean
}

export default function Tile({ tile, selected, faceDown, small, onClick, disabled }: Props) {
  const base = small
    ? 'w-8 h-10 text-xs'
    : 'w-12 h-16 text-sm'

  if (faceDown) {
    return (
      <div className={`${base} rounded border-2 bg-slate-700 border-slate-500 flex items-center justify-center shrink-0`}>
        <span className="text-slate-400 text-lg">🀫</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={[
        base,
        'rounded border-2 flex flex-col items-center justify-center shrink-0 font-bold transition-all',
        tileColor(tile),
        selected ? 'ring-2 ring-yellow-400 -translate-y-2 shadow-lg' : '',
        onClick && !disabled ? 'cursor-pointer hover:shadow-md active:scale-95' : 'cursor-default',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      <span className="leading-tight">{tile.label}</span>
    </button>
  )
}
