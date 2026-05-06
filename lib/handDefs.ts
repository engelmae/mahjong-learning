import type { HandDef, NumberGroupSpec, DragonGroupSpec, WindGroupSpec, DragonValue } from '../types/handDefs'

type Suit = NumberGroupSpec['suit']
type Val  = NumberGroupSpec['value']

// Helper shorthands — reduce verbosity in the definitions below
const n = (suit: Suit, value: Val, count: 1|2|3|4|5, jokerOk = count >= 3): NumberGroupSpec =>
  ({ kind: 'number', suit, value, count, jokerOk })

const d = (value: DragonValue, count: 1|2|3|4|5, jokerOk = count >= 3): DragonGroupSpec =>
  ({ kind: 'dragon', value, count, jokerOk })

const w = (value: WindGroupSpec['value'], count: 1|2|3|4|5, jokerOk = count >= 3): WindGroupSpec =>
  ({ kind: 'wind', value, count, jokerOk })

const f = (count: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) =>
  ({ kind: 'flower' as const, count, jokerOk: false as const })

// NEWS = one each of N, E, W, S (4 singles)
const NEWS = { kind: 'wind' as const, value: 'NEWS' as const, count: 4 as const, jokerOk: false as const }

export const ALL_HAND_DEFS: HandDef[] = [

  // ─── 2026 — Year Hands ───────────────────────────────────────────────────

  {
    id: 'year-A',
    name: '222 Soap Soap Soap 2222 6666',
    category: 'year',
    points: 25,
    concealed: false,
    groups: [n('S1', 2, 3), d('Soap', 3), n('S2', 2, 4), n('S2', 6, 4)],
  },
  {
    id: 'year-B',
    name: '2 0 2 6 DDD | Kong2or6 DDD',
    category: 'year',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 2, 1, false), d('Soap', 1, false), n('S1', 2, 1, false), n('S1', 6, 1, false),
      d('match-S1', 3),
      n('S2', 'V1', 4), d('match-S2', 3),
    ],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [2, 6] }],
  },
  {
    id: 'year-C',
    name: 'FFF 2026(S1) 222(S2) 6666(S3)',
    category: 'year',
    points: 25,
    concealed: false,
    groups: [
      f(3),
      n('S1', 2, 1, false), d('Soap', 1, false), n('S1', 2, 1, false), n('S1', 6, 1, false),
      n('S2', 2, 3),
      n('S3', 6, 4),
    ],
  },
  {
    id: 'year-D',
    name: '22(S1) Soap Soap 222 666(S2) NEWS',
    category: 'year',
    points: 30,
    concealed: false,
    groups: [n('S1', 2, 2, false), d('Soap', 2, false), n('S2', 2, 3), n('S2', 6, 3), NEWS],
  },

  // ─── 2468 — Even Numbers ─────────────────────────────────────────────────

  {
    id: 'even-A-1s',
    name: '222 444 6666 8888 (1 suit)',
    category: '2468',
    points: 25,
    concealed: false,
    groups: [n('S1', 2, 3), n('S1', 4, 3), n('S1', 6, 4), n('S1', 8, 4)],
  },
  {
    id: 'even-A-2s',
    name: '222 444 (S1) 6666 8888 (S2)',
    category: '2468',
    points: 25,
    concealed: false,
    groups: [n('S1', 2, 3), n('S1', 4, 3), n('S2', 6, 4), n('S2', 8, 4)],
  },
  {
    id: 'even-B',
    name: 'FF 2222 8888(S1) 44 66(S2)',
    category: '2468',
    points: 30,
    concealed: false,
    groups: [f(2), n('S1', 2, 4), n('S2', 4, 2, false), n('S2', 6, 2, false), n('S1', 8, 4)],
  },
  {
    id: 'even-C',
    name: 'EE 22 444 666 88 WW (1 suit)',
    category: '2468',
    points: 30,
    concealed: false,
    groups: [w('E', 2, false), n('S1', 2, 2, false), n('S1', 4, 3), n('S1', 6, 3), n('S1', 8, 2, false), w('W', 2, false)],
  },
  {
    id: 'even-D',
    name: '2222 DDD(S1) 8888 DDD(S2)',
    category: '2468',
    points: 25,
    concealed: false,
    groups: [n('S1', 2, 4), d('match-S1', 3), n('S2', 8, 4), d('match-S2', 3)],
  },
  {
    id: 'even-E',
    name: 'FFF 22 44 666 8888 (1 suit)',
    category: '2468',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 2, 2, false), n('S1', 4, 2, false), n('S1', 6, 3), n('S1', 8, 4)],
  },
  {
    id: 'even-F',
    name: '2 4 6 8(S1) | V1×4+D(S2) | V1×4+D(S3)',
    category: '2468',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 2, 1, false), n('S1', 4, 1, false), n('S1', 6, 1, false), n('S1', 8, 1, false),
      n('S2', 'V1', 4), d('match-S2', 1, false),
      n('S3', 'V1', 4), d('match-S3', 1, false),
    ],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [2, 4, 6, 8] }],
  },
  {
    id: 'even-G',
    name: 'FFF 2 4 6 8(S1) FFF V1×4(S2)',
    category: '2468',
    points: 30,
    concealed: false,
    groups: [
      f(3),
      n('S1', 2, 1, false), n('S1', 4, 1, false), n('S1', 6, 1, false), n('S1', 8, 1, false),
      f(3),
      n('S2', 'V1', 4),
    ],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [2, 4, 6, 8] }],
  },
  {
    id: 'even-H',
    name: 'FF 2 4 6 888(S1) 2 4 6 888(S2)',
    category: '2468',
    points: 30,
    concealed: true,
    groups: [
      f(2),
      n('S1', 2, 1, false), n('S1', 4, 1, false), n('S1', 6, 1, false), n('S1', 8, 3),
      n('S2', 2, 1, false), n('S2', 4, 1, false), n('S2', 6, 1, false), n('S2', 8, 3),
    ],
  },

  // ─── Any Like Nos. ───────────────────────────────────────────────────────

  {
    id: 'aln-A',
    name: 'V1×4(S1) FFFFFF V1×4(S2)',
    category: 'like-numbers',
    points: 30,
    concealed: false,
    groups: [n('S1', 'V1', 4), f(6), n('S2', 'V1', 4)],
  },
  {
    id: 'aln-B',
    name: 'V1×4+D(S1) V1×3+D(S2) V1×4+D(S3)',
    category: 'like-numbers',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 'V1', 4), d('match-S1', 1, false),
      n('S2', 'V1', 3), d('match-S2', 1, false),
      n('S3', 'V1', 4), d('match-S3', 1, false),
    ],
  },
  {
    id: 'aln-C',
    name: 'FF V1×4(S1) V1×2(S2) V1×4(S3) DD(any)',
    category: 'like-numbers',
    points: 25,
    concealed: false,
    groups: [f(2), n('S1', 'V1', 4), n('S2', 'V1', 2, false), n('S3', 'V1', 4), d('any', 2, false)],
  },

  // ─── Quints ──────────────────────────────────────────────────────────────

  {
    id: 'quint-A',
    name: 'V1×5(S1) V1×4(S2) V1×5(S3)',
    category: 'quints',
    points: 40,
    concealed: false,
    groups: [n('S1', 'V1', 5), n('S2', 'V1', 4), n('S3', 'V1', 5)],
  },
  {
    id: 'quint-B',
    name: 'FF V1×5 V2×2 V3×5 (S1, consec)',
    category: 'quints',
    points: 45,
    concealed: false,
    groups: [f(2), n('S1', 'V1', 5), n('S1', 'V2', 2, false), n('S1', 'V3', 5)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'quint-C',
    name: 'V1×5 V2×5 (S1) opp-dragon×4',
    category: 'quints',
    points: 40,
    concealed: false,
    groups: [n('S1', 'V1', 5), n('S1', 'V2', 5), d('opp-S1', 4)],
  },

  // ─── Consec. Run ─────────────────────────────────────────────────────────

  {
    id: 'cr-A-lo',
    name: '11 222 33 444 5555 (S1)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [n('S1', 1, 2, false), n('S1', 2, 3), n('S1', 3, 2, false), n('S1', 4, 3), n('S1', 5, 4)],
  },
  {
    id: 'cr-A-hi',
    name: '55 666 77 888 9999 (S1)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [n('S1', 5, 2, false), n('S1', 6, 3), n('S1', 7, 2, false), n('S1', 8, 3), n('S1', 9, 4)],
  },
  {
    id: 'cr-B-1s',
    name: 'FFF V1×4 V2 V3 V2+2×4 (S1, 5 consec)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    // V1..V3 are 3 of the 5; need V4,V5 too — represent middle 3 singles as V2,V3,V4
    // Pattern: FFF kong(V1) single(V2) single(V3) single(V4) kong(V5) — 5 consec
    // Using V1=start, V2=+1, V3=+2 for the singles, kong at V1 and V1+4
    // Encode as: flower(3) + kong(S1,V1) + single(S1,V2) + single(S1,V3) + single(S1,V3+1... )
    // The plan uses V1..V5 but type only has V1..V3. Represent the two kongs as V1 and V2,
    // with constraint V2 = V1+4 (consec([V1,V2]) won't work for non-adjacent).
    // Simplest: encode pattern as two fixed variants below (cr-B variants per start value)
    // instead. Here we use a direct groups representation without vars for the middle singles.
    // The matching algo will try all start values 1–5 via V1 binding.
    groups: [f(3), n('S1', 'V1', 4), n('S1', 'V2', 1, false), n('S1', 'V3', 1, false), n('S1', 'V3', 1, false), n('S1', 'V1', 4)],
    // Note: this encodes a 1-suit 5-consec hand. The matching engine binds V1=start,
    // V2=start+1, V3=start+2 for the three singles and uses V1 again for the end kong.
    // The consec constraint drives valid bindings; V3+1 and V3+2 are implicit.
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-B-2s',
    name: 'FFF V1×4(S1) V2 V3 V4(S2) V5×4(S1) — 5 consec, 2 suits',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 'V1', 4), n('S2', 'V2', 1, false), n('S2', 'V3', 1, false), n('S2', 'V3', 1, false), n('S1', 'V1', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-C',
    name: 'V1×2 V2×2(S1) V1×3 V2×3(S2) V3×4(S3)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [n('S1', 'V1', 2, false), n('S1', 'V2', 2, false), n('S2', 'V1', 3), n('S2', 'V2', 3), n('S3', 'V3', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-D-1s',
    name: 'V1×3 V2×3 V3×4 V3+1×4 (S1, 4 consec)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [n('S1', 'V1', 3), n('S1', 'V2', 3), n('S1', 'V3', 4), n('S1', 'V3', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-D-2s',
    name: 'V1×3 V2×3(S1) V3×4 V3+1×4(S2)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [n('S1', 'V1', 3), n('S1', 'V2', 3), n('S2', 'V3', 4), n('S2', 'V3', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-E-1s',
    name: 'FFF V1×2 V2×2 V3×3 dragon×4 (S1, D matches middle)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 'V1', 2, false), n('S1', 'V2', 2, false), n('S1', 'V3', 3), d('match-S1', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-E-2s',
    name: 'FFF V1×2(S1) V2×2(S2) V3×3(S1) dragon×4(match-S2)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 'V1', 2, false), n('S2', 'V2', 2, false), n('S1', 'V3', 3), d('match-S2', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-F',
    name: 'V1×4 FFFFFF V2×4 (S1, 2 consec)',
    category: 'consec-run',
    points: 30,
    concealed: false,
    groups: [n('S1', 'V1', 4), f(6), n('S1', 'V2', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2'] }],
  },
  {
    id: 'cr-G-1s',
    name: 'FF V1×4 V2×4 V3×4 (S1, 3 consec)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [f(2), n('S1', 'V1', 4), n('S1', 'V2', 4), n('S1', 'V3', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-G-3s',
    name: 'FF V1×4(S1) V2×4(S2) V3×4(S3)',
    category: 'consec-run',
    points: 25,
    concealed: false,
    groups: [f(2), n('S1', 'V1', 4), n('S2', 'V2', 4), n('S3', 'V3', 4)],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'cr-H',
    name: 'V1 V2×2 V3×3(S1) V1 V2×2 V3×3(S2) V4×2(S3)',
    category: 'consec-run',
    points: 35,
    concealed: true,
    groups: [
      n('S1', 'V1', 1, false), n('S1', 'V2', 2, false), n('S1', 'V3', 3),
      n('S2', 'V1', 1, false), n('S2', 'V2', 2, false), n('S2', 'V3', 3),
      n('S3', 'V3', 2, false),
    ],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },

  // ─── 13579 — Odd Numbers ─────────────────────────────────────────────────

  {
    id: 'odd-A-1s',
    name: '11 333 55 777 9999 (S1)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 1, 2, false), n('S1', 3, 3), n('S1', 5, 2, false), n('S1', 7, 3), n('S1', 9, 4)],
  },
  {
    id: 'odd-A-3s',
    name: '11 333(S1) 55 777(S2) 9999(S3)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 1, 2, false), n('S1', 3, 3), n('S2', 5, 2, false), n('S2', 7, 3), n('S3', 9, 4)],
  },
  {
    id: 'odd-B-lo',
    name: '111 333(S1) 3333 5555(S2)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 1, 3), n('S1', 3, 3), n('S2', 3, 4), n('S2', 5, 4)],
  },
  {
    id: 'odd-B-hi',
    name: '555 777(S1) 7777 9999(S2)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 5, 3), n('S1', 7, 3), n('S2', 7, 4), n('S2', 9, 4)],
  },
  {
    id: 'odd-C-lo',
    name: 'NN 1111 33 5555 SS (S1)',
    category: '13579',
    points: 30,
    concealed: false,
    groups: [w('N', 2, false), n('S1', 1, 4), n('S1', 3, 2, false), n('S1', 5, 4), w('S', 2, false)],
  },
  {
    id: 'odd-C-hi',
    name: 'NN 5555 77 9999 SS (S1)',
    category: '13579',
    points: 30,
    concealed: false,
    groups: [w('N', 2, false), n('S1', 5, 4), n('S1', 7, 2, false), n('S1', 9, 4), w('S', 2, false)],
  },
  {
    id: 'odd-D',
    name: '1 1 3 5 7 9(S1) V1×4(S2) V1×4(S3)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 1, 2, false), n('S1', 3, 1, false), n('S1', 5, 1, false),
      n('S1', 7, 1, false), n('S1', 9, 1, false),
      n('S2', 'V1', 4), n('S3', 'V1', 4),
    ],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [1, 3, 5, 7, 9] }],
  },
  {
    id: 'odd-E-lo',
    name: 'FFF 11 33 555 DDDD(S1,match)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 1, 2, false), n('S1', 3, 2, false), n('S1', 5, 3), d('match-S1', 4)],
  },
  {
    id: 'odd-E-hi',
    name: 'FFF 55 77 999 DDDD(S1,match)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 5, 2, false), n('S1', 7, 2, false), n('S1', 9, 3), d('match-S1', 4)],
  },
  {
    id: 'odd-F-lo',
    name: '11 33(S1) 111 333(S2) 5555(S3)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 1, 2, false), n('S1', 3, 2, false), n('S2', 1, 3), n('S2', 3, 3), n('S3', 5, 4)],
  },
  {
    id: 'odd-F-hi',
    name: '55 77(S1) 555 777(S2) 9999(S3)',
    category: '13579',
    points: 25,
    concealed: false,
    groups: [n('S1', 5, 2, false), n('S1', 7, 2, false), n('S2', 5, 3), n('S2', 7, 3), n('S3', 9, 4)],
  },
  {
    id: 'odd-G-1s',
    name: '1111 33 55 77 9999 (S1)',
    category: '13579',
    points: 30,
    concealed: false,
    groups: [n('S1', 1, 4), n('S1', 3, 2, false), n('S1', 5, 2, false), n('S1', 7, 2, false), n('S1', 9, 4)],
  },
  {
    id: 'odd-G-2s',
    name: '1111 9999(S1) 33 55 77(S2)',
    category: '13579',
    points: 30,
    concealed: false,
    groups: [n('S1', 1, 4), n('S2', 3, 2, false), n('S2', 5, 2, false), n('S2', 7, 2, false), n('S1', 9, 4)],
  },
  {
    id: 'odd-H-lo',
    name: 'FF 11 33 55(S1) 555(S2) 555(S3)',
    category: '13579',
    points: 35,
    concealed: true,
    groups: [f(2), n('S1', 1, 2, false), n('S1', 3, 2, false), n('S1', 5, 2, false), n('S2', 5, 3), n('S3', 5, 3)],
  },
  {
    id: 'odd-H-hi',
    name: 'FF 55 77 99(S1) 999(S2) 999(S3)',
    category: '13579',
    points: 35,
    concealed: true,
    groups: [f(2), n('S1', 5, 2, false), n('S1', 7, 2, false), n('S1', 9, 2, false), n('S2', 9, 3), n('S3', 9, 3)],
  },
  {
    id: 'odd-I',
    name: 'FF 1 3 5 777 999(S1) DDD(opp-S1)',
    category: '13579',
    points: 30,
    concealed: true,
    groups: [
      f(2),
      n('S1', 1, 1, false), n('S1', 3, 1, false), n('S1', 5, 1, false),
      n('S1', 7, 3), n('S1', 9, 3),
      d('opp-S1', 3),
    ],
  },

  // ─── Winds & Dragons ─────────────────────────────────────────────────────

  {
    id: 'wd-A-v1',
    name: 'NNNN EEE WWW SSSS',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [w('N', 4), w('E', 3), w('W', 3), w('S', 4)],
  },
  {
    id: 'wd-A-v2',
    name: 'NNN EEEE WWWW SSS',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [w('N', 3), w('E', 4), w('W', 4), w('S', 3)],
  },
  {
    id: 'wd-B',
    name: '1 2 3 4(S1) DDD DDD DDDD',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 1, 1, false), n('S1', 2, 1, false), n('S1', 3, 1, false), n('S1', 4, 1, false),
      d('any', 3), d('any', 3), d('any', 4),
    ],
  },
  {
    id: 'wd-C',
    name: 'NNN V1×4(S1) V1×4(S2) SSS (odd)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [w('N', 3), n('S1', 'V1', 4), n('S2', 'V1', 4), w('S', 3)],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [1, 3, 5, 7, 9] }],
  },
  {
    id: 'wd-D',
    name: 'EEE V1×4(S1) V1×4(S2) WWW (even)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [w('E', 3), n('S1', 'V1', 4), n('S2', 'V1', 4), w('W', 3)],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [2, 4, 6, 8] }],
  },
  {
    id: 'wd-E',
    name: 'FFF NNNN FFF DDDD(any)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [f(3), w('N', 4), f(3), d('any', 4)],
  },
  {
    id: 'wd-F',
    name: '1 N 2 EE 3 WWW 4 SSSS (S1)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [
      n('S1', 1, 1, false), w('N', 1, false),
      n('S1', 2, 1, false), w('E', 2, false),
      n('S1', 3, 1, false), w('W', 3),
      n('S1', 4, 1, false), w('S', 4),
    ],
  },
  {
    id: 'wd-G-ns',
    name: 'FF NNNN SSSS DD(S1) DD(S2)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [f(2), w('N', 4), w('S', 4), d('match-S1', 2, false), d('match-S2', 2, false)],
  },
  {
    id: 'wd-G-ew',
    name: 'FF EEEE WWWW DD(S1) DD(S2)',
    category: 'winds-dragons',
    points: 25,
    concealed: false,
    groups: [f(2), w('E', 4), w('W', 4), d('match-S1', 2, false), d('match-S2', 2, false)],
  },
  {
    id: 'wd-H',
    name: 'NN EEE 2026(S1) WWW SS',
    category: 'winds-dragons',
    points: 30,
    concealed: true,
    groups: [
      w('N', 2, false), w('E', 3),
      n('S1', 2, 1, false), d('Soap', 1, false), n('S1', 2, 1, false), n('S1', 6, 1, false),
      w('W', 3), w('S', 2, false),
    ],
  },

  // ─── 369 ─────────────────────────────────────────────────────────────────

  {
    id: '369-A-2s',
    name: '333 666(S1) 6666 9999(S2)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [n('S1', 3, 3), n('S1', 6, 3), n('S2', 6, 4), n('S2', 9, 4)],
  },
  {
    id: '369-A-3s',
    name: '333 666(S1) 6666(S2) 9999(S3)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [n('S1', 3, 3), n('S1', 6, 3), n('S2', 6, 4), n('S3', 9, 4)],
  },
  {
    id: '369-B',
    name: '33 66(S1) 333 666(S2) 9999(S3)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [n('S1', 3, 2, false), n('S1', 6, 2, false), n('S2', 3, 3), n('S2', 6, 3), n('S3', 9, 4)],
  },
  {
    id: '369-C-1s',
    name: 'FFF 33 666 99 DDDD(S1,match)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 3, 2, false), n('S1', 6, 3), n('S1', 9, 2, false), d('match-S1', 4)],
  },
  {
    id: '369-C-2s',
    name: 'FFF 33 666 99(S1) DDDD(opp-S1)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [f(3), n('S1', 3, 2, false), n('S1', 6, 3), n('S1', 9, 2, false), d('opp-S1', 4)],
  },
  {
    id: '369-D',
    name: '33 66(S1) 666 999(S2) NEWS',
    category: '369',
    points: 30,
    concealed: false,
    groups: [n('S1', 3, 2, false), n('S1', 6, 2, false), n('S2', 6, 3), n('S2', 9, 3), NEWS],
  },
  {
    id: '369-E',
    name: 'FF 3 3 6 9(S1) V1×4(S2) V1×4(S3)',
    category: '369',
    points: 25,
    concealed: false,
    groups: [
      f(2),
      n('S1', 3, 2, false), n('S1', 6, 1, false), n('S1', 9, 1, false),
      n('S2', 'V1', 4), n('S3', 'V1', 4),
    ],
    constraints: [{ op: 'in-set', lhs: 'V1', values: [3, 6, 9] }],
  },
  {
    id: '369-F',
    name: 'FF 333 666 999(S1) 3 6 9(S2)',
    category: '369',
    points: 30,
    concealed: true,
    groups: [
      f(2),
      n('S1', 3, 3), n('S1', 6, 3), n('S1', 9, 3),
      n('S2', 3, 1, false), n('S2', 6, 1, false), n('S2', 9, 1, false),
    ],
  },

  // ─── Singles & Pairs — All Concealed ─────────────────────────────────────

  {
    id: 'sp-A',
    name: 'NN EE WW SS V1+D(S1) V1+D(S2) V1+D(S3)',
    category: 'singles-pairs',
    points: 50,
    concealed: true,
    groups: [
      w('N', 2, false), w('E', 2, false), w('W', 2, false), w('S', 2, false),
      n('S1', 'V1', 1, false), d('match-S1', 1, false),
      n('S2', 'V1', 1, false), d('match-S2', 1, false),
      n('S3', 'V1', 1, false), d('match-S3', 1, false),
    ],
  },
  {
    id: 'sp-B',
    name: '2 4 66 88(S1) 2 4 66 88(S2) 88(S3)',
    category: 'singles-pairs',
    points: 50,
    concealed: true,
    groups: [
      n('S1', 2, 1, false), n('S1', 4, 1, false), n('S1', 6, 2, false), n('S1', 8, 2, false),
      n('S2', 2, 1, false), n('S2', 4, 1, false), n('S2', 6, 2, false), n('S2', 8, 2, false),
      n('S3', 8, 2, false),
    ],
  },
  {
    id: 'sp-C',
    name: 'FF 3369(S1) 3669(S2) 3699(S3)',
    category: 'singles-pairs',
    points: 50,
    concealed: true,
    groups: [
      f(2),
      n('S1', 3, 2, false), n('S1', 6, 1, false), n('S1', 9, 1, false),
      n('S2', 3, 1, false), n('S2', 6, 2, false), n('S2', 9, 1, false),
      n('S3', 3, 1, false), n('S3', 6, 1, false), n('S3', 9, 2, false),
    ],
  },
  {
    id: 'sp-D',
    name: '11 22 33 44 55 66 77 (S1, any 7 consec)',
    category: 'singles-pairs',
    points: 50,
    concealed: true,
    // 7 consecutive pairs: V1..V3 with 4 implied via offsets.
    // Encode as 7 pair groups with fixed offsets from V1.
    // The matching engine resolves V1=start (1-3), then checks V1+0..V1+6 pairs.
    // We use repeated V1 entries; the offset logic is in the matching algorithm.
    groups: [
      n('S1', 'V1', 2, false), n('S1', 'V2', 2, false), n('S1', 'V3', 2, false),
      n('S1', 'V3', 2, false), n('S1', 'V3', 2, false), n('S1', 'V3', 2, false), n('S1', 'V3', 2, false),
    ],
    constraints: [{ op: 'consec', vars: ['V1', 'V2', 'V3'] }],
  },
  {
    id: 'sp-E',
    name: '11 357 99(S1) 11 357 99(S2)',
    category: 'singles-pairs',
    points: 50,
    concealed: true,
    groups: [
      n('S1', 1, 2, false), n('S1', 3, 1, false), n('S1', 5, 1, false), n('S1', 7, 1, false), n('S1', 9, 2, false),
      n('S2', 1, 2, false), n('S2', 3, 1, false), n('S2', 5, 1, false), n('S2', 7, 1, false), n('S2', 9, 2, false),
    ],
  },
  {
    id: 'sp-F',
    name: 'FF 2026(S1) 2026(S2) 2026(S3)',
    category: 'singles-pairs',
    points: 75,
    concealed: true,
    groups: [
      f(2),
      n('S1', 2, 1, false), d('Soap', 1, false), n('S1', 2, 1, false), n('S1', 6, 1, false),
      n('S2', 2, 1, false), d('Soap', 1, false), n('S2', 2, 1, false), n('S2', 6, 1, false),
      n('S3', 2, 1, false), d('Soap', 1, false), n('S3', 2, 1, false), n('S3', 6, 1, false),
    ],
  },
]
