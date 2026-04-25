import { Num } from './shell'

const C = '#22a878', O = '#0d7058', H = '#58d8a8'

function Flower({ cx, cy, type }: { cx: number; cy: number; type: 'pink' | 'yellow' }) {
  const p = type === 'pink' ? '#e04890' : '#f8c820'
  const c = type === 'pink' ? '#f8d020' : '#f87830'
  const py = cy - 5
  return (
    <g>
      <ellipse cx={cx} cy={py} rx={3} ry={4.5} fill={p} transform={`rotate(-30 ${cx} ${cy})`} />
      <ellipse cx={cx} cy={py} rx={3} ry={4.5} fill={p} transform={`rotate(30 ${cx} ${cy})`} />
      <ellipse cx={cx} cy={py} rx={3} ry={4.5} fill={p} />
      <circle cx={cx} cy={cy} r={2.4} fill={c} />
    </g>
  )
}

function Cactus({ paths, sw, hl }: { paths: string[]; sw: number; hl?: string[] }) {
  return (
    <g>
      {paths.map((d, i) => <path key={`s${i}`} d={d} fill="none" stroke={O} strokeWidth={sw + 2} strokeLinecap="round" strokeLinejoin="round" />)}
      {paths.map((d, i) => <path key={`m${i}`} d={d} fill="none" stroke={C} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
      {(hl || paths.slice(0, 1)).map((d, i) => <path key={`h${i}`} d={d} fill="none" stroke={H} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />)}
    </g>
  )
}

const CACTI: Record<number, { paths: string[]; tips: [number, number][]; sw: number; hl?: string[] }> = {
  2: { paths: ['M21,24 L21,55 Q21,63 29,63 L29,37'], tips: [[21,24],[29,37]], sw: 9, hl: ['M19.5,26 L19.5,52','M27.5,39 L27.5,57'] },
  3: { paths: ['M26,62 L26,22','M26,44 Q20,41 17,32','M26,50 Q32,47 34,38'], tips: [[26,22],[17,32],[34,38]], sw: 9, hl: ['M24.5,24 L24.5,50'] },
  4: { paths: ['M26,62 L26,20','M26,34 Q18,30 14,22','M26,48 Q19,44 15,37','M26,52 Q33,48 35,40'], tips: [[26,20],[14,22],[15,37],[35,40]], sw: 9, hl: ['M24.5,22 L24.5,50'] },
  5: { paths: ['M26,62 L26,18','M26,30 Q17,26 13,18','M26,46 Q18,42 13,34','M26,36 Q34,32 37,24','M26,52 Q34,48 37,40'], tips: [[26,18],[13,18],[13,34],[37,24],[37,40]], sw: 8, hl: ['M24.5,20 L24.5,50'] },
  6: { paths: ['M20,62 L20,20','M32,62 L32,24','M20,62 L32,62','M20,36 L12,26','M20,50 L12,40','M32,36 L40,26','M32,50 L40,40'], tips: [[20,20],[32,24],[12,26],[12,40],[40,26],[40,40]], sw: 8, hl: ['M18.5,22 L18.5,58','M30.5,26 L30.5,58'] },
  7: { paths: ['M26,62 L26,14','M16,62 L16,26','M36,62 L36,28','M16,62 L36,62','M16,40 L9,30','M36,40 L43,30','M16,52 L9,44'], tips: [[26,14],[16,26],[36,28],[9,30],[43,30],[9,44],[43,44]], sw: 7, hl: ['M24.5,16 L24.5,58'] },
  8: { paths: ['M26,62 L26,12','M15,62 L15,24','M37,62 L37,24','M15,62 L37,62','M15,38 L8,28','M37,38 L44,28','M15,52 L8,44','M37,52 L44,44','M26,28 L19,18','M26,28 L33,18'], tips: [[26,12],[8,28],[44,28],[8,44],[44,44],[19,18],[33,18],[15,24]], sw: 6, hl: ['M24.5,14 L24.5,58'] },
  9: { paths: ['M26,62 L26,18','M14,62 L14,30','M38,62 L38,30','M14,62 L38,62','M14,40 L7,32','M38,40 L45,32','M14,52 L7,44','M38,52 L45,44','M26,34 L18,24','M26,34 L34,24','M14,30 L9,22','M38,30 L43,22'], tips: [[26,18],[7,32],[45,32],[7,44],[45,44],[18,24],[34,24],[9,22],[43,22]], sw: 6, hl: ['M24.5,20 L24.5,58'] },
}

export function BamSVG({ n }: { n: number }) {
  if (n === 1) {
    return (
      <>
        <path d="M16,62 Q16,50 26,50 Q36,50 36,62" fill="none" stroke={O} strokeWidth={11} strokeLinecap="round" />
        <path d="M16,62 Q16,50 26,50 Q36,50 36,62" fill="none" stroke={C} strokeWidth={9} strokeLinecap="round" />
        <Flower cx={26} cy={49} type="pink" />
        <ellipse cx={28} cy={26} rx={6} ry={4} fill={C} transform="rotate(-20 28 26)" />
        <path d="M22,24 Q14,16 8,20 Q12,26 22,26" fill={C} stroke={O} strokeWidth={0.5} />
        <path d="M24,28 Q20,36 14,36 Q18,30 24,28" fill={C} opacity={0.7} />
        <circle cx={33} cy={23} r={4.5} fill={C} stroke={O} strokeWidth={0.5} />
        <path d="M36,21 L42,19 L36,23" fill={O} />
        <circle cx={35} cy={22} r={1.2} fill="white" />
        <circle cx={35.4} cy={21.8} r={0.6} fill="#1a2060" />
        <path d="M22,28 Q12,30 8,36 Q14,32 22,30" fill={C} stroke={O} strokeWidth={0.3} />
        <Num n={1} />
      </>
    )
  }
  const def = CACTI[n]
  if (!def) return <Num n={n} />
  const ft = ['pink','yellow','pink','yellow','pink','yellow','pink','yellow','pink'] as const
  return (
    <>
      <Cactus paths={def.paths} sw={def.sw} hl={def.hl} />
      {def.tips.map(([x, y], i) => <Flower key={i} cx={x} cy={y} type={ft[i]} />)}
      <Num n={n} />
    </>
  )
}
