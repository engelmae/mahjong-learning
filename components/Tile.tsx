'use client'
import { Tile as TileType } from '@/types/game'
import { TileShell, FaceDown, VW, VH } from '@/lib/tileArt/shell'
import { BamSVG } from '@/lib/tileArt/bam'
import { CrakSVG } from '@/lib/tileArt/crak'
import { DotSVG } from '@/lib/tileArt/dot'
import { WindSVG } from '@/lib/tileArt/wind'
import { JokerSVG } from '@/lib/tileArt/joker'
import { DragonSVG, FlowerSVG } from '@/lib/tileArt/dragonFlower'

interface Props {
  tile: TileType
  selected?: boolean
  faceDown?: boolean
  small?: boolean
  medium?: boolean
  onClick?: () => void
  disabled?: boolean
}

export default function Tile({ tile, selected, faceDown, small, medium, onClick, disabled }: Props) {
  const w = small ? 40 : medium ? 44 : 52
  const h = small ? 54 : medium ? 59 : 70

  if (faceDown) {
    if (onClick) return <button onClick={onClick}><FaceDown w={w} h={h} /></button>
    return <FaceDown w={w} h={h} />
  }

  function renderSVG() {
    switch (tile.suit) {
      case 'bam':    return <BamSVG n={Number(tile.value)} />
      case 'crak':   return <CrakSVG n={Number(tile.value)} />
      case 'dot':    return <DotSVG n={Number(tile.value)} />
      case 'wind':   return <WindSVG value={String(tile.value)} />
      case 'dragon': return <DragonSVG value={String(tile.value)} />
      case 'flower': return <FlowerSVG />
      case 'joker':  return <JokerSVG />
      default:       return null
    }
  }

  const transform = selected ? 'translateY(-6px)' : undefined
  const outline = selected ? '2px solid #5aabff' : undefined
  const outlineOffset = selected ? '2px' : undefined

  const inner = (
    <div style={{ transform, outline, outlineOffset, transition: 'transform 80ms ease-out', borderRadius: 8 }}>
      <TileShell w={w} h={h}>
        <svg viewBox={`0 0 ${VW} ${VH}`} width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
          {renderSVG()}
        </svg>
      </TileShell>
    </div>
  )

  if (!onClick) return inner
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      {inner}
    </button>
  )
}
