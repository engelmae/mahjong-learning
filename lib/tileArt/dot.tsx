import { VW, Num } from './shell'

function Mountain() {
  const back = 'M -1,70 L -1,60 L 6,56 L 12,52 L 18,55 L 24,50 L 30,54 L 36,50 L 42,54 L 47,51 L 53,56 L 53,70 Z'
  const front = 'M -1,70 L -1,63 L 5,60 L 10,56 L 15,58 L 20,54 L 26,57 L 32,53 L 38,56 L 44,53 L 49,57 L 53,60 L 53,70 Z'
  return (
    <g>
      <path d={back} fill="#1e3a6a" />
      <path d={front} fill="#122848" />
      <path d="M 11,52 Q 12,50 13,52" fill="none" stroke="#faf9f7" strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
      <path d="M 23,50 Q 24,48 25,50" fill="none" stroke="#faf9f7" strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
      <path d="M 35,50 Q 36,48 37,50" fill="none" stroke="#faf9f7" strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
      <path d="M 46,51 Q 47,49 48,51" fill="none" stroke="#faf9f7" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
    </g>
  )
}

function Star({ cx, cy, r, seed }: { cx: number; cy: number; r: number; seed: number }) {
  const halos = [
    { rx: r*2.0, ry: r*0.50, rot: seed*41, color: '#1a3878', sw: 1.4, op: 0.65 },
    { rx: r*1.65, ry: r*0.45, rot: seed*41 + 58, color: '#2a52a0', sw: 1.2, op: 0.55 },
    { rx: r*1.35, ry: r*0.55, rot: seed*41 + 112, color: '#1a3060', sw: 1.0, op: 0.60 },
    { rx: r*1.1, ry: r*0.50, rot: seed*41 + 162, color: '#3468c8', sw: 0.9, op: 0.50 },
  ]
  const strokes = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + seed * 0.55
    const d1 = r * 1.15, d2 = r * 1.9
    return {
      x1: cx + Math.cos(a) * d1, y1: cy + Math.sin(a) * d1,
      x2: cx + Math.cos(a + 0.45) * d2, y2: cy + Math.sin(a + 0.45) * d2,
      col: i % 3 === 0 ? '#f8d040' : '#1a3878',
    }
  })
  return (
    <g>
      {halos.map((h, i) => (
        <ellipse key={i} cx={cx} cy={cy} rx={h.rx} ry={h.ry} fill="none" stroke={h.color} strokeWidth={h.sw} opacity={h.op} transform={`rotate(${h.rot} ${cx} ${cy})`} />
      ))}
      {strokes.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.col} strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.65} fill="#1a3060" opacity={0.9} />
      <circle cx={cx} cy={cy} r={r * 0.28} fill="#f8d040" />
      <circle cx={cx - r*0.18} cy={cy - r*0.22} r={r * 0.22} fill="#faf9f7" opacity={0.95} />
    </g>
  )
}

const STARS = [
  { cx:26, cy:30, r:8, seed:0 },
  { cx:11, cy:21, r:7, seed:1 },
  { cx:33, cy:27, r:7, seed:9 },
  { cx:36, cy:37, r:6.5, seed:3 },
  { cx:7,  cy:36, r:6, seed:4 },
  { cx:12, cy:25, r:5.5, seed:5 },
  { cx:43, cy:33, r:5.5, seed:6 },
  { cx:14, cy:42, r:5, seed:7 },
  { cx:32, cy:43, r:5, seed:8 },
]

export function DotSVG({ n }: { n: number }) {
  return (
    <>
      {STARS.slice(0, n).map((s, i) => <Star key={i} {...s} />)}
      <Mountain />
      <text x={VW-4} y={15} fontFamily="'Ultra', serif" fontWeight={700} fontSize={15} fill="white" textAnchor="end" stroke="white" strokeWidth={3} strokeLinejoin="round" opacity={0.85}>{n}</text>
      <text x={VW-4} y={15} fontFamily="'Ultra', serif" fontWeight={700} fontSize={15} fill="#2050c0" textAnchor="end">{n}</text>
    </>
  )
}
