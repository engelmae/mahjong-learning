import { VW, VH } from './shell'

const DRAGONS: Record<string, { glyph: string; color: string; opacity: number }> = {
  Red:   { glyph: '中', color: '#c02050', opacity: 1 },
  Green: { glyph: '發', color: '#107870', opacity: 1 },
  Soap:  { glyph: '白', color: '#000000', opacity: 0.12 },
}

export function DragonSVG({ value }: { value: string }) {
  const d = DRAGONS[value] ?? DRAGONS.Red
  return (
    <text x={VW/2} y={VH/2 + 12} textAnchor="middle"
      fontFamily="'Noto Serif SC', serif" fontWeight={700}
      fontSize={36} fill={d.color} opacity={d.opacity}>{d.glyph}</text>
  )
}

export function FlowerSVG() {
  // Van Gogh-style poppy
  const cx = VW/2, cy = VH/2
  return (
    <g>
      {/* outer petals — irregular brushy ovals */}
      <path d={`M ${cx},${cy-18} Q ${cx-8},${cy-12} ${cx-6},${cy-2} Q ${cx-2},${cy-8} ${cx},${cy-18} Z`} fill="#e02020" />
      <path d={`M ${cx-15},${cy-5} Q ${cx-12},${cy+4} ${cx-3},${cy+4} Q ${cx-10},${cy} ${cx-15},${cy-5} Z`} fill="#c01818" />
      <path d={`M ${cx},${cy+18} Q ${cx-7},${cy+12} ${cx-2},${cy+4} Q ${cx},${cy+12} ${cx},${cy+18} Z`} fill="#d01818" />
      <path d={`M ${cx+15},${cy-5} Q ${cx+12},${cy+4} ${cx+3},${cy+4} Q ${cx+10},${cy} ${cx+15},${cy-5} Z`} fill="#c01818" />
      <path d={`M ${cx},${cy-18} Q ${cx+8},${cy-12} ${cx+6},${cy-2} Q ${cx+2},${cy-8} ${cx},${cy-18} Z`} fill="#e83030" />
      {/* center — dark seed */}
      <circle cx={cx} cy={cy} r={4} fill="#1a0808" />
      <circle cx={cx-1} cy={cy-1} r={1.5} fill="#f8d040" opacity={0.7} />
      {/* directional brushstrokes */}
      <line x1={cx-9} y1={cy-9} x2={cx-3} y2={cy-3} stroke="#000" strokeWidth={0.5} opacity={0.4} />
      <line x1={cx+9} y1={cy-9} x2={cx+3} y2={cy-3} stroke="#000" strokeWidth={0.5} opacity={0.4} />
    </g>
  )
}
