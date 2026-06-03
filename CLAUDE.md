# Island of Life — Game Design Document

## Project overview

A browser-based god simulation game built as a high school biology final project. The player is a supernatural being who watches a living ecosystem form on an island, then intervenes using a gene editor to trigger mutations, helping species adapt and survive.

The game must demonstrate understanding of **Evolution**, **Ecology**, and **DNA** (at least 15 specific biology concepts total), with clear connections between all three topics.

---

## Tech stack

- **React + Vite** (`vite@4`, Node 18 compatible)
- Dev server: `npm run dev` → `http://localhost:5173`
- Backend: `node server/index.js` → `http://localhost:3001` (express-session, better-sqlite3)
- No TypeScript — plain JSX throughout

---

## Current build status — everything that exists and works

### Layout & UI shell
- Multi-page app: Auth → Islands list → Create Island → Game (`/game/:id`)
- Game screen: full-bleed island canvas + floating header + draggable/resizable floating windows
- **Tabs**: ⏱ Time · 📋 Events · 🌍 Ecosystem · ⚗️ Interventions · 🐾 Species · 🧬 Gene Lab
- Warm pastel parchment palette (`--color-bg: #f4efe5`); Press Start 2P pixel font throughout

### Island canvas
- Main island PNG rendered to offscreen cache; no per-frame pixel ops
- **Wetland disabled** (`WETLAND_ENABLED = false` in IslandCanvas.jsx) — all code and assets preserved, flip to `true` to restore as a progression unlock. Mangrove tree sprites are also gated by this flag.
- Biome mask PNG drives `biomeAt(x, y)` — `forest`, `plains`, `highland`, `mountain`, `pond`, `beach`, `ocean`, `outside`
- Pan + zoom via scroll/drag; scale clamped 0.02–16×

### Individual-Based Model (IBM)
- `posMapRef` (a `Map<id, entry>`) is the single source of truth for every living agent
- Agent entry shape: `{ x, y, vx, vy, spId, gender, variation, state, targetId, homeTreeId, breedTreeId, hunger, age, cooldowns, carriers }`
- RAF loop runs `stepMovement()` every frame

**Target-based eating** — agents lock a `targetId` onto a specific prey item and must physically reach it (`d < EAT_DISTANCE`) to eat. No phantom eating across the map. If the target is consumed by someone else, the agent re-acquires.

**State machine**: `wander → flee / hunt → eat → wander`
- Predator proximity overrides hunt and clears any target
- Prey scan uses awareness zone (circle for most, cone for hawk/monitor)

**Reasoning gene drives two things:**
1. *Target selection* — high reasoning picks the prey with best energy-gain/distance ratio (optimal foraging); low reasoning picks randomly
2. *Path quality* — high reasoning beelines toward target; low reasoning adds up to ±63° path noise per frame

**Water avoidance** — `inWater` check fires before all other logic; clears target, sets 2.5× urgency toward species home position. Separation force is skipped while recovering.

**Separation force** — deer and boar have personal space (`SEPARATION_SPACE`). Juveniles use 25% of adult space (stay near parents). Applied directly to `ax/ay` so it works in all states. Skipped in water.

**Smart target acquisition** — high-reasoning animals avoid picking targets already being chased by herd mates, preventing pile-ups on the same prey.

**Deer herd cohesion** — bonds to 2 herd mates; attraction kicks in at 130–400 units (was 50–200); no clumping because separation force provides repulsion.

### Hawk soaring + dive (special IBM branch)
Hawks bypass standard IBM movement entirely:
- **Soaring**: orbit in a wide ellipse around their home hotspot when wandering
- **Dive**: 2.2× speed straight beeline when target locked; slightly larger eat radius
- Breed with 3× mate detection range; offspring spawn with an orbit phase already set

### Beetle lifecycle (tree-based)
Beetles live on trees, not the ground:
- Each beetle has a `homeTreeId` — the tree they live on
- When wandering, they return to their home tree; when `breedTreeId` is set, they travel to a *different* tree to lay eggs
- **Asexual egg-laying**: when well-fed and cooldown = 0, beetle acquires a nearby tree as `breedTreeId`, travels to it, and lays 2–4 eggs at that tree's position; each larva hatches with `homeTreeId` = that tree
- No sexual breeding for beetles — replaced with bark-beetle egg-laying model
- `beetlesPerTree` map is precomputed once per frame for O(1) per-beetle lookup

### Ecosystem connections (K and habitat)
Every species is now tied to a specific ecological dependency:

| Species | Tied to |
|---|---|
| Grass | Nutrient return from fungi (0.45×, up from 0.30) — more fungi = faster regrowth |
| Fungi | Dead matter — more animal deaths = more fungi = faster nutrient cycle |
| Beetles | Hard-capped at `numTrees × BEETLES_PER_TREE (4)`. Overcrowding on one tree drains extra hunger |
| Deer | Grass minus boar competition — each boar removes 0.4 units of deer-accessible grass |
| Boar | Grass + tree + beetle (omnivore), now competing with deer for grass |
| Frog | Must be in a water/pond biome to breed; offspring spawn tight (8 units) near water |
| Monitor | Frog + beetle K combined — beetle crash → monitor starvation |
| Hawk | Deer + frog; apex with low K=10 |

**Dynamic effective K** (per frame): `baseK × foodRatio × seasonMultiplier`. Food ratio uses `FOOD_K_FACTOR` optimal counts. Crowding (>80% of K) increases hunger drain.

### Species arrival schedule
Sequential: tree → grass → fungi → beetle → deer → frog → boar → monitor → hawk.
Each arrives when the previous one is established. Thresholds updated for new grass K=4000:
- Grass: 30 trees in posMap
- Fungi: grass ≥ 800 (was 200)
- Beetle: fungi ≥ 90 (was 70)

**Race condition fix**: `arrivedRef.current.add(spId)` is now called synchronously before the `setTimeout(() => spawnArrival(...))`, preventing double-spawns at high timewarp.

### Carrying capacity & food web
- `CARRYING_CAPACITY` (animals): beetle 300, deer 60, frog 50, hawk 10, boar 30, monitor 18
- `K` (producers): grass 4000, tree 100, fungi 160
- `FOOD_K_FACTOR` maps each animal to food sources and optimal counts
- `SEASON_K_FACTOR`: Spring 1.15× / Summer 1.0× / Autumn 0.8× / Winter 0.5×
- **Monitor hunts boar** — monitor is the only check on boar population; arrows shown in food web SVG

### Simulation engine (engine.js)
- Tick loop driven by `useSimulation` at selected speed
- `pressure` field increments each quiet tick; resets when an event fires — feeds EventsPanel warning
- Fungi decomposition: `FUNGI_EAT=0.15`, `NUTRIENT_RETURN=0.45`, `NUTRIENT_BOOST=0.65`
- 6 environmental events with full overseer narration and biology concept tags

### Genetics & mutation injection
- Every agent carries `variation: { 9 stats }` — continuous deltas (initial spread ±12)
- `sexualOffspring` → child variation = average of parents + noise (±4 per stat)
- `asexualOffspring` → used by plants and beetles; child = parent + noise
- Mutation injection: `injectMutation(spId, deltas, count)` tags carrier agents with `mutId`
- **Genetic diversity index** — variance of variation stats per species, tracked each tick via `diversityRef`
- **Inbreeding penalty**: low diversity → up to +60% random death rate per tick in IBM
- Diversity index displayed as coloured bars in GeneticsPanel (green/yellow/red)
- Mutation frequency tracked per `mutId` as % of species carrying it; shown in GeneticsPanel with SVG chart + trend label + "Show on map" carrier highlight

### Population history & charts
- `popHistoryRef` samples all species pops each engine tick (max 80 samples)
- **PopulationPanel** (inside Ecosystem window): two stacked SVG line charts — Producers+Decomposer and Consumers — both showing % of carrying capacity K. K reference line at 100%. Current count bars below.

### Food web diagram
- SVG diagram in EcosystemPanel replacing old CSS grid
- Nodes positioned by trophic level: Apex → Secondary → Primary → Producer → Decomposer
- Arrows from prey to predator (energy flow). Frog→Monitor and Boar→Monitor use curved arcs to avoid overlap
- Node states: colored+pop when alive, faded when not yet arrived, ✕ when extinct
- Arrows go dashed when a connected species is extinct

### Tutorial system
13-step interactive tutorial with spotlight overlays, typewriter narrator, and completion conditions. Teaches: island navigation, the corrupted tree DNA scenario, codon editing, mutation injection, time controls, events panel.

### Overseer narrator
Popup character delivers arrivals and events with: typewriter text, mouth-open/closed animation, three sprite poses (friendly/neutral/threat), skip and dismiss.

### Ecosystem health score + game over
- `computeHealthScore(pops, arrivedSpecies)` — average of per-species health (0/20/60/100 based on % of K)
- Displayed as `♥ N` badge in header (green ≥70, yellow 40–69, pulsing red <40)
- **Game over**: score < 10 for 5+ consecutive ticks OR hawk extinct for 3+ consecutive ticks
- `GameOverOverlay` shows narrator threat sprite with reason + final score + year
- Streak counters reset when ⚡ (dev world) is pressed

### Interventions panel (⚗️ tab)
- Introduce N individuals: costs `N × speciesCost` dead matter (trophic-scaled: grass=2, beetle=8, deer/frog/boar=20, monitor=35, hawk=60)
- Cull N individuals: refunds 50% of their cost as dead matter
- Dead matter bar shows current biomatter budget
- Buttons disabled when insufficient biomatter or insufficient population

### Events panel (📋 tab)
- **Next arrival** progress bar with trigger condition
- **Active event** with concept badge and ticks remaining
- **Event pressure warning**: rises between events; yellow at 50%, pulsing red at 80%
- **Recent Deaths**: cause-of-death log (starvation / predation / age / inbreeding) per species per tick
- **Event History**: log of past environmental events

### Dev world (⚡ button)
- Clears posMap safely (copy-then-delete, no RAF race)
- Places 350 trees: extremely dense in forest/dense_veg (1 × ISLAND_SCALE min spacing), sparse on plains (3%), rare on highland (10%)
- Animals placed in biome-preferred positions; beetles spawn ON tree positions with homeTreeId assigned
- Sets: grass=2800, fungi=125, deadMatter=90, nutrients=30, year=23
- Resets gameOver, lowScoreStreak, and hawkExtinctStreak before populating

---

## Key file map

```
src/
  main.jsx
  App.jsx                        ← layout, health score, game over, window management
  styles/
    global.css                   ← CSS variables, .pixel-box, .pixel-btn, .concept-badge
    App.css                      ← app-shell, gene-panel-split layout
  components/
    Header.jsx/css               ← tabs, health score badge, dev world button
    IslandCanvas.jsx/css         ← WETLAND_ENABLED flag, IBM, RAF loop, hawk soar/dive,
                                    beetle home-tree + egg-laying, separation, water recovery
    GeneEditor.jsx/css           ← codon editor, inject panel
    GeneticsPanel.jsx/css        ← mutation frequency charts, diversity index bars
    SpeciesList.jsx/css          ← accordion species rows
    EcosystemPanel.jsx/css       ← food web SVG diagram, event banner, pop bars
    PopulationPanel.jsx/css      ← SVG % of K line charts, count bars
    EventsPanel.jsx/css          ← next arrival, pressure warning, death log, event history
    InterventionPanel.jsx/css    ← introduce/cull with biomatter cost
    FloatingWindow.jsx/css       ← draggable/resizable window shell
    TutorialWindow.jsx/css       ← tutorial steps
    OverseerPopup.jsx/css        ← narrator popup
    GameOverOverlay.jsx/css      ← game over screen
    SpotlightOverlay.jsx         ← tutorial spotlight
    IndividualCard.jsx/css       ← individual agent info card
    AnimalsPanel.jsx/css         ← animal detail display
  simulation/
    agentConfig.js               ← AWARENESS, HUNGER_RATE, HUNGER_GAIN, EAT_DISTANCE,
                                    MATE_DISTANCE, BREED_COOLDOWN, LIFESPAN,
                                    CARRYING_CAPACITY, FOOD_K_FACTOR, SEASON_K_FACTOR,
                                    PREY_OF, PREDATORS_OF, effectiveRadius(),
                                    FROG_WATER_BIOMES, FROG_DESICCATION_DRAIN,
                                    BEETLE_FOREST_BIOMES, BEETLE_FOREST_DRAIN,
                                    TREE_ADULT_AGE, TREE_SEED_RADIUS_BASE (110×S),
                                    TREE_SEED_DROP_CHANCE, TREE_MIN_DISTANCE,
                                    TREE_BIOME_GERMINATION, BEETLES_PER_TREE,
                                    SEPARATION_SPACE
    arrivalConfig.js             ← ARRIVAL_SCHEDULE (readyWhen triggers), ARRIVAL_HOME
                                    (frog/monitor relocated to main island)
    individuals.js               ← variation system, sexualOffspring, asexualOffspring,
                                    initIndividuals, spawnIndividuals, effectiveStats,
                                    averageStats, BREEDING_TICKS, SEASONS, getSeason,
                                    isBreeding
    worldConfig.js               ← ISLAND_SCALE = 5
    engine.js                    ← tick loop, logistic growth, events, year counter,
                                    pressure field, FUNGI_EAT/NUTRIENT_RETURN/NUTRIENT_BOOST
    useSimulation.js             ← React hook: bridges engine + canvas, arrival logic,
                                    posMapRef, popsRef, biomeAtRef, popHistory,
                                    variationHistory, mutationRegistry, mutationFreqHistory,
                                    diversityRef, deathLogRef, introduceSpecies, cullSpecies,
                                    INTRODUCE_COST, placeGrass(), placeFungi() (island-wide scatter)
  data/
    species.js                   ← SPECIES array (9 species, base stats, per-trait DNA)
    codons.js                    ← CODONS table (19 codons), STAT_GROUPS, STAT_KEYS,
                                    NEUTRAL_CODONS, applyDNA()
    biomes.js                    ← biome colour/name definitions
    presets.js                   ← island preset configurations
    tutorialSteps.js             ← 13-step tutorial definition
  pages/
    AuthPage.jsx/css
    IslandsPage.jsx/css
    CreateIslandPage.jsx/css
  context/
    AuthContext.jsx
  utils/
    islandRenderer.js
  assets/
    biomes/                      ← island_visual_hires.png, island_biome_mask.png,
                                    wetland_visual_hires.png (kept, gated by WETLAND_ENABLED),
                                    wetland_biome_mask.png (kept, gated)
    sprites/
      adult/                     ← beetle, deer_male/female, frog, hawk, boar, monitor
      juvenile/                  ← beetle_baby, deer_fawn, hawk_juvenile, boar/monitor juv
      flora/                     ← fig_tree, tree_sapling, grass_clump, mushroom,
                                    mangrove_wetland, mangrove_sapling (gated by WETLAND_ENABLED)
      narrator/                  ← pose_friendly, pose_neutral, pose_threat
```

---

## Key data structures

```js
// posMapRef entry (every living agent)
{
  x, y,              // world position (pixels × ISLAND_SCALE)
  vx, vy,            // velocity
  spId,              // species id string
  gender,            // 'M' | 'F' | null
  variation,         // { speed, resilience, metabolism, ... } — continuous deltas
  state,             // 'wander' | 'flee' | 'hunt'
  targetId,          // id of prey being chased (food)
  homeTreeId,        // beetles: id of their home tree
  breedTreeId,       // beetles: id of tree they are travelling to for egg-laying
  orbitPhase,        // hawks: current orbit angle (radians)
  bonds,             // deer: array of herd mate ids
  carriers,          // Set of mutIds this agent carries
  hunger,            // 0–100; 0 = starvation death
  age,               // frames lived
  cooldowns,         // { breed: framesRemaining }
}
```

---

## Colour palette

- `--color-bg: #f4efe5` / `--color-panel-bg: #ece5d8` / `--color-panel-dark: #e2d8c8`
- `--color-border: #b89470` / `--color-accent: #b87040` / `--color-accent2: #5a9068`
- `--color-text: #3c3028` / `--color-text-dim: #7a6858`

---

## Core gameplay loop

1. Island starts with trees only. Species arrive sequentially as the ecosystem matures.
2. The ecosystem forms — predator/prey relationships, food webs, and population dynamics in real time.
3. Environmental events periodically threaten the balance; **pressure warning** rises before each event.
4. The player uses the **Gene Lab** to design mutations and inject them into individuals.
5. The **Genetics panel** tracks how mutations spread through the population over generations, and shows genetic diversity per species.
6. Use **Interventions** (⚗️) to spend dead matter introducing endangered species or culling invasives.
7. Keep the **health score** (♥) green. Hawk extinction or total ecosystem collapse ends the game.

---

## Biology concepts covered (minimum 15)

**Evolution**
1. Natural selection — agents with better traits survive predation/starvation/events
2. Mutation — gene editor changes codons → trait changes → survival pressure
3. Adaptation — player-driven mutations help species survive environmental events
4. Fitness — each species shows a fitness score (average of all stats)
5. Genetic drift — small populations have random variation shifts each generation
6. Bottleneck effect — wildfire/disease events cause sharp population drops
7. Allele frequency — genetics panel tracks how a mutation spreads through the gene pool
8. Inbreeding depression — low genetic diversity increases death rate (shown as diversity index)

**Ecology**
9. Trophic levels — food web: producers → primary → secondary → apex
10. Predator-prey relationships — hawk/deer/frog/monitor populations oscillate dynamically
11. Carrying capacity — dynamic K scaled by food availability, season, and habitat (trees for beetles, water for frogs)
12. Limiting factors — food, space, season, habitat type constrain population growth
13. Symbiotic relationships — fungi (decomposer) recycles nutrients for producers
14. Autotrophs vs. heterotrophs — grass/tree produce energy; all animals consume it
15. Matter and energy flow — energy moves up trophic levels; decomposer loop closes the cycle
16. Resource competition — deer and boar share grass; beetles compete for tree colonies
17. Habitat dependency — beetles live on trees, frogs breed in water, beetles desiccate outside forest

**DNA**
18. DNA base pairs — A/T/G/C shown in gene editor
19. Codons — every 3 bases = one codon = one trait instruction
20. Mutation types — point mutations (single base change) produce different codons
21. Gene expression — codon → modifier → effective stat → observable phenotype
22. Inheritance — sexual: offspring = average of parents + noise; asexual (beetles): parent + noise

---

## Not yet built (future additions)

1. **Wetland island (level 2)** — code and assets preserved; unlock after first island is fully populated. Flip `WETLAND_ENABLED = true`. Frogs and monitors currently relocated to main island.
2. **Dynamic food web diagram** — SVG exists but does not yet animate population flux
3. **Population graph** — SVG charts exist; Chart.js version deferred
4. **Rationale + reflection + works cited pages**

---

## Deliverables status

- [x] Playable shell in the browser
- [x] 9 species with base stats and per-trait DNA
- [x] Real-time speed control (pause / watch / timewarp 1×–10×)
- [x] Functional gene editor — codon editing, live stats, phenotype display
- [x] Mutation injection + genetics tracking panel with frequency charts
- [x] Genetic diversity index + inbreeding death penalty
- [x] Species list with expandable stat panels
- [x] IBM with state machine, hunger, aging, death, cause-of-death logging
- [x] Target-based eating (must reach prey's coordinates)
- [x] Reasoning gene drives target selection + path quality
- [x] Beetle tree-based lifecycle (home tree, egg-laying, tree-capped K)
- [x] Hawk soaring + dive behaviour
- [x] Frog water-dependent breeding
- [x] Deer/boar grass competition
- [x] Separation force (no piling), water recovery
- [x] Ecosystem-triggered species arrival schedule
- [x] Dynamic carrying capacity (food × season × habitat)
- [x] Environmental events with full overseer narration + pressure warnings
- [x] Population history charts (% of K, two panels)
- [x] Food web SVG diagram with energy flow arrows
- [x] Ecosystem health score badge + game-over overlay
- [x] Interventions panel (introduce/cull with biomatter cost)
- [x] Cause-of-death log in events panel
- [x] Dev world (⚡) — dense forest, biome-aware animals, year 23
- [x] `/showcase` route — split-screen card grid with warm game palette
- [x] Sticky category tabs, species highlight rings, sparkline widgets, trial buttons
- [ ] Wetland island unlock (code preserved, WETLAND_ENABLED = false)
- [ ] Showcase scene mode (IN PROGRESS — see plan below)
- [ ] Rationale + reflection + works cited pages

---

## Showcase page — current state

Route: `/showcase` (also reachable via "CLICK THIS IF YOU ARE MR. FOSTER" button on CreateIslandPage)

**Files:**
- `src/pages/ShowcasePage.jsx` — main component
- `src/pages/ShowcasePage.css` — styles (warm game palette, NOT dark)

**Current layout:** split-screen. Left 42% = live simulation. Right 58% = scrollable card panel.

**Card panel features:**
- 22 cards across 5 categories: Evolution, Ecology, Genetics & DNA, Code & Systems, Project
- Sticky category tabs at top of panel (click to scroll to section)
- Each card shows title + teaser when collapsed; click to expand
- Expanded card shows: body text (student's writing), "How it's coded" section, optional trial button(s), optional live formula widget (KWidget / NutrientWidget / DiversityWidget), optional SparklineWidget
- Trial buttons call `sim.triggerEvent(eventId)` — disabled while an event is active or already fired
- SparklineWidget draws a multi-line canvas chart from `sim.popHistory`

**Species highlight:** when a card is expanded, `highlightSpecies` prop is passed to IslandCanvas which draws a pulsing green ring (#5a9068) around all agents of that species. This required adding `highlightSpecies` prop + `highlightSpeciesRef` + `highlightSpId` param to `drawSpritesFromMap` in IslandCanvas.jsx (lines ~1195–1253, ~1297, ~1316–1317, ~1557).

**Card fields:**
```js
{
  id, cat, title, teaser, body, code,
  highlight,   // string | undefined — species spId to highlight when expanded
  sparklines,  // string[] | undefined — species to show in SparklineWidget
  trialBtns,   // [{label, event}] | undefined — event buttons
  formula,     // 'k' | 'nutrients' | 'diversity' | undefined
}
```

---

## Showcase scene mode — NEXT BUILD (IN PROGRESS)

### What we're building

When Mr. Foster clicks a card, it transitions to **scene mode**:
- Grid panel hides completely; simulation goes full-screen
- The overseer FloatingWindow appears over the simulation (same component as TeacherModePage)
- Each card has its own **mini-walkthrough**: a sequence of 2–5 acts specific to that topic
- The overseer steps through each act with typewriter effect, mouth animation, and pose changes
- Each act can reconfigure the simulation (trigger events, adjust stats, focus viewport)
- A canvas overlay draws live annotations per-act (bond lines, chase arrows, heat-split colors, etc.)
- Back/Next steps through the card's acts. On the final act, "Done" returns to the grid
- "Back to cards" exits at any point

**This means each card is a self-contained deep-dive**, not a single recitation. IBM gets acts on: what an IBM is, herd bonds, reasoning gene, separation force. Natural selection gets acts on: the mechanism, cold snap live demo, watching the population shift. Etc.

### Architecture

**New state in ShowcasePage:**
```js
const [mode, setMode] = useState('grid')  // 'grid' | 'scene'
const [sceneCardId, setSceneCardId] = useState(null)  // which card is open
const [actIdx, setActIdx] = useState(0)               // which act within the card
const [charCount, setCharCount] = useState(0)
const [isTyping, setIsTyping] = useState(false)
const [mouthOpen, setMouthOpen] = useState(false)
const [spriteOverride, setSpriteOverride] = useState(null)
```

**Card data structure (updated):**
```js
{
  id, cat, title, teaser, body, code,  // grid card fields (unchanged)
  highlight, sparklines, trialBtns,    // grid card features (unchanged)
  acts: [                              // NEW: scene-mode mini-walkthrough
    {
      title:    string,                // act title shown in overseer window
      sprite:   'friendly' | 'neutral' | 'threat',
      body:     string,                // narration text (supports [[pose]] tags)
      onEnter:  (posMap, sim, setSpeed) => void,  // optional posMap surgery
      overlay:  string | null,         // which overlay to draw (see SceneOverlay)
      formula:  'k' | 'nutrients' | 'diversity' | null,
      trialBtn: { label, event } | null,
    },
    // ... 2–5 acts per card
  ]
}
```

**enterScene(cardId):**
1. `sim.initDevWorld()` — reset to clean full ecosystem
2. Wait for world loaded (biomeAtRef check), then run first act's `onEnter`
3. Set `mode = 'scene'`, `sceneCardId = cardId`, `actIdx = 0`
4. Start typewriter on act 0's body

**goNext():** if actIdx < acts.length - 1: actIdx++, run new act's onEnter, restart typewriter. If on last act: exitScene().

**goPrev():** actIdx > 0: actIdx--, restart typewriter. If actIdx = 0: exitScene().

**exitScene():** `mode = 'grid'`, `sceneCardId = null`, `actIdx = 0`. Does NOT reset the simulation — it keeps running.

**Overseer window:** reuse `FloatingWindow` from TeacherModePage. Import narrator images from `src/assets/sprites/narrator/`. Reuse `parseBody()` function for `[[friendly]]`/`[[neutral]]`/`[[threat]]` mid-text pose changes. Window positioned bottom-left over the simulation.

**Overlay canvas:** a `<canvas>` element absolutely positioned over `.sc__sim` (z-index 10, pointer-events none). RAF loop reads `posMapRef.current` + `vpRef.current` each frame and draws the active act's annotations. `vpRef` must be exposed from IslandCanvas (see below).

### Example act sequences per card

**IBM/Herds (3 acts):**
- Act 1: "What is an IBM?" — explain that each animal is its own agent, no central controller. `onEnter`: boost deer reasoning + speed, relocate hawks. Overlay: ibm-cones (awareness circles around deer).
- Act 2: "Herd cohesion" — explain the bond system. Overlay: ibm-bonds (lines between bonded deer pairs). No new onEnter.
- Act 3: "Reasoning gene" — explain how high reasoning = clean paths, low reasoning = noisy wander. `onEnter`: split deer into high/low reasoning halves so difference is visible. Overlay: ibm-cones.

**Natural Selection (3 acts):**
- Act 1: "The mechanism" — explain variation + survival + reproduction. Speed 2×, highlight beetles.
- Act 2: "Live selection pressure" — `onEnter`: split beetles by heatTolerance, trigger cold snap. Overlay: heat-split (red/blue beetles). Speed 2×.
- Act 3: "The population shifts" — narrate what happened. Show SparklineWidget for beetles. Speed 3×.

**Predator-Prey (3 acts):**
- Act 1: "The cycle" — explain predator-prey oscillation. Speed 1×, highlight hawks.
- Act 2: "Watch the hunt" — `onEnter`: teleport hawk near deer, boost hawk speed + hunger. Overlay: predator-chase (line from hawk to target). Speed 1×.
- Act 3: "The oscillation" — narrate the boom-bust cycle. Speed 3×, show sparkline for deer + hawk.

**Carrying Capacity (2 acts):**
- Act 1: "The formula" — explain effectiveK. `onEnter`: inflate deer to 55. Speed 3×. KWidget live formula.
- Act 2: "Watch it cap" — narrate as deer hit K and growth stalls. Speed 3×, sparkline for deer.

**All other cards:** 2 acts minimum. Act 1 explains the concept using the student's writing. Act 2 shows it live with a relevant trigger or highlight.

### Per-scene `onEnter` configurations (the "cheats")

Each `onEnter(posMap, sim, setSpeed)` directly mutates posMap agents or calls sim methods before narration starts.

**`'ibm-movement'`** (overlay: `'ibm-bonds'`)
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(1)
  // Boost all deer: cleaner reasoning, visible speed
  for (const [, e] of posMap) {
    if (e.spId !== 'deer') continue
    e.variation.reasoning = Math.max(e.variation.reasoning ?? 0, 30)
    e.variation.speed     = Math.max(e.variation.speed ?? 0, 20)
  }
  // Relocate all hawks to highland (top of map) so they don't disrupt the demo
  for (const [, e] of posMap) {
    if (e.spId === 'hawk') { e.x = 370 * ISLAND_SCALE; e.y = 80 * ISLAND_SCALE }
  }
  // Force herd bonds on every deer (pick 2 nearest)
  // (bond assignment: collect deer ids, for each deer find 2 nearest, set e.bonds)
}
viewportFocus: { x: 630, y: 390, zoom: 3 }  // plains deer area
sprite: 'friendly'
overlay: 'ibm-bonds'  // draws bond lines between bonded deer pairs + awareness circles
```

**`'natural-selection'`** (overlay: `'heat-split'`)
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(2)
  // Split beetles: half get heatTolerance -40, half get +40
  const beetles = [...posMap.entries()].filter(([,e]) => e.spId === 'beetle')
  beetles.forEach(([,e], i) => {
    e.variation.heatTolerance = i < beetles.length / 2 ? -40 : 40
  })
  sim.triggerEvent('cold_snap')
}
sprite: 'neutral'
overlay: 'heat-split'  // color beetles red (low tolerance) / blue (high tolerance)
```

**`'drift-bottleneck'`**
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(3)
  // Inflate deer to ~50 before the crash
  // (spawn additional deer up to count 50 using spawnIndividuals + posMap.set)
  sim.triggerEvent('wildfire')
}
sprite: 'threat'
overlay: null
```

**`'predator-prey'`** (overlay: `'predator-chase'`)
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(1)
  // Find one hawk, give it high speed, teleport it near a deer cluster
  const hawks = [...posMap.entries()].filter(([,e]) => e.spId === 'hawk')
  const deer  = [...posMap.entries()].filter(([,e]) => e.spId === 'deer')
  if (hawks[0] && deer[0]) {
    hawks[0][1].x = deer[0][1].x + 60 * ISLAND_SCALE
    hawks[0][1].y = deer[0][1].y - 40 * ISLAND_SCALE
    hawks[0][1].variation.speed = 40
    hawks[0][1].hunger = 30  // hungry enough to hunt immediately
  }
}
sprite: 'neutral'
overlay: 'predator-chase'  // draws line from each hawk to its targetId
```

**`'carrying-capacity'`**
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(3)
  // Deer to 55 (just under K=60) — they'll hit the cap quickly
}
sprite: 'neutral'
overlay: 'k-bar'  // draws a "K = 60" gauge overlay near the deer cluster
```

**`'decomposer'`**
```js
onEnter(posMap, sim, setSpeed) {
  setSpeed(1)
  // Inflate dead matter and fungi so numbers are large and dynamic
  sim.setState(prev => ({ ...prev, deadMatter: 350, pops: { ...prev.pops, fungi: 140 } }))
}
sprite: 'friendly'
overlay: null
```

**`'food-web'`** — no onEnter, normal world. Overlay draws arrows between trophic levels.

**All other cards** — no `onEnter`, just change speed to 2× and highlight their species.

### Overlay canvas — `SceneOverlay` component

```jsx
function SceneOverlay({ overlay, posMapRef, vpRef }) {
  // vpRef exposes the IslandCanvas viewport transform
  // Each overlay type reads posMapRef and draws on a canvas each RAF frame
  // overlay types:
  //   'ibm-bonds'      — green lines between deer bond pairs + faint awareness circles
  //   'predator-chase' — red line from hawk to targetId
  //   'heat-split'     — color tint over beetles by heatTolerance (red=low, blue=high)
  //   'k-bar'          — small gauge showing current deer count vs K=60
}
```

**Problem:** `vpRef` (the viewport transform — pan offset + zoom) is internal to IslandCanvas. We need to expose it. Plan: add `vpRef` as an optional prop to IslandCanvas that, when provided, gets assigned `vpRef.current = { offsetX, offsetY, zoom }` each frame. This lets the overlay canvas convert world coords to screen coords.

**World → screen conversion:**
```js
const sx = (worldX - vp.offsetX) * vp.zoom
const sy = (worldY - vp.offsetY) * vp.zoom
```

### Files to create/edit

| File | Change |
|---|---|
| `ShowcasePage.jsx` | Add mode state, scene transition, typewriter logic, overseer FloatingWindow, Back/Next nav, `onEnter` per card, `enterScene()` / `exitScene()` functions |
| `ShowcasePage.css` | Add scene-mode layout rules (full-screen sim, overseer positioning) |
| `IslandCanvas.jsx` | Expose `vpRef` prop (assign viewport transform to it each frame — ~2 lines) |
| `SceneOverlay.jsx` (new) | Canvas overlay component with RAF loop, world→screen transform, per-overlay draw functions |

### Narrator text

Card `body` text is used as-is for the overseer narration. `[[friendly]]` / `[[neutral]]` / `[[threat]]` tags can be inserted inline to trigger pose changes mid-text. Each card has a `sprite` field (default `'neutral'`) for the opening pose.

### Important constraints

- `posMapRef.current` is a live `Map` — mutations in `onEnter` are immediate and permanent for that scene session. On `exitScene()` or when navigating to a new scene, call `sim.initDevWorld()` to reset to a clean state before running the next scene's `onEnter`.
- `sim.triggerEvent()` only fires if no event is currently active (`sim.event === null`). Wait for world load before calling it.
- The overlay canvas must match the simulation canvas size exactly — use a ResizeObserver or share `sizeRef` from IslandCanvas.
- Hunger drain is NOT reduced — the stat boosts and world setup ensure demos work within the narration window. Exception: for predator-prey, set hawk hunger to 30 so it hunts immediately.
