# Island of Life — Game Design Document

## Project overview

A browser-based god simulation game built as a high school biology final project. The player is a supernatural being who is given a blank island. Over time, animals migrate to the island and form a living ecosystem. The player watches species interact in real time and intervenes using a gene editor to trigger mutations, helping species adapt and survive.

The game must demonstrate understanding of **Evolution**, **Ecology**, and **DNA** (at least 15 specific biology concepts total), with clear connections between all three topics.

---

## Current build status

**Tech stack:** React + Vite (Node 18 compatible — use `vite@4`). Dev server runs on `http://localhost:5173` via `npm run dev`.

**What is built and working:**
- Full layout shell: header + resizable island pane (left) + resizable right panel (ecosystem top / species list bottom) + gene editor tray (slides up from bottom)
- Drag-to-resize: vertical divider between island and right panel, horizontal divider inside right panel. Both use pointer events with clamped pixel state in `App.jsx`.
- Header with year counter and speed buttons (PAUSE / 1× / 2× / 4×)
- Island canvas: organic coastline drawn with polar bezier curves, pastel flat colours (ocean `#7ab4cc`, shallow water `#a8d8e8`, beach `#e0c890`, terrain `#90b870`). No foliage, no lake, no decorations.
- Species list: click a row to expand it and show 6 stat bars (accordion, one open at a time). "Edit DNA" button inside the expanded row opens the gene editor tray.
- Gene editor tray: two-column layout — DNA codons (clickable bases A/T/G/C, picker appears on click) on the left; live stat bars on the right. Stats recalculate immediately when a base is mutated. +/- deltas shown.
- Shared data files drive everything: `src/data/species.js` (base stats per species, DNA, population, trophic level) and `src/data/codons.js` (codon → trait label + stat modifiers + `applyDNA()` helper).

**Colour palette (warm pastel parchment):**
- `--color-bg: #f4efe5` / `--color-panel-bg: #ece5d8` / `--color-panel-dark: #e2d8c8`
- `--color-border: #b89470` / `--color-accent: #b87040` / `--color-accent2: #5a9068`
- `--color-text: #3c3028` / `--color-text-dim: #7a6858`
- All borders: 2px structural, 1px element. Shadows: `2px 2px 0 rgba(80,50,20,0.18)`.

**Key file map:**
```
src/
  main.jsx
  App.jsx                  ← layout shell, resize state, gene editor tray toggle
  styles/
    global.css             ← CSS variables, .pixel-box, .pixel-btn, .concept-badge
    App.css                ← grid/flex layout, dividers, gene editor tray
  components/
    Header.jsx/css         ← title + year + speed buttons
    IslandCanvas.jsx/css   ← Canvas island drawing + emoji hotspot buttons
    EcosystemPanel.jsx/css ← event banner + food web grid + pop graph placeholder
    SpeciesList.jsx/css    ← accordion species rows + expanded stat bars
    GeneEditor.jsx/css     ← DNA codon editor + live stat panel
  data/
    species.js             ← SPECIES array + overallFitness()
    codons.js              ← CODONS table, STAT_META, applyDNA()
  assets/sprites/          ← drop pixel-art PNGs here to replace emoji
```

**Not yet built (next priorities):**
1. Population simulation loop (Lotka-Volterra dynamics, carrying capacity, trophic interactions)
2. Environmental events system (drought, disease, wildfire, climate shift, etc.)
3. Food web diagram — dynamic SVG showing who eats whom
4. Population graph — Chart.js line chart per species over time
5. Rationale / reflection / works cited pages

---

## Core gameplay loop

1. The island starts empty. Species migrate onto it over time automatically.
2. The ecosystem forms — predator/prey relationships, food webs, and population dynamics play out in real time.
3. Environmental events periodically threaten the balance (drought, disease, new predator, climate shift, etc.).
4. The player uses the **Gene Editor** to edit a species' DNA sequence, which triggers a mutation that changes a trait.
5. The goal is to keep all species alive and maintain a stable ecosystem as long as possible.

---

## Key systems

### Species stats (6 stats per species)
Each species has base stats for: **Speed, Resilience, Metabolism, Camouflage, Heat Tolerance, Strength** (all 0–100). Codons in `src/data/codons.js` modify these stats. Overall fitness = average of all 6 stats.

### Gene editor
- DNA is 3 codons (9 bases). Each codon maps to a trait label + stat modifiers.
- Player clicks a base → picker appears → selecting a new base immediately rewrites the codon and recalculates all 6 stats with deltas shown.
- Mutations have a **cooldown** per species (not yet implemented).

### Environmental events
Random events fire periodically. Each displays a biology concept label. Examples:
- **Drought** — reduces grass population; herbivores starve
- **Disease outbreak** — targets one species, hits resilience
- **Climate warming** — species without heat tolerance lose fitness
- **Wildfire** — bottleneck effect, reduces population + genetic diversity
- **Volcanic ash** — slows photosynthesis, energy flow disrupted

### Island & ecosystem simulation
- Speed control: pause / 1× / 2× / 4×
- Populations rise/fall based on food availability, predator pressure, environment, carrying capacity
- Food web diagram updates as species arrive/go extinct
- Population graphs per species (line chart)

---

## Biology concepts covered (minimum 15)

**Evolution**
1. Natural selection — species with better-adapted traits survive environmental events
2. Mutation — gene editor directly causes heritable DNA changes
3. Adaptation — traits change in response to environmental pressure
4. Fitness — each species has a visible fitness score (average of 6 stats)
5. Genetic drift — small populations after a bottleneck event have random allele changes
6. Bottleneck effect — wildfire/disease events cause sharp population drops

**Ecology**
7. Trophic levels — food web: producers → primary → secondary → apex
8. Predator-prey relationships — hawk/deer populations oscillate (Lotka-Volterra)
9. Carrying capacity — island has a max population cap per species
10. Limiting factors — food, space, water constrain population growth
11. Symbiotic relationships — fungi (decomposer) recycles nutrients for producers
12. Autotrophs vs. heterotrophs — grass produces energy; all animals consume it
13. Matter and energy flow — energy moves up trophic levels (~10% efficiency)
14. Population growth — exponential vs. logistic growth curves in graph panel

**DNA**
15. DNA base pairs — A pairs with T, G pairs with C (shown in gene editor)
16. Codons — every 3 bases = one codon = one trait instruction
17. Mutation types — point mutations (single base change) produce different traits
18. Gene expression — DNA sequence → trait → observable phenotype on species card

---

## Visual aesthetic

- Warm pastel parchment palette — cream panels, terracotta borders, sage/amber accents
- Pixel-art style using **Press Start 2P** font
- Species represented as emoji placeholders (drop pixel-art PNGs into `src/assets/sprites/` to replace)
- Island view drawn on Canvas — flat colours, organic coastline shape, no decorations
- Science concept labels shown as `.concept-badge` chips throughout the UI
- Hand-crafted, warm, whimsical feel — NOT clinical or dashboard-like

---

## Project requirements from rubric

- Cover **Evolution + Ecology + DNA** with at least **15 specific concepts**
- Use **accurate scientific vocabulary** throughout (label concepts in the UI)
- Show **real-world examples and applications** (event descriptions connect to real biology)
- Demonstrate **clear connections between topics** — mutation (DNA) → trait change (Evolution) → survival in food web (Ecology)
- Include a **project rationale** page explaining why a game was an effective format
- Include an **individual reflection** section
- Include a **works cited** section

---

## Deliverables

- [x] Playable shell in the browser (`npm run dev`)
- [x] 6 species with base stats and DNA sequences
- [x] Real-time speed control (pause / 1× / 2× / 4×)
- [x] Functional gene editor with codon → trait → stat effect
- [x] Species list with expandable stat panels
- [x] Resizable panels (drag dividers)
- [ ] Working population simulation loop
- [ ] At least 4 environmental events firing in real time
- [ ] Dynamic food web diagram (SVG)
- [ ] Population graph per species (Chart.js)
- [ ] Rationale + reflection page
- [ ] Works cited
