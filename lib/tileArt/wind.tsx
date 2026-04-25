import { VW } from './shell'

function Sun({ id }: { id: string }) {
  const cx = 14, cy = 25, r = 7
  const cid = `sc-${id}`
  return (
    <g>
      <defs>
        <clipPath id={cid}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="#e84070" />
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 1.35} fill="#f06820" clipPath={`url(#${cid})`} />
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 0.7} fill="#f8c820" clipPath={`url(#${cid})`} />
      <path d={`M ${cx - r * 0.7},${cy - r * 0.75} Q ${cx},${cy - r * 1.05} ${cx + r * 0.7},${cy - r * 0.75}`}
        fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
}

function MountainWind() {
  const backR = 'M -1,50 L 5,42 L 11,34 L 17,40 L 23,32 L 29,38 L 35,30 L 41,36 L 47,32 L 53,38'
  const frontR = 'M -1,56 L 5,50 L 10,42 L 16,50 L 22,44 L 28,50 L 34,44 L 40,50 L 46,44 L 53,50'
  return (
    <g>
      <path d={`${backR} L 53,70 L -1,70 Z`} fill="#1e3a6a" />
      <path d={backR} fill="none" stroke="#faf9f7" strokeWidth={1.0} strokeLinecap="round" strokeLinejoin="round" opacity={0.72} />
      <path d={`${frontR} L 53,70 L -1,70 Z`} fill="#0f2040" />
      <path d={frontR} fill="none" stroke="#faf9f7" strokeWidth={0.85} strokeLinecap="round" strokeLinejoin="round" opacity={0.62} />
    </g>
  )
}

const WORDS: Record<string, string> = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }

export function WindSVG({ value }: { value: string }) {
  const word = WORDS[value] ?? value
  return (
    <>
      <text x={VW/2} y={15} textAnchor="middle"
        fontFamily="'Ultra', serif" fontWeight={700}
        fontSize={11} fill="#2050c0">{word}</text>
      <Sun id={value} />
      <MountainWind />
    </>
  )
}
