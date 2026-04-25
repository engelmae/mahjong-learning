import { Tile as TileType } from '@/types/game'

export const VW = 52
export const VH = 70

export function TileShell({ children, w, h, scale = 1 }: { children: React.ReactNode; w: number; h: number; scale?: number }) {
  const s = scale
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: '#faf9f7',
      border: `${1.5*s}px solid #d0c8b8`,
      borderTopColor: '#ede8de', borderBottomColor: '#a09080',
      boxShadow: `0 ${3*s}px 0 #a09080, 0 ${5*s}px ${10*s}px rgba(0,0,0,0.4)`,
      position: 'relative', flexShrink: 0, overflow: 'hidden',
    }}>{children}</div>
  )
}

export function FaceDown({ w, h }: { w: number; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 8,
      background: 'linear-gradient(135deg,#1c3a5c,#152d48)',
      border: '1.5px solid #2a527a',
      boxShadow: '0 2px 0 #0a1a2c, 0 4px 8px rgba(0,0,0,0.4)',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{position:'absolute',inset:'15%',border:'1px solid rgba(255,255,255,0.08)',borderRadius:4}}/>
    </div>
  )
}

export function Num({ n, blue = '#2050c0' }: { n: number | string; blue?: string }) {
  return (
    <text x={VW - 4} y={16}
      fontFamily="'Ultra', serif" fontWeight={700}
      fontSize={16} fill={blue} textAnchor="end">{n}</text>
  )
}
