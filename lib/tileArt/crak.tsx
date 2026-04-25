import { Num } from './shell'

const Y = '#f8c020', O = '#f06028', R = '#e02020', LOG = '#c82080'

function flameD(cx: number, base: number, w: number, h: number) {
  const tip = base - h
  return [
    `M ${cx - w},${base}`,
    `C ${cx - w*1.05},${base - h*0.22} ${cx - w*0.6},${base - h*0.62} ${cx - w*0.05},${tip + h*0.14}`,
    `Q ${cx},${tip} ${cx + w*0.12},${tip + h*0.12}`,
    `C ${cx + w*0.55},${base - h*0.58} ${cx + w*0.98},${base - h*0.28} ${cx + w},${base}`,
    'Z',
  ].join(' ')
}

const FIRES: Record<number, { w: number; h: number; color: string }[]> = {
  1: [{ w:7,h:15,color:R }],
  2: [{ w:13,h:13,color:O },{ w:6,h:21,color:R }],
  3: [{ w:8,h:15,color:Y },{ w:12,h:19,color:O },{ w:5,h:27,color:R }],
  4: [{ w:11,h:20,color:Y },{ w:8,h:14,color:Y },{ w:12,h:25,color:O },{ w:5,h:33,color:R }],
  5: [{ w:14,h:25,color:Y },{ w:10,h:18,color:Y },{ w:7,h:13,color:Y },{ w:12,h:31,color:O },{ w:5,h:39,color:R }],
  6: [{ w:17,h:31,color:Y },{ w:13,h:22,color:Y },{ w:9,h:15,color:Y },{ w:6,h:11,color:Y },{ w:12,h:36,color:O },{ w:5,h:44,color:R }],
  7: [{ w:19,h:35,color:Y },{ w:15,h:27,color:Y },{ w:11,h:20,color:Y },{ w:7,h:13,color:Y },{ w:5,h:7,color:Y },{ w:12,h:41,color:O },{ w:5,h:49,color:R }],
  8: [{ w:23,h:41,color:Y },{ w:18,h:31,color:Y },{ w:13,h:22,color:Y },{ w:8,h:15,color:Y },{ w:5,h:10,color:Y },{ w:5,h:6,color:Y },{ w:12,h:46,color:O },{ w:5,h:54,color:R }],
  9: [{ w:25,h:45,color:Y },{ w:19,h:35,color:Y },{ w:14,h:27,color:Y },{ w:10,h:18,color:Y },{ w:6,h:11,color:Y },{ w:5,h:7,color:Y },{ w:5,h:5,color:Y },{ w:12,h:52,color:O },{ w:5,h:60,color:R }],
}

export function CrakSVG({ n }: { n: number }) {
  const flames = FIRES[n] || FIRES[1]
  const cx = 26, base = 56
  return (
    <>
      {flames.map((f, i) => <path key={i} d={flameD(cx, base, f.w, f.h)} fill={f.color} />)}
      <path d={`M ${cx-14},${base+4} L ${cx+2},${base-2}`} stroke={LOG} strokeWidth={4.5} strokeLinecap="round" />
      <path d={`M ${cx+14},${base+4} L ${cx-2},${base-2}`} stroke={LOG} strokeWidth={4.5} strokeLinecap="round" />
      <Num n={n} />
    </>
  )
}
