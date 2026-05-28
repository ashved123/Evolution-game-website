# Island of Life — Game Design Document

## Project overview

A browser-based god simulation game built as a high school biology final project. The player is a supernatural being who watches a living ecosystem form on an island, then intervenes using a gene editor to trigger mutations, helping species adapt and survive.

The game must demonstrate understanding of **Evolution**, **Ecology**, and **DNA** (at least 15 specific biology concepts total), with clear connections between all three topics.

---

## Tech stack

- **React + Vite** (`vite@4`, Node 18 compatible)
- Dev server: `npm run dev` → `http://localhost:5173`
- No TypeScript — plain JSX throughout
- No Chart.js yet (population panel is a placeholder)

---

## Current build status

### What is built and working

**Layout & UI shell**
- Multi-page app: Auth → Islands list → Create Island → Game
- Game screen: full-bleed island canvas (left) + floating header (top) + dropdown panels triggered from header buttons
- Dropdown panels: Ecosystem, Population, Animals, Species, Gene Editor
- Header: island name, year counter (seasonal emoji), speed buttons (PAUSE / 1× / 2× / 4×), arrival banner, panel toggle buttons
- Warm pastel parchment palette; Press Start 2P pixel font throughout

**Island canvas**
- Dual PNG landmasses rendered to an offscreen cache once, then `drawImage`'d every frame — no per-frame pixel ops
- Main island (`island_visual_hires.png`) + wetland (`wetland_visual_hires.png`) positioned right of island with negative gap to account for PNG ocean padding
- Biome mask PNGs drive `biomeAt(x, y)` lookup (land/ocean/beach/mountain/wetland/mud/pond etc.)
- Second canvas layer renders all agent sprites (pixel-art PNGs, staged by age: sapling → adult)
- Pan + zoom via scroll wheel and drag; scale clamped 0.4–4×

**Individual-Based Model (IBM)**
- `posMapRef` (a `Map<id, entry>`) is the single source of truth for every living agent
- Agent entry shape: `{ x, y, vx, vy, spId, gender, variation, state, targetId, hunger, age, cooldowns }`
- RAF loop runs `stepMovement()` every frame at the active speed multiplier
- **State machine per agent**: `wander → flee / hunt → eat → wander`
  - Prey scan: circle awareness; predator scan: cone awareness for hawk/monitor
  - `effectiveRadius` scales with the agent's speed stat
- Stationary species (grass, tree, fungi) stored in posMap but don't move; tree seeds disperse via strength/metabolism stats
- All 9 stats drive simulation: constitution→lifespan, fertility→breed cooldown, metabolism→hunger drain, camouflage→predator detection damping, strength→seed radius, speed→movement+awareness, reasoning→direction noise, resilience→death resistance, heatTolerance→thermal events

**Individual genetics & inheritance**
- Every agent carries `variation: { speed, resilience, metabolism, camouflage, heatTolerance, strength, reasoning, fertility, constitution }` — continuous per-stat deltas (initial spread ±12)
- `sexualOffspring(parentA, parentB)` → child variation = average of both parents' variations + random noise (±4 per stat)
- `asexualOffspring(parent)` → used by plants; child = parent variation + noise
- Effective stat for any individual = `base[stat] (from species.js) + DNA modifier (from applyDNA) + variation[stat]`, clamped 0–100

**Species-level DNA system**
- Each species has `dna: { [statKey]: [codon1, codon2, codon3] }` — 9 traits × 3 codons each
- 19 codons in `codons.js`, each with a label and a single `modifier` (−20 to +20)
- `applyDNA(baseStats, dna)` sums the three codon modifiers per trait and adds to base stat
- `dnaOverrides` in `App.jsx` lets the player override species DNA; this feeds into `resolvedBases` used by the canvas each frame
- Gene editor shows all 9 traits in 4 groups, each with 3 clickable codon slots; selecting a base opens a picker; live stat bars and phenotype descriptions update immediately

**Ecosystem-triggered species arrival**
- `arrivalConfig.js` defines a sequential schedule: each species arrives when the previous one is established (checked via `readyWhen(enginePops, livePops)`)
- Order: tree → grass → fungi → beetle → deer → frog → boar → monitor → hawk
- Arrival fires an 8-second banner in the header; `nextArrival` shows the waiting trigger condition
- `spawnArrival()` in `useSimulation.js` places founding individuals into posMapRef at species-specific shore positions

**Carrying capacity & food web**
- `CARRYING_CAPACITY` per species (max under ideal conditions)
- Effective K = base K × food ratio × season multiplier
- `FOOD_K_FACTOR` maps each animal to its food sources and an optimal food count
- `SEASON_K_FACTOR`: Spring 1.15× / Summer 1.0× / Autumn 0.8× / Winter 0.5×
- `PREY_OF` and `PREDATORS_OF` tables drive hunt/flee targeting
- Seasonal breeding windows per species (`BREEDING_TICKS` in `individuals.js`)

**Simulation engine (`engine.js`)**
- Tick loop driven by `useSimulation` hook at the selected speed
- Manages producer logistic growth (grass/tree counts fed into engine state)
- Environmental event framework exists (drought, disease, heat wave, cold snap, wildfire, disease outbreak) — events fire but UI display is minimal
- Year/tick counter, season tracking

---

## Key file map

```
src/
  main.jsx
  App.jsx                        ← layout, dnaOverrides state, panel routing
  styles/
    global.css                   ← CSS variables, .pixel-box, .pixel-btn, .concept-badge
    App.css                      ← dropdown panel layout
  components/
    Header.jsx/css               ← year, speed, panel buttons, arrival banner
    IslandCanvas.jsx/css         ← dual-canvas IBM rendering, state machine, RAF loop
    GeneEditor.jsx/css           ← per-trait codon editor, live stat panel, phenotype display
    SpeciesList.jsx/css          ← accordion species rows, fitness bars
    EcosystemPanel.jsx/css       ← event log, ecosystem info
    PopulationPanel.jsx/css      ← population display (placeholder chart)
    AnimalsPanel.jsx/css         ← animal detail display
    IndividualCard.jsx/css       ← individual agent info card
  simulation/
    agentConfig.js               ← AWARENESS, HUNGER_RATE, HUNGER_GAIN, EAT_DISTANCE,
                                    MATE_DISTANCE, BREED_COOLDOWN, LIFESPAN,
                                    CARRYING_CAPACITY, FOOD_K_FACTOR, SEASON_K_FACTOR,
                                    PREY_OF, PREDATORS_OF, effectiveRadius(),
                                    FROG_WATER_BIOMES, TREE_SEED constants
    arrivalConfig.js             ← ARRIVAL_SCHEDULE (readyWhen triggers), ARRIVAL_HOME
    individuals.js               ← variation system, sexualOffspring, asexualOffspring,
                                    initIndividuals, spawnIndividuals, effectiveStats,
                                    averageStats, BREEDING_TICKS, SEASONS, getSeason,
                                    isBreeding
    worldConfig.js               ← ISLAND_SCALE = 5
    engine.js                    ← tick loop, logistic growth, events, year counter
    useSimulation.js             ← React hook: bridges engine + canvas, arrival logic,
                                    popsRef, biomeAtRef, posMapRef
  data/
    species.js                   ← SPECIES array (9 species, base stats, per-trait DNA)
    codons.js                    ← CODONS table (19 codons), STAT_GROUPS, STAT_KEYS,
                                    NEUTRAL_CODONS, applyDNA()
    biomes.js                    ← biome colour/name definitions
    presets.js                   ← island preset configurations
  pages/
    AuthPage.jsx/css             ← login / signup
    IslandsPage.jsx/css          ← saved islands list
    CreateIslandPage.jsx/css     ← island creation form
  context/
    AuthContext.jsx              ← auth state
  utils/
    islandRenderer.js            ← island rendering utilities
  assets/
    biomes/                      ← island_visual_hires.png, wetland_visual_hires.png,
                                    island_biome_mask.png, wetland_biome_mask.png
    sprites/
      adult/                     ← beetle.png, deer_adult.png, frog.png, hawk_adult.png
      juvenile/                  ← deer_baby.png, hawk_juvenile.png, etc.
      flora/                     ← fig_tree.png, grass_clump.png, mushroom.png,
                                    tree_sapling.png, mangrove_*.png
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
  variation,         // { speed, resilience, metabolism, ... } — continuous deltas ±12
  state,             // 'wander' | 'flee' | 'hunt' | 'eat'
  targetId,          // id of prey or threat
  hunger,            // 0–100; 0 = starvation death
  age,               // frames lived; death at LIFESPAN[spId] × constitution factor
  cooldowns,         // { breed: framesRemaining }
}

// dnaOverrides (App.jsx state) — species-level DNA
{ [spId]: { [statKey]: [codon1, codon2, codon3] } }

// Individual effective stat
base[stat] + applyDNA(dnaOverrides[spId])[stat] + variation[stat]  →  clamped 0–100
```

---

## Colour palette

- `--color-bg: #f4efe5` / `--color-panel-bg: #ece5d8` / `--color-panel-dark: #e2d8c8`
- `--color-border: #b89470` / `--color-accent: #b87040` / `--color-accent2: #5a9068`
- `--color-text: #3c3028` / `--color-text-dim: #7a6858`
- All structural borders: 2px. Element borders: 1px. Shadow: `2px 2px 0 rgba(80,50,20,0.18)`.

---

## Core gameplay loop

1. Island starts with trees only. Species arrive sequentially as the ecosystem matures.
2. The ecosystem forms — predator/prey relationships, food webs, and population dynamics play out in real time driven by the IBM.
3. Environmental events periodically threaten the balance.
4. The player uses the **Gene Editor** to design mutations, then injects them into a chosen number of individuals. Mutations inherit through breeding, spreading (or dying out) based on fitness pressure.
5. The **Genetics panel** tracks how injected mutations spread through the population over generations.
6. Goal: keep all species alive and maintain a stable ecosystem as long as possible.

---

## Not yet built (next priorities)

1. **Mutation injection to individuals** — gene editor "Inject" mode: design mutation, pick N individuals, write variation deltas to their posMap entries; mutations then spread via existing inheritance
2. **Genetics tracking panel** — allele frequency (mean variation per trait) over time, per species; line chart showing mutation spread
3. **Environmental events UI** — events fire in engine but need visual impact and player-facing descriptions
4. **Dynamic food web diagram** — SVG showing who eats whom, updates as species arrive/go extinct
5. **Population graph** — Chart.js line chart per species over time
6. **Rationale + reflection + works cited pages**

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

**Ecology**
8. Trophic levels — food web: producers → primary → secondary → apex
9. Predator-prey relationships — hawk/deer/frog populations oscillate dynamically
10. Carrying capacity — dynamic K scaled by food availability and season
11. Limiting factors — food, space, season constrain population growth
12. Symbiotic relationships — fungi (decomposer) recycles nutrients for producers
13. Autotrophs vs. heterotrophs — grass/tree produce energy; all animals consume it
14. Matter and energy flow — energy moves up trophic levels
15. Population growth — logistic growth curves driven by carrying capacity

**DNA**
16. DNA base pairs — A/T/G/C shown in gene editor
17. Codons — every 3 bases = one codon = one trait instruction (19 codons, −20 to +20 modifier)
18. Mutation types — point mutations (single base change) produce different codons
19. Gene expression — codon → modifier → effective stat → observable phenotype
20. Inheritance — offspring variation = average of parents + random noise (quantitative genetics)

---

## Visual aesthetic

- Warm pastel parchment palette — cream panels, terracotta borders, sage/amber accents
- Pixel-art style using **Press Start 2P** font
- Pixel-art PNG sprites for all species (staged by age/lifecycle)
- Island view: dual high-res PNG landmasses, offscreen-cached, no per-frame redraw cost
- Science concept labels shown as `.concept-badge` chips throughout the UI

---

## Project requirements from rubric

- Cover **Evolution + Ecology + DNA** with at least **15 specific concepts**
- Use **accurate scientific vocabulary** throughout
- Show **real-world examples and applications**
- Demonstrate **clear connections**: mutation (DNA) → trait change (Evolution) → survival in food web (Ecology)
- Include a **project rationale** page
- Include an **individual reflection** section
- Include a **works cited** section

---

## Deliverables

- [x] Playable shell in the browser (`npm run dev`)
- [x] 9 species with base stats and per-trait DNA sequences
- [x] Real-time speed control (pause / 1× / 2× / 4×)
- [x] Functional gene editor — per-trait codon editing with live stats and phenotypes
- [x] Species list with expandable stat panels
- [x] Individual-Based Model — agents with state machines, hunger, aging, death
- [x] Individual genetics — variation system with sexual/asexual inheritance
- [x] Ecosystem-triggered species arrival schedule
- [x] Dynamic carrying capacity (food × season)
- [x] Awareness-based predator/prey detection (circle + cone)
- [x] Seasonal breeding windows
- [ ] Mutation injection to specific individuals + genetics tracking panel
- [ ] Environmental events with full UI display
- [ ] Dynamic food web diagram (SVG)
- [ ] Population graph (Chart.js)
- [ ] Rationale + reflection + works cited pages
