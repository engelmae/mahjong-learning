# American Mahjong Multiplayer Web App — Build Plan

## Context
Build a mobile-optimized web app where one person creates a game room, shares a link via text, and up to 3 friends join to play American Mahjong together in real time. No accounts needed — just a nickname. Must include Charleston tile-passing, joker mechanics, and a shareable link. Target: playable in 3 hours.

---

## Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Deploys on Vercel with zero config |
| Styling | Tailwind CSS | Fast mobile-first UI |
| Real-time DB | Firebase Realtime Database | Free real-time sync, no backend server needed |
| Language | TypeScript | Catch bugs fast |
| Hosting | Vercel (frontend) + Firebase (data) | Both have free tiers |

---

## Directory Structure
```
mahjong-app/
├── app/
│   ├── page.tsx                    # Home: create game or join with code
│   ├── game/[gameId]/page.tsx      # Game room (all phases)
│   └── layout.tsx
├── lib/
│   ├── firebase.ts                 # Firebase init + config
│   ├── tiles.ts                    # Tile definitions, shuffle, deal
│   └── gameActions.ts              # Firebase read/write helpers
├── components/
│   ├── Tile.tsx                    # Single tile (visual)
│   ├── Hand.tsx                    # Player's hand (sortable)
│   ├── DiscardPile.tsx             # Per-player discard history
│   ├── ExposedSets.tsx             # Claimed/exposed groups + joker swap
│   ├── Charleston.tsx              # Charleston phase: select + pass tiles
│   └── GameBoard.tsx               # Main layout orchestrator
├── types/
│   └── game.ts                     # All TypeScript interfaces
└── package.json
```

---

## Firebase Game State Shape
```json
{
  "games": {
    "{gameId}": {
      "status": "waiting | charleston | playing | finished",
      "hostId": "string",
      "players": {
        "{playerId}": {
          "nickname": "Alice",
          "seatIndex": 0,
          "hand": [{ "suit": "bam", "value": 1, "id": "uuid", "isJoker": false }],
          "exposedSets": [[...tiles]],
          "discards": [...tiles],
          "isReady": false,
          "charlestionSelection": [...3 tiles]
        }
      },
      "wall": [...all shuffled tiles],
      "wallIndex": 0,
      "currentTurn": "playerId",
      "lastDiscard": { "tile": {...}, "fromPlayerId": "string" },
      "pendingClaim": { "tile": {...}, "expiresAt": timestamp },
      "charlestionRound": 0,
      "charlestionDirection": "right | across | left",
      "winner": null
    }
  }
}
```

---

## American Mahjong Tile Set (152 tiles)
- Bams 1–9 × 4 = 36
- Craks 1–9 × 4 = 36
- Dots 1–9 × 4 = 36
- Winds (N/S/E/W) × 4 = 16
- Dragons (Red/Green/Soap) × 4 = 12
- Flowers × 8 = 8
- Jokers × 8 = 8

---

## Build Timeline (3 Hours)

### Phase 1 — Setup (0:00–0:30)
1. `npx create-next-app@latest mahjong-app --typescript --tailwind --app`
2. `npm install firebase nanoid`
3. Create Firebase project → Realtime Database → copy config to `.env.local`
4. Write `lib/firebase.ts` (init Firebase app + export `db`)
5. Write `types/game.ts` (all interfaces: `Tile`, `Player`, `GameState`)

### Phase 2 — Home Page + Lobby (0:30–1:00)
**`app/page.tsx`**
- Bot count selector: 0 / 1 / 2 / 3 bots (0 = "Create & Share Link"; 1–2 = "Create Game"; 3 = "Play Solo — starts immediately")
- Button labels adapt: **"Create & Share Link"** (0 bots), **"Create Game"** (1–2 bots), **"Play Solo"** (3 bots)
- Loading states: **"Creating…"** / **"Starting…"**
- Field: **"Join Game"** → enter code → redirect to `/game/[gameId]`; **"← Back to home"** to cancel
- On load of `/game/[gameId]`: nickname prompt modal → stores `playerId` + `nickname` in `sessionStorage` → writes player to Firebase

**`lib/gameActions.ts`**
- `createGame(gameId)` — write initial game state
- `joinGame(gameId, playerId, nickname)` — add player node
- `subscribeToGame(gameId, callback)` — `onValue` listener

### Phase 3 — Tiles + Dealing (1:00–1:30)
**`lib/tiles.ts`**
- `buildDeck()` — returns all 148 tiles with unique IDs
- `shuffleDeck(tiles)` — Fisher-Yates
- `dealHands(deck)` — deal 13 tiles to each of 4 players, return hands + remaining wall

**`components/Tile.tsx`**
- Renders a single tile as a styled card
- Props: `tile`, `selected`, `faceDown`, `onClick`
- Use colored emoji or Unicode mahjong symbols for tile faces (fast, no assets needed)

**`components/Hand.tsx`**
- Renders player's hand as a scrollable row of `<Tile>` components
- Supports tap-to-select

When all seats are filled and host clicks **"Deal Tiles & Start!"** → host runs `dealHands`, writes all hands + wall to Firebase → status → `"charleston"`

Lobby UI also shows: **"Copy"** button for sharing link; **"Leave Game"** button; player list with **"BOT"** and **"Host"** labels; **"Waiting for X more player(s)…"** / **"Waiting for host to deal…"** status text.

### Phase 4 — Charleston (1:30–2:00)
**`components/Charleston.tsx`**
- Full 6-stage sequence: Pass Right → Pass Across → Pass Left → Pass Left → Pass Across → Pass Right
- Shows stage tracker with completed (✓), current (highlighted), and future stages
- Player selects exactly 3 tiles from hand → button shows **"Pass 0/3"** → **"Pass 1/3"** → **"Pass 2/3"** → **"Pass 3/3"** (activates on 3 selected)
- **"Sort"** button organizes tiles by suit during selection
- **"Exit"** button available throughout
- Status shows **"✓ X/4 players ready"** once a player submits
- On submit: write selection to player's Firebase node
- When all 4 have submitted: host client swaps tiles and advances stage
- After 6 stages → status → `"playing"`, set `currentTurn` to dealer (seat 0)

**Key logic in `lib/gameActions.ts`**
- `submitCharlestionPass(gameId, playerId, tiles)`
- `processCharlestionRound(gameId)` — called when all 4 selections are in, swaps tiles, advances stage

### Phase 5 — Core Gameplay (2:00–2:30)
**`app/game/[gameId]/page.tsx`** (main game state machine)
- Subscribes to Firebase game state
- Renders: `GameBoard` with each player's exposed sets + discard pile + the wall count
- If `currentTurn === myPlayerId`: show **"Draw"** button (green) → draws tile from wall, adds to hand
- After drawing: must discard — tap a tile → **"Discard"** button (blue) → confirm → writes to Firebase
- **"Mahjong"** button (purple) available after drawing to declare a win
- **"Sort"** button organizes hand; **"Discards »"** opens discard history modal; **"Exit"** leaves game
- Status messages: **"Your turn to draw…"** / **"Select your discard…"** / **"Confirm your discard…"** / **"[Player]'s turn"**

**Discard claiming (5-second window)**
- On discard: set `pendingClaim` with 5s expiry; animated shrinking bar shows countdown
- Other players see **"Call"** button (amber) to enter claim mode; then select tiles → **"Expose (N)"** button
- **"Cancel"** exits claim mode without claiming; claim UI shows **"[Player] threw [tile]…"**
- First claim wins; if no claim, turn passes left
- On claim: remove tiles from hand → add to `exposedSets` → player discards again (or declares win via **"Mahjong"** button)

**`components/ExposedSets.tsx`**
- Shows each player's exposed sets face-up
- Each joker tile in an exposed set shows a "swap" button to others who hold the matching tile

### Phase 6 — Jokers + Win + Polish (2:30–3:00)
**Joker swapping**
- During your turn: if another player's exposed set contains a joker AND you hold the exact matching tile → show swap button
- `swapJoker(gameId, setOwnerId, setIndex, jokerIndex, swapperPlayerId, replacementTile)`
- Writes updated exposed set (joker moves to swapper's hand, real tile takes its place)

**Win declaration**
- **"Mahjong"** button (purple, available after drawing) → status → `"finished"`, `winner` = playerId
- Finished screen: **"🎉 You won!"** / **"[Player] wins!"** / **"Wall Exhausted"** header
- **"Play Again"** button (yellow) resets game keeping same players; **"Exit"** (gray) returns to home

**Mobile polish**
- **Landscape lock**: Force landscape orientation during gameplay using the Screen Orientation API (`screen.orientation.lock('landscape')`) + CSS `@media (orientation: portrait)` overlay that prompts "Rotate your phone to play"
- This is critical UX — a 14-tile hand fits naturally in landscape without any scrolling
- Ensure tiles are large enough to tap on phones (min 44×44px touch targets)
- Fixed bottom strip for current player's hand; upper area = board with opponents + wall

---

## Firebase Setup Steps
1. Go to console.firebase.google.com → New project
2. Realtime Database → Create (test mode, rules allow all reads/writes)
3. Copy config into `.env.local`:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   ```

## Vercel Deployment
1. Push code to GitHub
2. Import repo on vercel.com
3. Add all `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel dashboard
4. Deploy → share the URL

---

## Key Implementation Decisions
- **Player identity**: `playerId` = `crypto.randomUUID()` stored in `sessionStorage`. Rejoining same browser tab restores your session.
- **Host duties**: Host's browser runs the Charleston resolution and deal logic (no server needed). Firebase write is atomic enough for 4 players.
- **Tile rendering**: Unicode mahjong block (🀇–🀟) or colored badge components — no image assets needed.
- **Claim race**: Lowest `timestamp` of claim wins. Use Firebase `serverTimestamp()` for fairness.
- **No NMJL card validation** (v0): Win was honor system. The hand-matching feature being planned now adds real validation via `distanceTo`.
- **Joker swap**: Available during your turn if an opponent's exposed set has a joker you can replace with a natural tile. Shown as **⇄** button on the exposed set.
- **Wall exhaustion**: When wall runs out with no winner → game ends as a draw, **"Wall Exhausted"** shown to all players.

---

## Verification / Testing
1. Open app in 4 separate browser tabs (or devices)
2. Tab 1: Select 0 bots → click **"Create & Share Link"** → copy the link
3. Tabs 2–4: Open link, enter nicknames
4. Tab 1 (host): Click **"Deal Tiles & Start!"**
5. Verify all 6 Charleston stages cycle: Pass Right → Across → Left → Left → Across → Right
6. Play a round: click **"Draw"** → tap tile → click **"Discard"**
7. Verify **"Call"** button appears with animated countdown bar on other players' screens
8. Claim a pung → click **"Expose (3)"** → verify exposed set appears for all players
9. Verify **⇄** joker swap button appears when conditions are met
10. Click **"Mahjong"** → verify **"🎉 You won!"** shown on winner's screen and **"[Player] wins!"** on others
11. Click **"Play Again"** → verify game resets with same players

---

---

# Feature: NMJL-Style Hand Definitions + Smart Bot Targeting

## Context

The app is at v33 with a working bot system. Bots currently use isolation heuristics (pass/discard the most "lonely" tile). The next step is to give bots genuine strategic intelligence: define ~25 NMJL-inspired winning hand patterns, score each player's hand against all patterns, pick the 3 closest targets, and optimize every decision (Charleston, discard, claim) around reaching one of those targets. When distance = 0 (hand is complete), bots automatically declare Mahjong.

This also lays the foundation for human win detection/validation in a future iteration.

---

## Type System

### New file: `types/handDefs.ts`

```typescript
import { Tile, ExposedSet } from './game'

export type SuitVar = 'S1' | 'S2' | 'S3'   // bind to bam/crak/dot; S1≠S2≠S3
export type ValueVar = 'V1' | 'V2' | 'V3'  // bind to 1–9
export type NumberSuit = 'bam' | 'crak' | 'dot'

// Dragon identity: exact name, suit-relative alias, or 'any'
// match-SN = dragon whose color matches suit SN (bam→Green, crak→Red, dot→Soap)
// opp-SN   = dragon that does NOT match suit SN (used in Quints "Opp. Dragon" hands)
// any      = any of the three dragons
export type DragonValue =
  | 'Red' | 'Green' | 'Soap'
  | 'match-S1' | 'match-S2' | 'match-S3'
  | 'opp-S1'
  | 'any'

export type GroupSpec =
  | NumberGroupSpec
  | WindGroupSpec
  | DragonGroupSpec
  | FlowerGroupSpec

export interface NumberGroupSpec {
  kind: 'number'
  suit: NumberSuit | SuitVar
  value: number | ValueVar
  count: 1 | 2 | 3 | 4 | 5   // 1 = single (jokerOk must be false)
  jokerOk: boolean
}
export interface WindGroupSpec {
  kind: 'wind'
  // 'NEWS' = one each of N, E, W, S (exactly 4 singles, no jokers)
  value: 'N' | 'S' | 'E' | 'W' | 'NEWS'
  count: 1 | 2 | 3 | 4 | 5
  jokerOk: boolean
}
export interface DragonGroupSpec {
  kind: 'dragon'
  value: DragonValue
  count: 1 | 2 | 3 | 4 | 5   // 1 = single dragon tile
  jokerOk: boolean
}
export interface FlowerGroupSpec {
  kind: 'flower'
  count: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  jokerOk: false   // jokers never substitute flowers
}

export type Constraint =
  // V3 = V1 + V2 (all 1–9): used in arithmetic/year hands
  | { op: 'sum';    lhs: ValueVar; rhs: ValueVar; result: ValueVar }
  // V1 must come from a fixed subset, e.g. V1 ∈ {2,6} for "Kong 2 or 6"
  | { op: 'in-set'; lhs: ValueVar; values: number[] }
  // vars form an ascending consecutive sequence: V1 < V2 < V3 (each = prev+1)
  | { op: 'consec'; vars: ValueVar[] }

export interface HandDef {
  id: string
  name: string
  category: HandCategory
  groups: GroupSpec[]
  points: number
  concealed: boolean
  constraints?: Constraint[]
}

export type HandCategory =
  | 'year' | '2468' | 'like-numbers' | 'consec-run'
  | 'winds-dragons' | 'quints' | '13579' | '369' | 'singles-pairs'

export interface VarBinding {
  S1?: NumberSuit; S2?: NumberSuit; S3?: NumberSuit
  V1?: number;     V2?: number;     V3?: number
}

export interface HandScore {
  handDef: HandDef
  distance: number      // 0.0 = Mahjong; float weighted by tile scarcity
  bestBinding: VarBinding
}
```

---

## Full 2026 NMJL Card — Hand Definitions (~50 hands, 9 sections)

### New file: `lib/handDefs.ts` — exports `ALL_HAND_DEFS: HandDef[]`

All hands total exactly 14 tiles. Joker rules: `jokerOk: true` only for groups with count ≥ 3. Singles (count:1), pairs (count:2), and flowers never use jokers.

Encoding conventions:
- **GREEN = Suit A (S1), RED = Suit B (S2), BLACK = Suit C (S3) or neutral tiles**
- `V1`, `V2`, `V3` = value variables; constrained by `constraints` field when needed
- `Soap` in year hands = always `{ kind:'dragon', value:'Soap' }` (never a suit number)
- `NEWS` wind group = one each of N, E, W, S (4 singles, count:4 total, jokerOk:false)
- `match-SN` dragon = dragon color matching suit SN; `opp-S1` = non-matching dragon

---

#### 2026 — Year Hands

| ID | Raw pattern | Groups (suit·value·count) | Constraints | Pts |
|----|-------------|---------------------------|-------------|-----|
| `year-A` | 222(S1) · Soap×3 · 2222(S2) · 6666(S2) | num(S1,2,3·jok) + drag(Soap,3·jok) + num(S2,2,4·jok) + num(S2,6,4·jok) | — | X25 |
| `year-B` | 2·0·2·6(S1) · DDD(S1) · 2or6×4(S2) · DDD(S2) | num(S1,2,1)×2 + drag(Soap,1) + num(S1,6,1) + drag(match-S1,3·jok) + num(S2,V1,4·jok) + drag(match-S2,3·jok) | V1∈{2,6} | X25 |
| `year-C` | FFF · 2·0·2·6(S1) · 222(S2) · 6666(S3) | flower(3) + num(S1,2,1)×2 + drag(Soap,1) + num(S1,6,1) + num(S2,2,3·jok) + num(S3,6,4·jok) | — | X25 |
| `year-D` | 22(S1) · Soap×2 · 222(S2) · 666(S2) · NEWS | num(S1,2,2) + drag(Soap,2) + num(S2,2,3·jok) + num(S2,6,3·jok) + wind(NEWS,4) | — | X30 |

---

#### 2468 — Even Numbers

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `even-A-1s` | 222·444·6666·8888 (S1) | num(S1,2,3·jok)+num(S1,4,3·jok)+num(S1,6,4·jok)+num(S1,8,4·jok) | — | X25 |
| `even-A-2s` | 222·444(S1) · 6666·8888(S2) | num(S1,2,3·jok)+num(S1,4,3·jok)+num(S2,6,4·jok)+num(S2,8,4·jok) | — | X25 |
| `even-B` | FF · 2222·8888(S1) · 44·66(S2) | flower(2)+num(S1,2,4·jok)+num(S2,4,2)+num(S2,6,2)+num(S1,8,4·jok) | — | X30 |
| `even-C` | EE·22·444·666·88·WW (S1) | wind(E,2)+num(S1,2,2)+num(S1,4,3·jok)+num(S1,6,3·jok)+num(S1,8,2)+wind(W,2) | — | X30 |
| `even-D` | 2222·DDD(S1) · 8888·DDD(S2) | num(S1,2,4·jok)+drag(match-S1,3·jok)+num(S2,8,4·jok)+drag(match-S2,3·jok) | — | X25 |
| `even-E` | FFF·22·44·666·8888 (S1) | flower(3)+num(S1,2,2)+num(S1,4,2)+num(S1,6,3·jok)+num(S1,8,4·jok) | — | X25 |
| `even-F` | 2·4·6·8(S1) · V1×4·D(S2) · V1×4·D(S3) | num(S1,2,1)+num(S1,4,1)+num(S1,6,1)+num(S1,8,1)+num(S2,V1,4·jok)+drag(match-S2,1)+num(S3,V1,4·jok)+drag(match-S3,1) | V1∈{2,4,6,8} | X25 |
| `even-G` | FFF · 2·4·6·8(S1) · FFF · V1×4(S2) | flower(3)+num(S1,2,1)+num(S1,4,1)+num(S1,6,1)+num(S1,8,1)+flower(3)+num(S2,V1,4·jok) | V1∈{2,4,6,8} | X30 |
| `even-H` | FF · 2·4·6·888(S1) · 2·4·6·888(S2) | flower(2)+num(S1,2,1)+num(S1,4,1)+num(S1,6,1)+num(S1,8,3·jok)+num(S2,2,1)+num(S2,4,1)+num(S2,6,1)+num(S2,8,3·jok) | — | C30 |

---

#### Any Like Nos. (ALN)

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `aln-A` | V1×4(S1) · FFFFFF · V1×4(S2) | num(S1,V1,4·jok)+flower(6)+num(S2,V1,4·jok) | — | X30 |
| `aln-B` | V1×4·D(S1) · V1×3·D(S2) · V1×4·D(S3) | num(S1,V1,4·jok)+drag(match-S1,1)+num(S2,V1,3·jok)+drag(match-S2,1)+num(S3,V1,4·jok)+drag(match-S3,1) | — | X25 |
| `aln-C` | FF · V1×4(S1) · V1×2(S2) · V1×4(S3) · DD(any) | flower(2)+num(S1,V1,4·jok)+num(S2,V1,2)+num(S3,V1,4·jok)+drag(any,2) | — | X25 |

---

#### Quints

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `quint-A` | V1×5(S1) · V1×4(S2) · V1×5(S3) | num(S1,V1,5·jok)+num(S2,V1,4·jok)+num(S3,V1,5·jok) | — | X40 |
| `quint-B` | FF · V1×5 · V2×2 · V3×5 (S1) | flower(2)+num(S1,V1,5·jok)+num(S1,V2,2)+num(S1,V3,5·jok) | consec(V1,V2,V3) | X45 |
| `quint-C` | V1×5 · V2×5 (S1) · opp-dragon×4 | num(S1,V1,5·jok)+num(S1,V2,5·jok)+drag(opp-S1,4·jok) | — | X40 |

---

#### Consec. Run (CR)

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `cr-A-lo` | 11·222·33·444·5555 (S1) | num(S1,1,2)+num(S1,2,3·jok)+num(S1,3,2)+num(S1,4,3·jok)+num(S1,5,4·jok) | — | X25 |
| `cr-A-hi` | 55·666·77·888·9999 (S1) | num(S1,5,2)+num(S1,6,3·jok)+num(S1,7,2)+num(S1,8,3·jok)+num(S1,9,4·jok) | — | X25 |
| `cr-B-1s` | FFF · V1×4 · V2·V3·V4 · V5×4 (S1) | flower(3)+num(S1,V1,4·jok)+num(S1,V2,1)+num(S1,V3,1)+num(S1,V4,1)+num(S1,V5,4·jok) | consec(V1..V5) | X25 |
| `cr-B-2s` | FFF · V1×4(S1) · V2·V3·V4(S2) · V5×4(S1) | flower(3)+num(S1,V1,4·jok)+num(S2,V2,1)+num(S2,V3,1)+num(S2,V4,1)+num(S1,V5,4·jok) | consec(V1..V5) | X25 |
| `cr-C` | V1×2·V2×2(S1) · V1×3·V2×3(S2) · V3×4(S3) | num(S1,V1,2)+num(S1,V2,2)+num(S2,V1,3·jok)+num(S2,V2,3·jok)+num(S3,V3,4·jok) | consec(V1,V2,V3) | X25 |
| `cr-D-1s` | V1×3·V2×3·V3×4·V4×4 (S1) | num(S1,V1,3·jok)+num(S1,V2,3·jok)+num(S1,V3,4·jok)+num(S1,V4,4·jok) | consec(V1,V2,V3,V4) | X25 |
| `cr-D-2s` | V1×3·V2×3(S1) · V3×4·V4×4(S2) | num(S1,V1,3·jok)+num(S1,V2,3·jok)+num(S2,V3,4·jok)+num(S2,V4,4·jok) | consec(V1,V2,V3,V4) | X25 |
| `cr-E-1s` | FFF · V1×2·V2×2·V3×3 · dragon×4 (S1, dragon matches V2) | flower(3)+num(S1,V1,2)+num(S1,V2,2)+num(S1,V3,3·jok)+drag(match-S1,4·jok) | consec(V1,V2,V3) | X25 |
| `cr-E-2s` | FFF · V1×2(S1)·V2×2(S2)·V3×3(S1) · dragon×4(match-S2) | flower(3)+num(S1,V1,2)+num(S2,V2,2)+num(S1,V3,3·jok)+drag(match-S2,4·jok) | consec(V1,V2,V3) | X25 |
| `cr-F` | V1×4 · FFFFFF · V2×4 (S1) | num(S1,V1,4·jok)+flower(6)+num(S1,V2,4·jok) | consec(V1,V2) | X30 |
| `cr-G-1s` | FF · V1×4·V2×4·V3×4 (S1) | flower(2)+num(S1,V1,4·jok)+num(S1,V2,4·jok)+num(S1,V3,4·jok) | consec(V1,V2,V3) | X25 |
| `cr-G-3s` | FF · V1×4(S1) · V2×4(S2) · V3×4(S3) | flower(2)+num(S1,V1,4·jok)+num(S2,V2,4·jok)+num(S3,V3,4·jok) | consec(V1,V2,V3) | X25 |
| `cr-H` | V1·V2×2·V3×3(S1) · V1·V2×2·V3×3(S2) · V4×2(S3) | num(S1,V1,1)+num(S1,V2,2)+num(S1,V3,3·jok)+num(S2,V1,1)+num(S2,V2,2)+num(S2,V3,3·jok)+num(S3,V4,2) | consec(V1,V2,V3,V4) | C35 |

---

#### 13579 — Odd Numbers

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `odd-A-1s` | 11·333·55·777·9999 (S1) | num(S1,1,2)+num(S1,3,3·jok)+num(S1,5,2)+num(S1,7,3·jok)+num(S1,9,4·jok) | — | X25 |
| `odd-A-3s` | 11·333(S1) · 55·777(S2) · 9999(S3) | num(S1,1,2)+num(S1,3,3·jok)+num(S2,5,2)+num(S2,7,3·jok)+num(S3,9,4·jok) | — | X25 |
| `odd-B-lo` | V1×3·V2×3(S1) · V2×4·V3×4(S2) where V1=1,V2=3,V3=5 | num(S1,1,3·jok)+num(S1,3,3·jok)+num(S2,3,4·jok)+num(S2,5,4·jok) | — | X25 |
| `odd-B-hi` | V1=5,V2=7,V3=9 variant of odd-B | num(S1,5,3·jok)+num(S1,7,3·jok)+num(S2,7,4·jok)+num(S2,9,4·jok) | — | X25 |
| `odd-C-lo` | NN · 1111·33·5555 · SS (S1) | wind(N,2)+num(S1,1,4·jok)+num(S1,3,2)+num(S1,5,4·jok)+wind(S,2) | — | X30 |
| `odd-C-hi` | NN · 5555·77·9999 · SS (S1) | wind(N,2)+num(S1,5,4·jok)+num(S1,7,2)+num(S1,9,4·jok)+wind(S,2) | — | X30 |
| `odd-D` | 1·1·3·5·7·9(S1) · V1×4(S2) · V1×4(S3) | num(S1,1,2)+num(S1,3,1)+num(S1,5,1)+num(S1,7,1)+num(S1,9,1)+num(S2,V1,4·jok)+num(S3,V1,4·jok) | V1∈{1,3,5,7,9} | X25 |
| `odd-E-lo` | FFF · 11·33·555 · DDDD(S1,match) | flower(3)+num(S1,1,2)+num(S1,3,2)+num(S1,5,3·jok)+drag(match-S1,4·jok) | — | X25 |
| `odd-E-hi` | FFF · 55·77·999 · DDDD(S1,match) | flower(3)+num(S1,5,2)+num(S1,7,2)+num(S1,9,3·jok)+drag(match-S1,4·jok) | — | X25 |
| `odd-F-lo` | 11·33(S1) · 111·333(S2) · 5555(S3) | num(S1,1,2)+num(S1,3,2)+num(S2,1,3·jok)+num(S2,3,3·jok)+num(S3,5,4·jok) | — | X25 |
| `odd-F-hi` | 55·77(S1) · 555·777(S2) · 9999(S3) | num(S1,5,2)+num(S1,7,2)+num(S2,5,3·jok)+num(S2,7,3·jok)+num(S3,9,4·jok) | — | X25 |
| `odd-G-1s` | 1111·33·55·77·9999 (S1) | num(S1,1,4·jok)+num(S1,3,2)+num(S1,5,2)+num(S1,7,2)+num(S1,9,4·jok) | — | X30 |
| `odd-G-2s` | 1111·9999(S1) · 33·55·77(S2) | num(S1,1,4·jok)+num(S2,3,2)+num(S2,5,2)+num(S2,7,2)+num(S1,9,4·jok) | — | X30 |
| `odd-H-lo` | FF · 11·33·55(S1) · 111(S2) · 111(S3) | flower(2)+num(S1,1,2)+num(S1,3,2)+num(S1,5,2)+num(S2,5,3·jok)+num(S3,5,3·jok) | — | C35 |
| `odd-H-hi` | FF · 55·77·99(S1) · 555(S2) · 555(S3) | flower(2)+num(S1,5,2)+num(S1,7,2)+num(S1,9,2)+num(S2,9,3·jok)+num(S3,9,3·jok) | — | C35 |
| `odd-I` | FF · 1·3·5·777·999(S1) · DDD(opp-S1) | flower(2)+num(S1,1,1)+num(S1,3,1)+num(S1,5,1)+num(S1,7,3·jok)+num(S1,9,3·jok)+drag(opp-S1,3·jok) | — | C30 |

---

#### Winds & Dragons (W&D)

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `wd-A-v1` | NNNN·EEE·WWW·SSSS | wind(N,4·jok)+wind(E,3·jok)+wind(W,3·jok)+wind(S,4·jok) | — | X25 |
| `wd-A-v2` | NNN·EEEE·WWWW·SSS | wind(N,3·jok)+wind(E,4·jok)+wind(W,4·jok)+wind(S,3·jok) | — | X25 |
| `wd-B` | 1·2·3·4(S1) · DDD(any) · DDD(any) · DDDD(any) | num(S1,1,1)+num(S1,2,1)+num(S1,3,1)+num(S1,4,1)+drag(any,3·jok)+drag(any,3·jok)+drag(any,4·jok) | — | X25 |
| `wd-C` | NNN · V1×4(S1) · V1×4(S2) · SSS (V1 odd) | wind(N,3·jok)+num(S1,V1,4·jok)+num(S2,V1,4·jok)+wind(S,3·jok) | V1∈{1,3,5,7,9} | X25 |
| `wd-D` | EEE · V1×4(S1) · V1×4(S2) · WWW (V1 even) | wind(E,3·jok)+num(S1,V1,4·jok)+num(S2,V1,4·jok)+wind(W,3·jok) | V1∈{2,4,6,8} | X25 |
| `wd-E` | FFF · NNNN · FFF · DDDD(any) | flower(3)+wind(N,4·jok)+flower(3)+drag(any,4·jok) | — | X25 |
| `wd-F` | 1·N·2·EE·3·WWW·4·SSSS (S1) | num(S1,1,1)+wind(N,1)+num(S1,2,1)+wind(E,2)+num(S1,3,1)+wind(W,3·jok)+num(S1,4,1)+wind(S,4·jok) | — | X25 |
| `wd-G-ns` | FF · NNNN·SSSS · DD(S1) · DD(S2) | flower(2)+wind(N,4·jok)+wind(S,4·jok)+drag(match-S1,2)+drag(match-S2,2) | — | X25 |
| `wd-G-ew` | FF · EEEE·WWWW · DD(S1) · DD(S2) | flower(2)+wind(E,4·jok)+wind(W,4·jok)+drag(match-S1,2)+drag(match-S2,2) | — | X25 |
| `wd-H` | NN·EEE · 2·0·2·6(S1) · WWW·SS | wind(N,2)+wind(E,3·jok)+num(S1,2,1)+drag(Soap,1)+num(S1,2,1)+num(S1,6,1)+wind(W,3·jok)+wind(S,2) | — | C30 |

---

#### 369

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `369-A-2s` | 333·666(S1) · 6666·9999(S2) | num(S1,3,3·jok)+num(S1,6,3·jok)+num(S2,6,4·jok)+num(S2,9,4·jok) | — | X25 |
| `369-A-3s` | 333·666(S1) · 6666(S2) · 9999(S3) | num(S1,3,3·jok)+num(S1,6,3·jok)+num(S2,6,4·jok)+num(S3,9,4·jok) | — | X25 |
| `369-B` | 33·66(S1) · 333·666(S2) · 9999(S3) | num(S1,3,2)+num(S1,6,2)+num(S2,3,3·jok)+num(S2,6,3·jok)+num(S3,9,4·jok) | — | X25 |
| `369-C-1s` | FFF · 33·666·99 · DDDD(S1,match) | flower(3)+num(S1,3,2)+num(S1,6,3·jok)+num(S1,9,2)+drag(match-S1,4·jok) | — | X25 |
| `369-C-2s` | FFF · 33·666·99(S1) · DDDD(opp-S1) | flower(3)+num(S1,3,2)+num(S1,6,3·jok)+num(S1,9,2)+drag(opp-S1,4·jok) | — | X25 |
| `369-D` | 33·66(S1) · 666·999(S2) · NEWS | num(S1,3,2)+num(S1,6,2)+num(S2,6,3·jok)+num(S2,9,3·jok)+wind(NEWS,4) | — | X30 |
| `369-E` | FF · 3·3·6·9(S1) · V1×4(S2) · V1×4(S3) | flower(2)+num(S1,3,2)+num(S1,6,1)+num(S1,9,1)+num(S2,V1,4·jok)+num(S3,V1,4·jok) | V1∈{3,6,9} | X25 |
| `369-F` | FF · 333·666·999(S1) · 3·6·9(S2) | flower(2)+num(S1,3,3·jok)+num(S1,6,3·jok)+num(S1,9,3·jok)+num(S2,3,1)+num(S2,6,1)+num(S2,9,1) | — | C30 |

---

#### Singles & Pairs (S&P) — All Concealed

| ID | Raw pattern | Groups | Constraints | Pts |
|----|-------------|--------|-------------|-----|
| `sp-A` | NN·EE·WW·SS · V1·D(S1) · V1·D(S2) · V1·D(S3) | wind(N,2)+wind(E,2)+wind(W,2)+wind(S,2)+num(S1,V1,1)+drag(match-S1,1)+num(S2,V1,1)+drag(match-S2,1)+num(S3,V1,1)+drag(match-S3,1) | — | C50 |
| `sp-B` | 2·4·66·88(S1) · 2·4·66·88(S2) · 88(S3) | num(S1,2,1)+num(S1,4,1)+num(S1,6,2)+num(S1,8,2)+num(S2,2,1)+num(S2,4,1)+num(S2,6,2)+num(S2,8,2)+num(S3,8,2) | — | C50 |
| `sp-C` | FF · 3·3·6·9(S1) · 3·6·6·9(S2) · 3·6·9·9(S3) | flower(2)+num(S1,3,2)+num(S1,6,1)+num(S1,9,1)+num(S2,3,1)+num(S2,6,2)+num(S2,9,1)+num(S3,3,1)+num(S3,6,1)+num(S3,9,2) | — | C50 |
| `sp-D` | V1×2·V2×2·V3×2·V4×2·V5×2·V6×2·V7×2 (S1) | num(S1,V1,2)×7 | consec(V1..V7) | C50 |
| `sp-E` | 11·357·99(S1) · 11·357·99(S2) | num(S1,1,2)+num(S1,3,1)+num(S1,5,1)+num(S1,7,1)+num(S1,9,2)+num(S2,1,2)+num(S2,3,1)+num(S2,5,1)+num(S2,7,1)+num(S2,9,2) | — | C50 |
| `sp-F` | FF · 2·0·2·6(S1) · 2·0·2·6(S2) · 2·0·2·6(S3) | flower(2)+num(S1,2,1)+drag(Soap,1)+num(S1,2,1)+num(S1,6,1)+num(S2,2,1)+drag(Soap,1)+num(S2,2,1)+num(S2,6,1)+num(S3,2,1)+drag(Soap,1)+num(S3,2,1)+num(S3,6,1) | — | C75 |

---

## Difficulty System & Bot Behavior Model

One difficulty setting applies to all bots in a game. Chosen at game creation.

### BotConfig — single config object per difficulty level

```typescript
interface BotConfig {
  targetPoolSize: number         // pick target from top-N closest hands (1=optimal)
  adaptFrequency: number         // re-evaluate targets every N draws (0=never)
  backupHandCount: number        // how many backup targets to maintain alongside primary
  errorRate: number              // 0–1 probability of making a random legal decision
  attachmentProb: number         // 0–1 probability of irrationally keeping a "special" tile
  avoidExposedFeeds: boolean     // skip discards matching an opponent's exposed pung/kong
  inferDangerFromDiscards: boolean // weight discards by opponent hoarding signals
}
```

| Level | Pool | Adapt | Backups | Error | Attachment | ExposedFeed | InferDanger |
|-------|------|-------|---------|-------|------------|-------------|-------------|
| Beginner | 15 | never | 0 | 35% | 30% | no | no |
| Easy | 8 | 6 draws | 1 | 20% | 15% | no | no |
| Moderate | 3 | 3 draws | 2 | 5% | 5% | yes | no |
| Difficult | 1 | 1 draw | 3 | 1% | 0% | yes | yes |

### How each lever produces human-like behavior

**targetPoolSize**: Beginners sometimes pick an unreachable hand and chase it. The bot picks randomly from the top-N closest hands rather than always the closest — larger pool = less accurate hand selection.

**adaptFrequency**: Beginners never update their target, mimicking the human tendency to get locked in on a hand and ignore mounting evidence against it. Higher skill = faster adaptation to new tile information.

**backupHandCount**: Low-skill players go all-in on one hand; experienced players always hedge. The bot tracks `backupHandCount` secondary targets and lets them influence discard/claim decisions when the primary target diverges significantly.

**errorRate**: Flat probability of substituting a random legal decision for the optimal one. Produces the occasional inexplicable discard or claim that makes bots feel human.

**attachmentProb**: When the bot is about to discard, this is the probability it will instead keep a "special" tile (joker, dragon, flower, or anything completing a pair in hand) even if the target hand doesn't need it — but only when doing so increases distance to primary target by ≤ 1. Beyond that threshold, even a biased human would let it go.

**avoidExposedFeeds**: Moderate+ bots check each candidate discard against all opponents' exposed sets. If an opponent has an exposed pung of 5-bam, the bot heavily penalizes discarding 5-bam (simple O(opponents × exposed_sets) check).

**inferDangerFromDiscards**: Difficult bots also track which suits/values each opponent has *never* discarded — interpreted as tiles they are collecting. Discarding into a void in an opponent's discard history is penalized proportionally to how deep the void is.

### What "target hand" means at each stage

Target selection and decision-making operate at three levels:

1. **Archetype** (`HandDef` template): what the bot selects during re-evaluation. E.g., "consecutive kongs in one suit." One of the ~50 defined patterns from the 2026 NMJL card.
2. **Best binding** (`VarBinding`): the variable resolution the algorithm finds for the chosen archetype given the bot's current tiles. E.g., S1=crak, V1=3. Computed automatically by `distanceTo`.
3. **Cached target** = archetype + binding stored together. Used for all decisions between re-evaluations. Ensures consistency: the bot won't claim a bam tile then discard bam because the binding recalculated mid-turn.

Re-evaluation (per `adaptFrequency`) can update both archetype and binding. Between re-evaluations the cached target is fixed.

### Where difficulty is stored
`game.botDifficulty: 'beginner' | 'easy' | 'moderate' | 'difficult'` — set at game creation, read by bot decision functions at runtime. Stored in Firebase alongside game state.

### Tile count correction
The deck contains **8 flowers**, making the full deck **152 tiles**. The existing `lib/tiles.ts` currently builds only 4 flowers — this is a bug that must be fixed as part of this feature.

### Compute management
- `scoreAllHands` is called only when the bot's hand changes (draw, Charleston receive, claim receive) — at most ~15× per game per bot
- Beginner never calls `scoreAllHands`; uses isolation heuristic only
- Between tile events the bot uses its cached target(s) for all decisions
- Win detection (`distanceTo` against cached target) is called after every draw/claim — cheap single-hand check

---

## Matching Algorithm

### New file: `lib/handMatching.ts`

#### Tile visibility snapshot

All scoring functions receive a `TileVisibility` snapshot describing what is known about the remaining live tiles. This is used to weight deficits by how reachable the needed tiles actually are.

```typescript
export interface TileVisibility {
  // All tiles discarded by any player (face-up, visible to all)
  discarded: Tile[]
  // All tiles in opponents' exposed sets (face-up, visible to all)
  opponentExposed: Tile[]
  // Total copies of each tile type in the full 152-tile deck (4 for most; 8 for flowers; 8 for jokers)
  deckCounts: Record<string, number>   // key = tileKey(suit, value)
}
```

#### Key functions

```typescript
// Weighted distance to complete a given hand (0.0 = Mahjong)
// Returns a float: raw deficit weighted by tile scarcity
export function distanceTo(
  hand: Tile[],
  exposed: ExposedSet[],
  def: HandDef,
  vis: TileVisibility
): number

// All hands scored and sorted ascending by weighted distance
export function scoreAllHands(
  hand: Tile[],
  exposed: ExposedSet[],
  vis: TileVisibility
): HandScore[]
```

#### Algorithm: `distanceTo`

1. **Collect tiles**: `allTiles = [...hand, ...exposed.flatMap(s => s.tiles)]`

2. **Build availability map**: for each tile type `k`:
   ```
   inHand[k]     = count of k in allTiles (non-joker)
   dead[k]       = count of k in vis.discarded + vis.opponentExposed
   available[k]  = deckCounts[k] - inHand[k] - dead[k]
   ```
   `available[k]` is the number of copies of tile `k` that could still be drawn or claimed. Clamped to ≥ 0.

3. **Tile scarcity weight**:
   ```
   weight(k, needCount) = sum over i in 1..needCount of:
     deckCounts[k] / max(1, available[k] - (i - 1))
   ```
   This accumulates the weight for each individual needed copy. The first copy needed is weighted by `total / available`; each subsequent copy needed assumes one fewer tile is left. If `available[k] = 0`, weight = `deckCounts[k]` (maximum scarcity, but not Infinity — Mahjong tiles can still come via joker substitution in some groups).

4. **Enumerate bindings**: generate all `VarBinding` combinations for variables present in `def.groups`:
   - Suit vars: ordered permutations of `{bam,crak,dot}` (S1≠S2≠S3 enforced by permutations, not combinations)
   - Value vars: cartesian product of `[1..9]`, filtered by any `in-set` or `consec` constraints before scoring
   - Max search space after constraint filtering: typically well under 500 valid bindings per hand

5. **Score each binding**:
   - If `def.concealed && exposed.length > 0` → skip (Infinity)
   - Build tile frequency map from `allTiles` (non-jokers only); count `jokerCount`
   - For each group resolved with the binding, greedily consume matching tiles from the frequency map
   - Accumulate `rawDeficit` per group (tiles still needed for that group)
   - Assign jokers to `jokerOk: true` groups with remaining deficit, one joker per deficit unit (greedy is optimal: each joker saves exactly 1 tile regardless of target group)
   - Compute `weightedScore = sum over each still-needed tile: weight(tileKey, 1)` — uses per-tile scarcity weight

6. Return `min(weightedScore across all bindings)`; break early if raw deficit = 0 (Mahjong, weight = 0.0)

#### Scarcity weight intuition

| Situation | available | weight per tile needed |
|-----------|-----------|----------------------|
| All 4 copies live | 4 | 4/4 = **1.0** (baseline) |
| 1 copy discarded | 3 | 4/3 ≈ **1.33** |
| 2 copies discarded | 2 | 4/2 = **2.0** |
| 3 copies discarded | 1 | 4/1 = **4.0** |
| All copies dead | 0 | 4/1 = **4.0** (still reachable via joker) |

A hand needing two dead tiles scores ~4× higher than the same hand with fully live tiles, naturally deprioritizing it during target selection without requiring special-case logic.

#### `tileKey` helper
```typescript
function tileKey(suit: string, value: string | number): string {
  return `${suit}|${value}`
}
```

---

## Updated Bot Logic

### Modified file: `lib/botLogic.ts`

All functions now receive `exposed: ExposedSet[]` and `vis: TileVisibility` (except `botPickExposeSet` which is unchanged). `TileVisibility` is built once per turn in `gameActions.ts` from the current Firebase state (discards + opponent exposed sets + deck counts) and passed down.

```typescript
// Pass 3 tiles during Charleston
// Strategy: for each candidate, compute total weighted-distance increase across top-3 targets if removed
// Tile with smallest increase is safest to pass; never pass jokers
export function botPickCharleston(hand: Tile[], exposed: ExposedSet[], vis: TileVisibility): Tile[]

// Discard the tile whose removal minimally increases weighted distance to best target
// Jokers never discarded
export function botPickDiscard(hand: Tile[], exposed: ExposedSet[], vis: TileVisibility): Tile

// Claim logic — now returns 'mahjong' | 'kong' | 'pung' | null
// 'mahjong': simulate adding discardTile, check if distance = 0 for any hand
// 'kong'/'pung': only claim if weighted distance strictly decreases after expose
// Cannot claim jokers (NMJL rule)
export function botDecideClaim(
  hand: Tile[], exposed: ExposedSet[], discardTile: Tile, vis: TileVisibility
): 'mahjong' | 'kong' | 'pung' | null

// Unchanged
export function botPickExposeSet(hand: Tile[], discardTile: Tile, claimType: 'pung'|'kong'): Tile[]

// New: returns true if any hand definition has distance = 0
export function botCheckWin(hand: Tile[], exposed: ExposedSet[]): boolean
```

**Fallback**: If all hands have distance = Infinity (no useful tiles at all), both `botPickCharleston` and `botPickDiscard` fall back to the original isolation-score heuristic.

---

## Changes in `gameActions.ts`

### `botTakeTurn` — win check after drawing
After drawing the tile and before discarding:
```
newHand = [...player.hand, drawnTile]
if botCheckWin(newHand, exposed):
  write wallIndex++ and newHand to Firebase
  call declareMahjong(gameId, botId)
  return
```

### `botClaimAndDiscard` — mahjong path + win check after claim
Return type changes from `Promise<boolean>` to `Promise<boolean | 'mahjong'>`.

```
claimType = botDecideClaim(hand, exposed, discardTile)
if claimType === 'mahjong':
  claimDiscard(gameId, botId, 'mahjong', [], discardedTile)
  return 'mahjong'
// ... existing pung/kong claim ...
// After claim resolves, re-fetch state and check:
if botCheckWin(newHand, newExposed):
  declareMahjong(gameId, botId)
  return 'mahjong'
// ... existing discard logic ...
```

### Updated call in `page.tsx`
```
// botPickCharleston call: add exposed argument
const selection = botPickCharleston(p.hand, p.exposedSets ?? [])
```
The `botClaimAndDiscard` callers in page.tsx don't need changes — `declareMahjong` is called internally.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `types/handDefs.ts` | **Create** — GroupSpec, HandDef, VarBinding, HandScore types |
| `lib/handDefs.ts` | **Create** — `ALL_HAND_DEFS` array (25 HandDef objects) |
| `lib/handMatching.ts` | **Create** — `distanceTo`, `scoreAllHands`, internal helpers |
| `lib/botLogic.ts` | **Modify** — new signatures, import handMatching, add `botCheckWin` |
| `lib/gameActions.ts` | **Modify** — win checks in `botTakeTurn` + `botClaimAndDiscard` |
| `app/game/[gameId]/page.tsx` | **Modify** — pass `exposed` to `botPickCharleston` (one line) |

---

## Verification

1. **Unit correctness**: Build the exact tiles for `year-A` → `distanceTo` returns 0.0. Replace one tile with a joker → still 0.0. Remove two tiles → weighted score > 0.
2. **Pair joker rule**: Hand with 1 natural tile for a required pair + 1 joker → distance > 0 (joker can't fill a pair).
3. **Concealed hand blocked**: Give player an exposed set + a concealed hand def → distance = Infinity.
4. **Dead tile penalty**: Build a hand needing one 3-bam; set all three remaining 3-bam as dead in `vis`. Score should be ~4× higher than the same hand with all 3-bam live.
5. **Scarcity comparison**: Two hands each 1 tile away — one needs a live tile (available=4), the other needs a mostly-dead tile (available=1). The live-tile hand scores lower and gets picked as the target.
6. **Bot declares Mahjong**: In a solo game (3 bots), let it run. Eventually `game.status === 'finished'` and `game.winner` is a bot ID.
7. **Performance**: `scoreAllHands` on a random hand runs in < 10 ms across all ~50 hand defs with constraint filtering reducing binding space.

---

## Collaboration — mahjong-learning repo

A separate repo was created for independent development with Julie Engelman (mom):

- **Repo**: https://github.com/engelmae/mahjong-learning
- **Collaborator**: juliesengelman@gmail.com (invite sent, pending acceptance)
- **Seeded from**: `engelmae/vball` at v35.3 via `git subtree push --prefix=mahjong-app`

### How it was set up
```bash
# From a local clone of engelmae/vball
git subtree push --prefix=mahjong-app https://github.com/engelmae/mahjong-learning.git main
```
This pushed just the `mahjong-app` subdirectory (with full git history) as the root of the new repo.

### What mom needs to get started
1. Accept the GitHub collaborator invite (email from GitHub)
2. Install Claude Code at claude.ai/code (requires Pro plan or higher)
3. Clone the repo: `git clone https://github.com/engelmae/mahjong-learning.git`
4. Get the `.env.local` Firebase credentials from Eric (file is gitignored — not in repo)

### Firebase
Share Eric's existing `.env.local` so both developers connect to the same Firebase project and can test with shared game data. The file contains:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

### Workflow
- Each person works in their own Claude Code session on the `mahjong-learning` repo
- Use feature branches + pull requests to review changes before merging to `main`
- `mahjong-learning` develops independently from `engelmae/vball` going forward
