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
4. **Teacher grading mode** — pinned for future session; separate playback/presentation mode
5. **Rationale + reflection + works cited pages**

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
- [ ] Wetland island unlock (code preserved, WETLAND_ENABLED = false)
- [ ] Teacher grading mode
- [ ] Rationale + reflection + works cited pages
