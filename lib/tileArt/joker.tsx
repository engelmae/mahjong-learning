export function JokerSVG() {
  return (
    <>
      <path d="M 17,55 Q 4,44 7,24 Q 9,16 13,24 Q 19,42 22,55 Z" fill="#c02040" />
      <path d="M 22,55 Q 24,34 26,8 Q 28,34 30,55 Z" fill="#f0b010" />
      <path d="M 30,55 Q 33,42 39,24 Q 43,16 45,24 Q 48,44 35,55 Z" fill="#c02040" />
      <rect x={12} y={54} width={28} height={8} rx={4} fill="#f0b010" />
      <circle cx={11} cy={24} r={5} fill="#f0b010" stroke="#b87c08" strokeWidth={0.8} />
      <circle cx={26} cy={8} r={5} fill="#f0b010" stroke="#b87c08" strokeWidth={0.8} />
      <circle cx={41} cy={24} r={5} fill="#f0b010" stroke="#b87c08" strokeWidth={0.8} />
      <path d="M 8,22 Q 11,19 14,22" fill="none" stroke="#faf9f7" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
      <path d="M 23,6 Q 26,3 29,6" fill="none" stroke="#faf9f7" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
      <path d="M 38,22 Q 41,19 44,22" fill="none" stroke="#faf9f7" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
      <circle cx={11} cy={30} r={1.4} fill="#c02040" />
      <circle cx={26} cy={14} r={1.4} fill="#c02040" />
      <circle cx={41} cy={30} r={1.4} fill="#c02040" />
    </>
  )
}
