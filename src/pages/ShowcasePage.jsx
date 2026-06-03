import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingWindow   from '../components/FloatingWindow.jsx'
import IslandCanvas     from '../components/IslandCanvas.jsx'
import { SPECIES }      from '../data/species.js'
import { useSimulation } from '../simulation/useSimulation.js'
import { CARRYING_CAPACITY, SEASON_K_FACTOR, FOOD_K_FACTOR } from '../simulation/agentConfig.js'
import { getSeason, freshId }    from '../simulation/individuals.js'
import { ISLAND_SCALE } from '../simulation/worldConfig.js'
import narratorFriendly from '../assets/sprites/narrator/pose_friendly.png'
import narratorNeutral  from '../assets/sprites/narrator/pose_neutral.png'
import narratorThreat   from '../assets/sprites/narrator/pose_threat.png'
import '../components/TutorialWindow.css'
import './ShowcasePage.css'

// ── Constants ────────────────────────────────────────────────────────

const NARRATOR_IMGS = { friendly: narratorFriendly, neutral: narratorNeutral, threat: narratorThreat }
const CHAR_DELAY  = 20
const MOUTH_DELAY = 160

const SPARK_COLORS = {
  grass: '#7dc859', tree: '#1de08a', fungi: '#e040fb',
  beetle: '#c46200', deer: '#c8a840', frog: '#00bcd4',
  hawk: '#e91e63', boar: '#d4813a', monitor: '#5cad4a', firefly: '#c8e832',
}

function parseBody(body) {
  const changes = []; let clean = '', i = 0
  while (i < body.length) {
    if (body[i] === '[' && body[i + 1] === '[') {
      const end = body.indexOf(']]', i)
      if (end !== -1) { changes.push({ atChar: clean.length, sprite: body.slice(i + 2, end) }); i = end + 2; continue }
    }
    clean += body[i]; i++
  }
  return { clean, changes }
}

// ── Live formula widgets ──────────────────────────────────────────────

function KWidget({ pops, tick }) {
  const season     = getSeason(tick ?? 0)
  const seasonMult = SEASON_K_FACTOR[season.name] ?? 1
  const grassCount = Math.round(pops?.grass ?? 0)
  const boarCount  = Math.round(pops?.boar  ?? 0)
  const optimal    = FOOD_K_FACTOR.deer.optimal
  const adjusted   = Math.max(0, grassCount - boarCount * 0.4)
  const foodRatio  = Math.min(1.5, adjusted / optimal)
  const effectiveK = Math.round(CARRYING_CAPACITY.deer * foodRatio * seasonMult)
  return (
    <div className="sc-widget">
      <div className="sc-widget__title">Live: Deer Carrying Capacity</div>
      <div className="sc-widget__row">effectiveK = baseK × (food / optimal) × season</div>
      <div className="sc-widget__row">= 60 × ({adjusted.toFixed(0)} / {optimal}) × {seasonMult.toFixed(2)}</div>
      <div className="sc-widget__row">= <span className="sc-widget__val">{effectiveK}</span><span className="sc-widget__dim"> deer  {season.name}</span></div>
      <div className="sc-widget__note">Grass: {grassCount} | Boar consuming {(boarCount * 0.4).toFixed(0)} | Adjusted: {adjusted.toFixed(0)}</div>
    </div>
  )
}

function NutrientWidget({ deadMatter, pops }) {
  const fungi    = Math.round(pops?.fungi ?? 0)
  const dead     = Math.round(deadMatter ?? 0)
  const consumed = Math.min(dead, fungi * 0.15)
  const returned = consumed * 0.45
  return (
    <div className="sc-widget">
      <div className="sc-widget__title">Live: Decomposer Nutrient Loop</div>
      <div className="sc-widget__row">Dead matter: <span className="sc-widget__val">{dead}</span> units</div>
      <div className="sc-widget__row">Fungi: {fungi} × 0.15 = <span className="sc-widget__val">{consumed.toFixed(1)}</span> consumed/tick</div>
      <div className="sc-widget__row">Returned: {consumed.toFixed(1)} × 0.45 = <span className="sc-widget__val">{returned.toFixed(1)}</span> /tick</div>
      <div className="sc-widget__note">Nutrients boost grass and tree growth by up to 65%</div>
    </div>
  )
}

function DiversityWidget({ diversity, arrivedSpecies }) {
  const entries = Object.entries(diversity ?? {})
    .filter(([sp]) => arrivedSpecies?.has(sp) && !['grass','tree','fungi'].includes(sp))
  if (!entries.length) return (
    <div className="sc-widget">
      <div className="sc-widget__title">Live: Genetic Diversity Index</div>
      <div className="sc-widget__row sc-widget__row--dim">Waiting for population data…</div>
    </div>
  )
  return (
    <div className="sc-widget">
      <div className="sc-widget__title">Live: Genetic Diversity (0 = inbred, 100 = diverse)</div>
      {entries.map(([sp, idx]) => {
        const col  = idx >= 60 ? '#4caf50' : idx >= 30 ? '#c08820' : '#c04020'
        const warn = idx < 30 ? '  INBREEDING RISK' : ''
        return (
          <div key={sp} className="sc-widget__row" style={{ color: col }}>
            {sp}: <span className="sc-widget__val">{idx}</span>{warn}
          </div>
        )
      })}
    </div>
  )
}

function SparklineWidget({ species, popHistory }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke()
    const allData = species.map(sp => popHistory[sp] ?? [])
    const globalMax = Math.max(...allData.flat(), 1)
    for (const sp of species) {
      const data = popHistory[sp]
      if (!data || data.length < 2) continue
      ctx.strokeStyle = SPARK_COLORS[sp] ?? '#888'
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - (v / globalMax) * (height - 3) - 1
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
  })
  return (
    <div className="sc-sparks">
      <div className="sc-sparks__title">Live Population Trends</div>
      <canvas ref={canvasRef} width={220} height={44} className="sc-sparks__canvas" />
      <div className="sc-sparks__legend">
        {species.map(sp => (
          <span key={sp} className="sc-sparks__item">
            <span className="sc-sparks__dot" style={{ background: SPARK_COLORS[sp] }} />
            {sp}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Card data ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'evolution', label: 'Evolution',      color: '#4caf50' },
  { id: 'ecology',   label: 'Ecology',        color: '#2196f3' },
  { id: 'genetics',  label: 'Genetics & DNA', color: '#ff9800' },
  { id: 'systems',   label: 'Code & Systems', color: '#9c27b0' },
  { id: 'project',   label: 'Project',        color: '#ef5350' },
]

// Helper used by onEnter functions to inflate a species population
function inflateSpecies(posMap, spId, targetCount, homeX, homeY, spreadPx) {
  const current = [...posMap.values()].filter(e => e.spId === spId).length
  const needed  = Math.max(0, targetCount - current)
  for (let i = 0; i < needed; i++) {
    const angle = Math.random() * Math.PI * 2
    const r     = Math.sqrt(Math.random()) * spreadPx
    posMap.set(freshId(), {
      x: homeX + Math.cos(angle) * r,
      y: homeY + Math.sin(angle) * r,
      vx: 0, vy: 0, spId,
      gender: Math.random() < 0.5 ? 'M' : 'F',
      variation: { speed:0, resilience:0, metabolism:0, camouflage:0,
                   heatTolerance:0, strength:0, reasoning:0, fertility:0, constitution:0 },
      state: 'wander', targetId: null, hunger: 100, age: 0, cooldowns: { breed: 0 },
    })
  }
}

function forceDeerBonds(posMap) {
  const deerEntries = [...posMap.entries()].filter(([,e]) => e.spId === 'deer')
  for (const [id, e] of deerEntries) {
    const others = deerEntries.filter(([oid]) => oid !== id)
    const byDist = others
      .map(([oid, oe]) => ({ oid, d2: (oe.x - e.x) ** 2 + (oe.y - e.y) ** 2 }))
      .sort((a, b) => a.d2 - b.d2)
    e.bonds = byDist.slice(0, 2).map(x => x.oid)
  }
}

const CARDS = [
  // ── EVOLUTION ────────────────────────────────────────────────────────
  {
    id:        'natural-selection',
    cat:       'evolution',
    title:     'Natural Selection',
    teaser:    'Organisms with better traits survive and reproduce, shifting allele frequencies over generations.',
    highlight: 'beetle',
    trialBtns: [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
    body:
`The process where organisms with traits better suited to their environment survive and reproduce more successfully than others, causing those traits to become more common over time. For instance, beetles with better camouflage are less likely to be eaten by frogs, so their genes become more common in future generations.

During a cold environmental event, organisms with higher heat tolerance survive at higher rates. Over multiple generations, this increases the average heat tolerance in the population, showing directional selection and real-time adaptive change.`,
    code:
`Each agent's camouflage stat (stored as variation.camouflage) reduces the detection probability in the predator hunting logic in IslandCanvas.jsx. Agents that survive reproduce via sexualOffspring() in individuals.js, which averages both parents' variation values and adds a random mutation delta. Over generations, advantageous traits drift toward higher mean values in the population, tracked per stat per species in variationHistory in useSimulation.js, without any direct programming.`,
    acts: [
      {
        title:  'How Natural Selection Works',
        sprite: 'friendly',
        body:   `The process where organisms with traits better suited to their environment survive and reproduce more successfully than others, causing those traits to become more common over time.\n\nFor instance, beetles with better camouflage are less likely to be eaten by frogs, so their genes become more common in future generations. Individuals vary in heritable traits; certain traits improve survival; successful traits become more common; populations adapt over time.`,
        onEnter: (_posMap, _sim, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
      {
        title:  'Cold Snap — Selection Live',
        sprite: 'neutral',
        body:   `Half of these beetles now have low heat tolerance. Half have high. The cold snap is about to hit.\n\nWatch carefully. The low-tolerance individuals will struggle. The high-tolerance ones will not. When the survivors reproduce, they pass on their heat tolerance. The next generation carries it more often. Over enough generations the population shifts. Not because anything decided to adapt. Because the wrong ones died.[[threat]]`,
        onEnter: (posMap, sim, setSpeed) => {
          setSpeed(2)
          const beetles = [...posMap.entries()].filter(([,e]) => e.spId === 'beetle')
          beetles.forEach(([,e], i) => { e.variation.heatTolerance = i % 2 === 0 ? -40 : 40 })
          setTimeout(() => sim.triggerEvent('cold_snap'), 200)
        },
        highlight:  'beetle',
        trialBtns:  [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
      },
      {
        title:  'The Population Shifts',
        sprite: 'friendly',
        body:   `After repeated cold snaps, the average heat tolerance in the beetle population rises. Not because beetles decided to adapt. Because beetles with low tolerance died, and beetles with high tolerance reproduced.\n\nThis is directional selection. The gene pool shifts toward survival advantage. Evolution is the emergent consequence of those two facts: some die, some reproduce, offspring inherit.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        highlight:  'beetle',
        sparklines: ['beetle'],
      },
    ],
  },

  {
    id:        'mutation',
    cat:       'evolution',
    title:     'Mutation',
    teaser:    'Random DNA changes create new genetic variation, enabling populations to adapt.',
    highlight: 'beetle',
    body:
`A random change in an organism's DNA that creates new genetic variation within a population. For example, a mutation that increases frog speed may help it escape hawk predation more often, improving survival.

Genetics is represented through a simplified codon-based system, where genetic sequences influence traits such as camouflage, metabolism, and resilience. Mutations alter codons, changing trait expression and survival probability. Beneficial mutations increase in frequency through selection. This parallels real-world processes like antibiotic resistance and adaptive evolution.`,
    code:
`In individuals.js, sexualOffspring() averages both parents' per-stat variation values, then adds randDelta(MUTATION_RANGE), a Gaussian-ish random delta with range ±4. Players can also trigger directed mutations via the Gene Editor, which calls injectMutation() in useSimulation.js and directly patches entry.variation for randomly selected live agents in the posMap, creating a founder effect that spreads through future generations.`,
    acts: [
      {
        title:  'What is a Mutation?',
        sprite: 'friendly',
        body:   `A random change in an organism's DNA that creates new genetic variation within a population. For example, a mutation that increases frog speed may help it escape hawk predation more often, improving survival.\n\nGenetics is represented through a simplified codon-based system, where genetic sequences influence traits such as camouflage, metabolism, and resilience. Mutations alter codons, changing trait expression and survival probability.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
      {
        title:  'Mutations Spread Through Generations',
        sprite: 'neutral',
        body:   `In individuals.js, sexualOffspring() averages both parents' variation values per stat, then adds a small random delta. This happens every time two animals breed.\n\nA beneficial mutation appears in one individual. It survives more often. It reproduces more often. Its offspring carry the variation. Their offspring carry it further. Allele frequency rises without any direction from outside the system. That is how the gene pool shifts.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        highlight:  'beetle',
        sparklines: ['beetle'],
      },
    ],
  },

  {
    id:        'adaptation',
    cat:       'evolution',
    title:     'Adaptation',
    teaser:    'Populations accumulate beneficial traits over generations through repeated selection events.',
    highlight: 'frog',
    trialBtns: [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
    body:
`The long-term process where a population becomes better adapted to its environment through accumulated beneficial traits across generations. For example, frogs exposed to repeated cold conditions may evolve higher heat tolerance over time.

This can be seen in real-world examples such as antibiotic resistance in bacteria or climate-driven shifts in species distribution. In the simulation, organisms adjust over generations based on survival outcomes, showing how environmental pressure drives long-term evolutionary change.`,
    code:
`When a cold snap fires in engine.js, it sets pops.__coldSnap = true each tick for the event's duration. The IBM loop in IslandCanvas.jsx applies extra hunger drain to ectotherms (frogs, monitors) with low heatTolerance stats. Survivors reproduce via sexualOffspring(), passing higher heatTolerance to offspring. The variationHistory tracker in useSimulation.js records the mean per-stat variation each tick, so directional adaptation appears as a rising trend in the heatTolerance mean over simulation time.`,
    acts: [
      {
        title:  'Long-Term Adaptation',
        sprite: 'friendly',
        body:   `The long-term process where a population becomes better adapted to its environment through accumulated beneficial traits across generations. For example, frogs exposed to repeated cold conditions may evolve higher heat tolerance over time.\n\nThis can be seen in real-world examples such as antibiotic resistance in bacteria or climate-driven shifts in species distribution. In the simulation, organisms adjust over generations based on survival outcomes.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'frog',
      },
      {
        title:  'Watching Adaptation Build',
        sprite: 'neutral',
        body:   `Frogs with low heat tolerance struggle most during cold snaps. Frogs with high heat tolerance survive. Over many generations, the surviving frogs reshape the population's average heat tolerance upward.\n\nThe variationHistory tracker in useSimulation.js records the mean heat tolerance per tick. After enough cold snaps, you can see it rise — directional adaptation occurring in real time, driven entirely by survival probability and reproduction rate.`,
        onEnter: (posMap, sim, setSpeed) => {
          setSpeed(2)
          const frogs = [...posMap.entries()].filter(([,e]) => e.spId === 'frog')
          frogs.forEach(([,e], i) => { e.variation.heatTolerance = i % 2 === 0 ? -35 : 35 })
          setTimeout(() => sim.triggerEvent('cold_snap'), 200)
        },
        highlight:  'frog',
        trialBtns:  [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
      },
    ],
  },

  {
    id:        'drift-bottleneck',
    cat:       'evolution',
    title:     'Genetic Drift & Bottleneck Effect',
    teaser:    'Crash-reduced populations lose diversity by chance, not just by selection.',
    highlight: 'deer',
    trialBtns: [{ label: 'Trigger Wildfire', event: 'wildfire' }],
    sparklines: ['deer', 'hawk'],
    body:
`Genetic drift is the random change in allele frequencies in a population, especially in small populations where chance has a strong effect. After a disaster reduces deer numbers, certain traits may become common purely by chance rather than advantage.

The bottleneck effect occurs when a population is drastically reduced due to an event, leading to low genetic diversity in survivors. This directly mirrors real-world conservation biology, where endangered species such as cheetahs and Florida panthers experience critically low genetic diversity, increasing disease vulnerability and reducing adaptive capacity.`,
    code:
`The wildfire event in engine.js reduces grass by 65% and tree cover by 40%, crashing the herbivore food supply. Genetic diversity is tracked in useSimulation.js as the variance of variation values across all 9 stats per species. After a bottleneck, this variance collapses and the diversity score drops. Low diversity triggers inbreeding depression in the IBM: pairs with very similar genomes produce offspring with lower baseline stats.`,
    formula: 'diversity',
    acts: [
      {
        title:  'Genetic Drift',
        sprite: 'neutral',
        body:   `Genetic drift is the random change in allele frequencies in a population, especially in small populations where chance has a strong effect. After a disaster reduces deer numbers, certain traits may become common purely by chance rather than advantage.\n\nThis is especially important in conservation biology, where small populations may lose beneficial traits simply due to randomness, increasing extinction risk even if conditions stabilize.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'deer',
        formula:   'diversity',
      },
      {
        title:  'The Bottleneck Event',
        sprite: 'threat',
        body:   `The bottleneck effect occurs when a population is drastically reduced due to an event, leading to low genetic diversity in survivors. After a wildfire, only a few deer survive, and the next generation has reduced variation.\n\nWatch what happens now. The wildfire will take the vegetation. Deer will starve. The few that remain carry only a fraction of the original gene pool. Recovery is possible. But the genetic cost is permanent.[[threat]]`,
        onEnter: (posMap, sim, setSpeed) => {
          setSpeed(3)
          inflateSpecies(posMap, 'deer', 50,
            630 * ISLAND_SCALE, 390 * ISLAND_SCALE, 90 * ISLAND_SCALE)
          setTimeout(() => sim.triggerEvent('wildfire'), 200)
        },
        highlight:  'deer',
        trialBtns:  [{ label: 'Trigger Wildfire', event: 'wildfire' }],
      },
      {
        title:  'Low Diversity — The Cost',
        sprite: 'neutral',
        body:   `The simulation demonstrates this by showing reduced variation in traits after population crashes, which affects long-term adaptability.\n\nThis directly mirrors real-world conservation biology. Endangered species such as cheetahs experience critically low genetic diversity. The inbreeding depression mechanic in this simulation models exactly that consequence — low diversity triggers up to 60% increased death rate per tick in the IBM.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight:  'deer',
        formula:    'diversity',
        sparklines: ['deer'],
      },
    ],
  },

  {
    id:        'fitness',
    cat:       'evolution',
    title:     'Fitness',
    teaser:    'An organism\'s total reproductive success, considering every trait working together in its environment.',
    highlight: 'hawk',
    body:
`An organism's ability to survive and reproduce in its environment, not just physical strength but overall reproductive success. For example, a hawk that successfully catches more prey produces more offspring, increasing its fitness.

In the simulation, fitness is not a single number but emerges from the interaction of all traits simultaneously: a deer with high camouflage evades predators, a beetle with high resilience resists disease, and a frog with high speed escapes hawks.`,
    code:
`Fitness is implicit in the IBM rather than stored explicitly. In IslandCanvas.jsx, each agent's survival depends on multiple stats simultaneously: camouflage reduces the predator's effective detection radius, heatTolerance determines cold snap survival, resilience lowers the death multiplier (deathMult() in engine.js returns 0.6–1.4 based on resilience), and metabolism controls hunger drain rate. An organism's total fitness is the product of how well all its traits match current environmental conditions.`,
    acts: [
      {
        title:  'What is Fitness?',
        sprite: 'friendly',
        body:   `An organism's ability to survive and reproduce in its environment, not just physical strength but overall reproductive success. For example, a hawk that successfully catches more prey produces more offspring, increasing its fitness.\n\nIn the simulation, fitness is not a single number but emerges from the interaction of all traits simultaneously: a deer with high camouflage evades predators, a beetle with high resilience resists disease, and a frog with high speed escapes hawks.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'hawk',
      },
      {
        title:  'Fitness is Context-Dependent',
        sprite: 'neutral',
        body:   `There is no universally best set of traits. High speed helps a frog escape a hawk. High camouflage helps a beetle hide from a frog. High heat tolerance helps anything survive a cold snap. Fitness is not about one trait. It is about how well the full set of traits matches the current environment.\n\nOrganisms with traits better suited to the current environment survive and reproduce more successfully, passing advantageous traits to future generations. This leads to gradual shifts in population traits.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'hawk',
      },
    ],
  },

  // ── ECOLOGY ──────────────────────────────────────────────────────────

  {
    id:        'carrying-capacity',
    cat:       'ecology',
    title:     'Carrying Capacity',
    teaser:    'The maximum population an environment can support, which changes with food availability and season.',
    highlight: 'deer',
    sparklines: ['deer', 'grass'],
    formula:   'k',
    body:
`The maximum population size an environment can support based on available resources like food and space. For example, deer population growth slows once grass resources can no longer support more individuals.

Carrying capacity in the simulation is dynamic. It scales with food availability and season, so the same species may support 60 deer in summer but only about 41 in winter.`,
    code:
`In IslandCanvas.jsx, effectiveK is computed each frame as: baseK × (foodCount / optimal) × seasonMultiplier. CARRYING_CAPACITY in agentConfig.js sets the base values (deer K = 60). FOOD_K_FACTOR maps each species to its food sources and the optimal food count at full K. SEASON_K_FACTOR multiplies by 0.68× in winter and 1.15× in spring. Agents above their effective K face escalating death probability each frame.`,
    acts: [
      {
        title:  'What is Carrying Capacity?',
        sprite: 'friendly',
        body:   `The maximum population size an environment can support based on available resources like food and space. For example, deer population growth slows once grass resources can no longer support more individuals.\n\nCarrying capacity is not a wall that stops population growth. It is a consequence of available resources. As the population grows, food becomes scarcer, hunger increases, and death rates rise until growth stops.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'deer',
      },
      {
        title:  'The Live Formula',
        sprite: 'neutral',
        body:   `In the simulation, carrying capacity is dynamic. effectiveK = baseK × (food / optimal) × seasonMultiplier.\n\nWatch the numbers update in real time as the ecosystem runs. When grass is abundant, K is near 60. When drought hits, grass drops, K drops, and deer that were viable yesterday cannot be supported today. Carrying capacity is not fixed. It breathes with the ecosystem.`,
        onEnter: (posMap, _sim, setSpeed) => {
          setSpeed(3)
          inflateSpecies(posMap, 'deer', 55,
            630 * ISLAND_SCALE, 390 * ISLAND_SCALE, 90 * ISLAND_SCALE)
        },
        highlight: 'deer',
        formula:   'k',
      },
      {
        title:  'Seasonal Effects',
        sprite: 'friendly',
        body:   `Season multiplies carrying capacity by 0.68× in winter and 1.15× in spring. The same 60 deer that fit comfortably in summer will exceed K in winter.\n\nThis mirrors real-world seasonal ecology, where animal populations fluctuate with food availability. In harsh winters, populations drop. In productive springs, they recover. The simulation models this with mathematical precision — each tick, every animal checks whether its effective K supports its continued existence.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        highlight:  'deer',
        sparklines: ['deer', 'grass'],
      },
    ],
  },

  {
    id:        'limiting-factors',
    cat:       'ecology',
    title:     'Limiting Factors',
    teaser:    'Food, water, space, disease, and predation all independently cap population growth.',
    highlight: 'frog',
    body:
`Environmental conditions that restrict population growth, such as food, water, space, disease, or predation. For example, a drought reduces plant growth, limiting how many herbivores can survive.

In the simulation, each species has specific dependencies: frogs require water biomes to avoid desiccation, beetles need forest cover, and every animal needs food within reach to avoid starvation. These factors operate differently per species, per biome, per individual. Limiting factors are not a single global cap but a network of simultaneous constraints.`,
    code:
`Habitat dependency is enforced in agentConfig.js: FROG_WATER_BIOMES and BEETLE_FOREST_BIOMES define which biomes each species requires. In IslandCanvas.jsx, agents in the wrong biome suffer extra hunger drain: FROG_DESICCATION_DRAIN = 0.014 per frame when out of water, BEETLE_FOREST_DRAIN = 0.012 per frame outside forest. Food limiting factors are handled by FOOD_K_FACTOR, which reduces effective K when food counts fall below the optimal threshold.`,
    acts: [
      {
        title:  'What Limits Growth?',
        sprite: 'neutral',
        body:   `Environmental conditions that restrict population growth, such as food, water, space, disease, or predation. For example, a drought reduces plant growth, limiting how many herbivores can survive.\n\nIn the simulation, each species has specific dependencies: frogs require water biomes to avoid desiccation, beetles need forest cover, and every animal needs food within reach to avoid starvation. These factors operate differently per species, per biome, per individual.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'frog',
      },
      {
        title:  'Habitat Dependency',
        sprite: 'neutral',
        body:   `Frogs desiccate when they leave water. Their hunger drains faster the further they stray from pond biomes. Beetles starve outside forest canopy — trees are not just food, they are habitat.\n\nIn agentConfig.js, FROG_WATER_BIOMES and BEETLE_FOREST_BIOMES define which biomes each species requires. Agents in the wrong biome suffer extra hunger drain every frame. Limiting factors are not a single global number — they are a network of individual constraints running simultaneously.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(1),
        highlight: 'frog',
      },
    ],
  },

  {
    id:        'predator-prey',
    cat:       'ecology',
    title:     'Predator-Prey Relationships',
    teaser:    'Population cycles emerge naturally from hunting interactions without being explicitly programmed.',
    highlight: 'hawk',
    trialBtns: [{ label: 'Trigger Migration', event: 'migration' }],
    sparklines: ['deer', 'hawk', 'frog'],
    body:
`Interactions where one organism hunts another, creating population cycles and ecosystem balance. For example, more frogs lead to more hawks, but as hawks increase, frog populations later decrease.

A key real-world example is the wolf-elk dynamics in Yellowstone National Park, where changes in predator populations directly affect herbivore numbers, vegetation growth, and overall ecosystem structure. The simulation mirrors this by creating oscillating population cycles where increases in predators reduce prey populations, followed by predator decline due to lack of food.`,
    code:
`The food web is encoded in two tables in agentConfig.js: PREY_OF (what each predator hunts) and PREDATORS_OF (what hunts each species). These drive the IBM hunting state machine in IslandCanvas.jsx. Hawks use a cone awareness zone (120° forward arc, radius 220 units scaled by speed) and switch to a hunt state when prey enters range. After a successful kill, the prey is removed from the posMap and the predator's hunger is restored by HUNGER_GAIN[preySpId].`,
    acts: [
      {
        title:  'The Predator-Prey Cycle',
        sprite: 'friendly',
        body:   `Interactions where one organism hunts another, creating population cycles and ecosystem balance. For example, more frogs lead to more hawks, but as hawks increase, frog populations later decrease.\n\nA key real-world example is the wolf-elk dynamics in Yellowstone National Park, where changes in predator populations directly affect herbivore numbers, vegetation growth, and overall ecosystem structure.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'hawk',
      },
      {
        title:  'Watch the Hunt',
        sprite: 'neutral',
        body:   `A hawk has been positioned near a deer cluster, hungry, and fast. Watch what happens.\n\nThe hawk uses a cone awareness zone — 120 degrees forward, radius 220 world units. When a deer enters that cone, the hawk locks its targetId and dives. The prey must physically run to escape. In IslandCanvas.jsx, the hunt state machine runs every animation frame. The outcome depends entirely on relative speed stats.`,
        onEnter: (posMap, _sim, setSpeed) => {
          setSpeed(1)
          const hawks = [...posMap.entries()].filter(([,e]) => e.spId === 'hawk')
          const deer  = [...posMap.entries()].filter(([,e]) => e.spId === 'deer')
          if (hawks[0] && deer[0]) {
            const [,h] = hawks[0]; const [,d] = deer[0]
            h.x = d.x + 60 * ISLAND_SCALE
            h.y = d.y - 40 * ISLAND_SCALE
            h.variation.speed = 40
            h.hunger = 25
          }
        },
        highlight: 'hawk',
      },
      {
        title:  'The Oscillation Emerges',
        sprite: 'friendly',
        body:   `Predator-prey cycles were never explicitly programmed. They appear because hawks eat deer and deer populations drop. With fewer deer, hawks starve and their numbers drop. Fewer hawks means deer recover. The cycle repeats.\n\nThe simulation mirrors the Yellowstone wolf-elk dynamic by creating oscillating population cycles. Watch the deer and hawk lines move in opposite phases on the chart below.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        highlight:  'hawk',
        sparklines: ['deer', 'hawk', 'frog'],
      },
    ],
  },

  {
    id:        'food-web',
    cat:       'ecology',
    title:     'Food Web & Trophic Levels',
    teaser:    'Energy flows from producers through herbivores to apex predators, losing some at each trophic level.',
    sparklines: ['grass', 'beetle', 'frog', 'hawk'],
    body:
`The position of organisms in a food chain based on energy transfer from producers to consumers. Grass is a producer, beetles are primary consumers, frogs are secondary consumers, and hawks are tertiary consumers at the apex.

The ecological system models food webs, energy transfer, and population regulation. A wildfire reduces plant biomass, causing delayed declines in herbivores and subsequent declines in predators, demonstrating a trophic cascade and ecosystem interdependence.`,
    code:
`The food web assembles progressively via ARRIVAL_SCHEDULE in arrivalConfig.js. Each species unlocks only after its food source is established: grass arrives after 30 trees; fungi after 800 grass; beetles after 90 fungi; deer after 80 beetles; frogs after 18 deer; hawks after 5 monitors. Trophic energy transfer is then enforced by the PREY_OF table. When a hawk eats a deer, the deer is removed from posMap and the hawk's hunger restores by HUNGER_GAIN.deer (60 units).`,
    acts: [
      {
        title:  'Trophic Levels',
        sprite: 'friendly',
        body:   `The position of organisms in a food chain based on energy transfer from producers to consumers. Grass is a producer, beetles are primary consumers, frogs are secondary consumers, and hawks are tertiary consumers at the apex.\n\nThe food web assembles progressively — each species unlocks only after its food source is established. This ensures the food chain is never broken at arrival.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        sparklines: ['grass', 'beetle', 'frog', 'hawk'],
      },
      {
        title:  'A Trophic Cascade',
        sprite: 'threat',
        body:   `A wildfire destroys most trees on the island. Deer populations initially increase as predators lose forest cover for hunting. However, as plant resources continue declining, deer populations later crash from starvation, causing the hawk populations to decline as well.\n\nThis chain reaction shows how interconnected ecosystems truly are. Energy flows up the food web. When the source weakens, the whole chain weakens.[[threat]]`,
        onEnter: (_p, sim, setSpeed) => {
          setSpeed(3)
          setTimeout(() => sim.triggerEvent('wildfire'), 200)
        },
        trialBtns:  [{ label: 'Trigger Wildfire', event: 'wildfire' }],
        sparklines: ['grass', 'deer', 'hawk'],
      },
      {
        title:  'Energy Flow',
        sprite: 'neutral',
        body:   `The ecological system models food webs, energy transfer, and population regulation. When a hawk eats a deer, the deer is removed from posMap and the hawk's hunger restores by HUNGER_GAIN.deer — 60 units.\n\nEnergy flows in one direction: sun produces growth, producers store it, herbivores extract it, carnivores extract it again. Each transfer loses some. The decomposer loop closes the cycle by returning dead matter as nutrients to producers.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        sparklines: ['grass', 'beetle', 'frog', 'hawk'],
      },
    ],
  },

  {
    id:        'population-growth',
    cat:       'ecology',
    title:     'Population Growth',
    teaser:    'Populations grow rapidly at low density, then slow as they approach carrying capacity.',
    sparklines: ['grass', 'deer'],
    body:
`The change in population size over time, which can be rapid at first but slows due to resource limits. For instance in the game, grass grows quickly after a disturbance but stabilizes as space becomes limited.

Carrying capacity limits population growth, forcing competition and preventing unlimited expansion, which reinforces ecological balance.`,
    code:
`Producers use the logistic growth equation in engine.js: growth = r × pops[id] × (1 − pops[id] / K[id]). When population is low, (1 − pops/K) approaches 1 and growth is fast. As population approaches K, the term approaches 0 and growth stops. Grass growth rate r = 0.60 per tick is amplified by the nutrient factor (up to 1.65×), meaning decomposer activity directly accelerates primary productivity and changes the effective shape of the growth curve.`,
    acts: [
      {
        title:  'The Logistic Curve',
        sprite: 'friendly',
        body:   `The change in population size over time, which can be rapid at first but slows due to resource limits. For instance in the game, grass grows quickly after a disturbance but stabilizes as space becomes limited.\n\nProducers use the logistic growth equation: growth = r × pops × (1 − pops/K). When population is low, growth is fast. As population approaches K, growth stops.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        sparklines: ['grass', 'deer'],
      },
      {
        title:  'Disturbance and Recovery',
        sprite: 'neutral',
        body:   `A drought hits. Grass drops sharply. Deer, losing their food supply, begin to decline. Then the drought ends. Grass grows back fast — low population means plenty of space, and logistic growth accelerates when populations are far below K.\n\nThis S-curve recovery is a fundamental pattern in ecology. Population growth is density-dependent, fast at low density and slow near K.`,
        onEnter: (_p, sim, setSpeed) => {
          setSpeed(2)
          setTimeout(() => sim.triggerEvent('drought'), 200)
        },
        trialBtns:  [{ label: 'Trigger Drought', event: 'drought' }],
        sparklines: ['grass', 'deer'],
      },
    ],
  },

  {
    id:        'disturbances',
    cat:       'ecology',
    title:     'Environmental Disturbances',
    teaser:    'Wildfires, droughts, disease, and cold snaps reshape the ecosystem in real time.',
    trialBtns: [
      { label: 'Wildfire',   event: 'wildfire'   },
      { label: 'Drought',    event: 'drought'    },
      { label: 'Disease',    event: 'disease'    },
      { label: 'Cold Snap',  event: 'cold_snap'  },
    ],
    body:
`Wildfires, droughts, disease outbreaks, and climate shifts are based on real-world disturbances that are becoming more frequent due to global climate change. In real ecosystems, these events reduce population sizes, alter habitats, and shift species distributions. In the simulation, these same events force rapid ecological change, allowing players to observe how fragile ecosystems respond to sudden environmental stress.

For example, a wildfire destroys most trees on the island, so deer populations initially increase as predators lose forest cover for hunting. However, as plant resources continue declining, deer populations later crash from starvation, causing the hawk populations to decline as well.`,
    code:
`Six event types are defined in the EVENTS object in engine.js: drought, disease, wildfire, cold snap, migration, and volcanic ash. Each has an apply() function (immediate one-time impact on pops) and an onTick() function (sustained pressure over its duration field in ticks). A wildfire's apply() multiplies grass by 0.35, which is 65% destruction in a single tick. Events fire automatically roughly once every 18 in-game years (1/(TICKS_PER_YEAR × 18) probability per tick), or can be triggered manually.`,
    acts: [
      {
        title:  'Environmental Pressure',
        sprite: 'neutral',
        body:   `Wildfires, droughts, disease outbreaks, and climate shifts are based on real-world disturbances that are becoming more frequent due to global climate change. In real ecosystems, these events reduce population sizes, alter habitats, and shift species distributions.\n\nSix event types are defined in engine.js: drought, disease, wildfire, cold snap, migration, and volcanic ash. Events fire automatically roughly once every 18 in-game years, or can be triggered below.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'Trigger One Live',
        sprite: 'threat',
        body:   `A wildfire destroys most vegetation. A drought cuts water and food supply. A disease targets the least resilient species — natural selection in action. A cold snap tests ectotherm heat tolerance.\n\nEach event has an apply() function for immediate impact and an onTick() function for sustained pressure. The ecosystem will respond. Watch which populations drop first, and which recover fastest. That is the food web making itself legible.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        trialBtns: [
          { label: 'Wildfire',  event: 'wildfire'  },
          { label: 'Drought',   event: 'drought'   },
          { label: 'Disease',   event: 'disease'   },
          { label: 'Cold Snap', event: 'cold_snap' },
        ],
      },
    ],
  },

  {
    id:        'decomposer',
    cat:       'ecology',
    title:     'Decomposer Loop & Symbiosis',
    teaser:    'Fungi recycle dead matter into nutrients, boosting producer growth and closing the energy loop.',
    highlight: 'fungi',
    formula:   'nutrients',
    body:
`A close interaction between species that can benefit both, benefit one, or harm one. For example, fungi break down dead organisms and return nutrients to the soil, indirectly helping plants grow.

Without decomposers, the nutrient cycle collapses and producers lose the growth boost and the entire food web weakens from the bottom. The simulation demonstrates that biodiversity is essential for ecosystem stability.`,
    code:
`In engine.js, dead matter accumulates from animal deaths and plant decay each tick. Each tick: consumed = min(dead, fungi × 0.15). Of that, nutrients += consumed × 0.45. The nutrient pool then boosts producer growth by up to 65% via nutrientFactor = 1 + min(nutrients/60, 0.65). This creates a feedback loop. More animals means more dead matter, which feeds more fungi, which returns more nutrients, which grows more producers, which supports more animals.`,
    acts: [
      {
        title:  'The Decomposer Loop',
        sprite: 'friendly',
        body:   `Fungi break down dead organisms and return nutrients to the soil, indirectly helping plants grow. This is a close symbiotic interaction — fungi depend on dead matter, producers depend on the nutrients fungi release.\n\nIn engine.js, dead matter accumulates from animal deaths. Each tick: consumed = min(dead, fungi × 0.15). Nutrients += consumed × 0.45. The nutrient pool boosts producer growth by up to 65%. Watch the numbers live.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(1),
        highlight: 'fungi',
        formula:   'nutrients',
      },
      {
        title:  'Without Decomposers',
        sprite: 'neutral',
        body:   `Without fungi, dead matter accumulates. Nutrients are not returned. Producer growth slows. The food web weakens from the bottom.\n\nMore animals means more dead matter, which feeds more fungi, which returns more nutrients, which grows more producers, which supports more animals. The loop either accelerates or collapses — there is no stable middle ground without all parts working together.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'fungi',
        formula:   'nutrients',
      },
    ],
  },

  // ── GENETICS & DNA ────────────────────────────────────────────────────

  {
    id:        'dna-codons',
    cat:       'genetics',
    title:     'DNA Base Pairing & Codons',
    teaser:    'Three-letter codons built on A–T, C–G base pairs encode every trait in the simulation.',
    highlight: 'beetle',
    body:
`DNA base pairing is the rule that DNA bases match in pairs (A–T and C–G) to ensure accurate genetic replication. When DNA copies itself in organisms, correct base pairing helps preserve genetic information unless mutations occur.

Codons are groups of three DNA bases that code for amino acids, which form proteins that determine traits. For example, a codon change in beetles can alter a protein affecting camouflage, making them harder to detect by predators. We decided to use a very simplified genetic system as the real genetics are extremely complicated.`,
    code:
`The CODONS table in codons.js maps each three-letter codon string to a trait modifier (−20 to +20). Each trait slot in the gene editor holds three codons; the total trait modifier equals the sum of all three. Maximum modification per trait: ±60 on top of the species base stat. Real codons like GAC (Hypermorphic +20), ATT (Overexpressed +20), ATG (Start codon 0), and TAA (Stop codon 0) are used, preserving actual DNA vocabulary while simplifying to 19 codons total.`,
    acts: [
      {
        title:  'DNA Base Pairing',
        sprite: 'friendly',
        body:   `DNA base pairing is the rule that DNA bases match in pairs (A–T and C–G) to ensure accurate genetic replication. When DNA copies itself in organisms, correct base pairing helps preserve genetic information unless mutations occur.\n\nCodons are groups of three DNA bases that code for amino acids, which form proteins that determine traits. For example, a codon change in beetles can alter a protein affecting camouflage, making them harder to detect by predators.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
      {
        title:  'Codons in the Simulation',
        sprite: 'neutral',
        body:   `The CODONS table in codons.js maps each three-letter codon string to a trait modifier from −20 to +20. Each trait slot holds three codons; the total modifier is their sum.\n\nWe decided to use a very simplified genetic system as the real genetics are extremely complicated. In real life, organisms have millions to billions of different bases. In the simulation we had to simplify it to a few different strands, but we still kept the core concept of mutations.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
    ],
  },

  {
    id:        'gene-expression',
    cat:       'genetics',
    title:     'Gene Expression & Phenotype',
    teaser:    'Codons sum into a trait modifier that changes observable behaviour, connecting genotype to phenotype.',
    highlight: 'beetle',
    body:
`Each organism contains a simplified genetic code that influences observable traits (phenotype), such as speed, camouflage, metabolism, and environmental tolerance. Genetic variation ensures that individuals within a population respond differently to environmental pressures.

The gene editor allows players to modify codons, producing mutations that instantly change phenotype. This creates a visible link between molecular change and organism behavior, showing how DNA directly influences ecological success.`,
    code:
`The applyDNA(baseStats, dna) function in codons.js iterates over each stat key, sums the three codon modifiers for that stat, and clamps the result to 0–100. This resolved stat is used directly by the IBM: speed affects movement velocity and awareness radius via effectiveRadius(); camouflage reduces predator detection probability; heatTolerance determines cold snap survival; metabolism controls hunger drain rate. Genotype is the codon sequence; phenotype is the resulting behaviour in the running simulation.`,
    acts: [
      {
        title:  'From Gene to Trait',
        sprite: 'friendly',
        body:   `Each organism contains a simplified genetic code that influences observable traits (phenotype), such as speed, camouflage, metabolism, and environmental tolerance. Genetic variation ensures that individuals within a population respond differently to environmental pressures.\n\nThe gene editor allows players to modify codons, producing mutations that instantly change phenotype. This creates a visible link between molecular change and organism behavior.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
      {
        title:  'applyDNA() — The Bridge',
        sprite: 'neutral',
        body:   `The applyDNA(baseStats, dna) function in codons.js iterates over each stat key, sums the three codon modifiers, and clamps the result to 0–100. This resolved stat is used directly by the IBM.\n\nSpeed affects movement velocity. Camouflage reduces predator detection probability. heatTolerance determines cold snap survival. Metabolism controls hunger drain rate. Genotype is the codon sequence. Phenotype is the resulting behaviour in the running simulation. Every beetle you see right now has a unique genotype driving its every decision.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
    ],
  },

  {
    id:        'gene-editor',
    cat:       'genetics',
    title:     'The Gene Editor',
    teaser:    'Players alter codons directly, and the mutations ripple through the population over generations.',
    highlight: 'beetle',
    sparklines: ['beetle'],
    body:
`Players can directly influence evolution through a DNA gene editor that allows codon-level modification and controlled mutations. These genetic changes alter phenotypic traits, which in turn affect survival, predator-prey interactions, and long-term population trends.

A lot of games or simulations may make mutations something that happens randomly, but by taking a slightly less realistic route, we make the mutations a lot more interactive instead of just randomly noticing a specific change that happened.`,
    code:
`When a player changes a codon in GeneEditor.jsx, the updated DNA is passed up to App.jsx's dnaBySpecies state. The useSimulation hook holds a dnaRef that always reflects the current DNA. On the next engine tick, applyDNA(baseStats, dna) resolves updated stats read by the IBM. The injectMutation() function patches the variation field of randomly selected live agents in the posMap, creating a founder effect: the mutated trait spreads through future generations as these agents reproduce via sexualOffspring().`,
    acts: [
      {
        title:  'The Gene Editor',
        sprite: 'friendly',
        body:   `Players can directly influence evolution through a DNA gene editor that allows codon-level modification and controlled mutations. These genetic changes alter phenotypic traits, which in turn affect survival, predator-prey interactions, and long-term population trends.\n\nA lot of games or simulations may make mutations something that happens randomly, but by taking a slightly less realistic route, we make the mutations a lot more interactive instead of just randomly noticing a specific change.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        highlight: 'beetle',
      },
      {
        title:  'A Mutation Spreads',
        sprite: 'neutral',
        body:   `When injectMutation() is called, it patches the variation field of randomly selected live agents in the posMap. These agents now carry the mutation. When they breed, sexualOffspring() averages their variation with their partner's, passing part of the mutation to offspring.\n\nOver generations, a mutation injected into 5 beetles can spread to the entire beetle population if it improves survival. That is the founder effect running live. The mutation frequency tracker in useSimulation.js records its spread each tick.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        highlight:  'beetle',
        sparklines: ['beetle'],
      },
    ],
  },

  // ── CODE & SYSTEMS ────────────────────────────────────────────────────

  {
    id:        'ibm-movement',
    cat:       'systems',
    title:     'IBM Agent Movement & Herds',
    teaser:    'Each animal is an individual agent with its own movement, feeding, herding, and fleeing decisions.',
    highlight: 'deer',
    body:
`In terms of coding, there are herd mechanics for certain organisms, simulating either staying together or territorial organisms. We had a god perspective on the ecosystem as we believed it would make it so that the complex elements at play are a lot easier to understand.

Each agent in the simulation is an Individual-Based Model (IBM) that makes its own decisions about movement, feeding, breeding, and fleeing based on its local environment. Rather than simulating population-level statistics directly, every deer, frog, hawk, and beetle is individually computed every animation frame.`,
    code:
`The stepMovement() function in IslandCanvas.jsx evaluates 12 candidate movement angles for each agent per frame, scoring each by: biome preference (+80 for preferred biome), food proximity (+100), predator avoidance (−200 if predator in awareness cone), herd cohesion for deer (bonds to 2 nearest conspecifics via a bonds array, with attraction starting at 130 world units apart and dropping off after 400), and reasoning noise (low reasoning stat = high random noise = less intelligent movement). The highest-scoring angle wins.`,
    acts: [
      {
        title:  'Individual-Based Models',
        sprite: 'friendly',
        body:   `In terms of coding, there are herd mechanics for certain organisms, simulating either staying together or territorial organisms.\n\nEach agent is an Individual-Based Model — it makes its own decisions about movement, feeding, breeding, and fleeing based on its local environment. Population-level patterns emerge from these individual decisions. No central controller. No scripted outcomes. Watch those deer. Each one is running its own decision loop right now.`,
        onEnter: (posMap, _sim, setSpeed) => {
          setSpeed(1)
          for (const [, e] of posMap) {
            if (e.spId !== 'deer') continue
            e.variation.reasoning = Math.max(e.variation.reasoning ?? 0, 30)
            e.variation.speed     = Math.max(e.variation.speed ?? 0, 20)
          }
          // Move hawks away from deer cluster
          for (const [, e] of posMap) {
            if (e.spId === 'hawk') {
              e.x = 370 * ISLAND_SCALE
              e.y = 80 * ISLAND_SCALE
            }
          }
          forceDeerBonds(posMap)
        },
        highlight: 'deer',
      },
      {
        title:  'Herd Bonds',
        sprite: 'neutral',
        body:   `Watch those deer. Some of them are bonded — they have a herd mate preference built into their movement scoring. When a bonded deer drifts further than 130 world units from its partner, a cohesion score pulls it back. Beyond 400 units, the bond drops.\n\nThe separation force pushes conspecifics apart at close range. Between the two forces, the deer neither pile up nor scatter. They form a loose, moving herd. This was never animated. It emerged from two opposing forces running every frame.`,
        onEnter: null,
        highlight: 'deer',
      },
      {
        title:  'Reasoning Gene',
        sprite: 'neutral',
        body:   `The reasoning gene controls path quality. High reasoning: the agent beelines toward its target, picks prey with the best energy-per-distance ratio, avoids targets already chased by herd mates.\n\nLow reasoning: up to ±63 degrees of random noise per frame. The animal wanders erratically. In a stable environment, low reasoning agents survive. In a crisis, they die first. In stepMovement(), reasoning noise is: (Math.random() - 0.5) × (1 - effReasoning / 100) × 320. The gene is visible in every path on screen right now.`,
        onEnter: (posMap, _sim, setSpeed) => {
          setSpeed(1)
          const deerList = [...posMap.entries()].filter(([,e]) => e.spId === 'deer')
          deerList.forEach(([,e], i) => {
            e.variation.reasoning = i % 2 === 0 ? -40 : 40
          })
        },
        highlight: 'deer',
      },
    ],
  },

  {
    id:        'species-arrival',
    cat:       'systems',
    title:     'Species Arrival & Island Biogeography',
    teaser:    'Species colonise sequentially, each one gated on the ecosystem being ready to support it.',
    body:
`The ability for organisms to migrate and colonize the island reflects real ecological processes such as species dispersal and island biogeography. In nature, ecosystems are constantly shaped by migration events, where new species arrive, compete, and either integrate or go extinct depending on environmental conditions.

We also decided that animals would be imported to the island, as it would allow players to get used to simple mechanics before more came up. Only the first un-arrived species in the schedule is ever evaluated. Arrivals are strictly sequential.`,
    code:
`ARRIVAL_SCHEDULE in arrivalConfig.js lists 10 species in order, each with a readyWhen() function that gates arrival on ecosystem state: deer arrive only after 80 beetles are present; hawks only after 5 monitors. Each engine tick, useSimulation.js checks the first un-arrived species' condition. When met, spawnArrival() places the founding population near a species-specific shore zone defined in ARRIVAL_HOME, simulating realistic island colonisation with each species arriving at a biologically appropriate coastal location.`,
    acts: [
      {
        title:  'Island Biogeography',
        sprite: 'friendly',
        body:   `The ability for organisms to migrate and colonize the island reflects real ecological processes such as species dispersal and island biogeography. In nature, ecosystems are constantly shaped by migration events, where new species arrive, compete, and either integrate or go extinct depending on environmental conditions.\n\nWe also decided that animals would be imported to the island, as it would allow players to get used to simple mechanics before more came up.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'The Arrival Chain',
        sprite: 'neutral',
        body:   `ARRIVAL_SCHEDULE lists 10 species in order, each with a readyWhen() function gating arrival on ecosystem state. Deer arrive only after 80 beetles are present. Hawks only after 5 monitors. Only the first un-arrived species is ever evaluated. Arrivals are strictly sequential.\n\nFirst, we have organisms come to the island which simulates invasive species, but also resiliency of ecosystems. Each new arrival spawns near a species-specific shore zone, simulating realistic island colonisation.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
    ],
  },

  {
    id:        'emergent',
    cat:       'systems',
    title:     'Emergent Behavior',
    teaser:    'Complex ecosystem patterns arise from simple rules. No population cycle was ever explicitly programmed.',
    sparklines: ['deer', 'hawk'],
    body:
`A major feature of Island of Life is emergent behavior, where complex ecosystem patterns arise naturally from simple biological rules. The simulation does not have exact outcomes for species survival or extinction. Instead, behaviors such as population cycles, adaptation, ecosystem collapse, and predator-prey oscillations emerge from the interaction between genetics, environmental pressure, food availability, and reproduction.

One unique and essential aspect of the Island of Life is that ecosystem collapse is possible and intentionally educational. Many games reward players with constant success, but this shows that biological systems can fail if biodiversity, energy flow, or population balance is disrupted.`,
    code:
`Natural selection was never programmed directly. It appears because variation exists via randDelta() in individuals.js, survival depends on those stats in IslandCanvas.jsx, and reproduction copies stats with drift via sexualOffspring(). Predator-prey cycles were never scripted either. Hawks eat deer so deer numbers drop. With fewer deer, hawks starve and their numbers drop too. Fewer hawks means deer recover. The cycle repeats. Each cycle is a consequence of IBM rules running simultaneously, not a programmed oscillation.`,
    acts: [
      {
        title:  'Emergent Behavior',
        sprite: 'friendly',
        body:   `A major feature of Island of Life is emergent behavior, where complex ecosystem patterns arise naturally from simple biological rules. The simulation does not have exact outcomes for species survival or extinction.\n\nInstead, behaviors such as population cycles, adaptation, ecosystem collapse, and predator-prey oscillations emerge from the interaction between genetics, environmental pressure, food availability, and reproduction.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'Natural Selection Emerged',
        sprite: 'neutral',
        body:   `Natural selection was never programmed directly. It appears because variation exists via randDelta() in individuals.js, survival depends on those stats in IslandCanvas.jsx, and reproduction copies stats with drift via sexualOffspring().\n\nPredator-prey cycles were never scripted either. Hawks eat deer so deer numbers drop. With fewer deer, hawks starve and their numbers drop. Fewer hawks means deer recover. The cycle repeats. Each cycle is a consequence of IBM rules running simultaneously, not a programmed oscillation.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        sparklines: ['deer', 'hawk'],
      },
    ],
  },

  // ── PROJECT ───────────────────────────────────────────────────────────

  {
    id:        'three-way',
    cat:       'project',
    title:     'The Three-Way Connection',
    teaser:    'DNA drives mutation, natural selection drives evolution, and ecology shapes which traits win over time.',
    highlight: 'beetle',
    trialBtns: [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
    sparklines: ['beetle', 'frog', 'hawk'],
    body:
`Here are the connections between the topics of evolution, ecology, and genetics. The Island of Life simulation integrates the three core biological disciplines into a single interconnected system, where changes in one domain directly influence the others.

Genetics produces variation through mutation. Ecology determines which traits are advantageous. Evolution filters those traits through survival and reproduction. These interactions create emergent behavior such as population cycles, ecosystem stability, and collapse events.

A mutation (genetics) changes a trait like camouflage. That trait improves survival during predation (ecology). Survivors reproduce more successfully (evolution via natural selection). The population changes, affecting food availability and predator numbers, feeding back into the ecosystem.`,
    code:
`The connection runs through three layers of code. In codons.js, applyDNA() converts genotype to phenotype. In IslandCanvas.jsx, the IBM uses those resolved stats to make every survival decision. In individuals.js, sexualOffspring() passes the winning traits to the next generation with a mutation delta. No single function does evolution. It is the interaction of all three systems running every frame simultaneously that produces it.`,
    acts: [
      {
        title:  'The Three-Way Connection',
        sprite: 'friendly',
        body:   `The Island of Life simulation integrates the three core biological disciplines into a single interconnected system, where changes in one domain directly influence the others.\n\nGenetics produces variation through mutation. Ecology determines which traits are advantageous. Evolution filters those traits through survival and reproduction. These interactions create emergent behavior such as population cycles, ecosystem stability, and collapse events.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'One Codon — Three Topics',
        sprite: 'neutral',
        body:   `A mutation (genetics) changes a trait like camouflage. That trait improves survival during predation (ecology). Survivors reproduce more successfully (evolution via natural selection). The population changes, affecting food availability and predator numbers, feeding back into the ecosystem.\n\nWatch this play out. These beetles have been split: half with high camouflage, half with low. A cold snap is incoming. Watch which genes survive — and then watch the ecosystem respond.[[neutral]]`,
        onEnter: (posMap, sim, setSpeed) => {
          setSpeed(2)
          const beetles = [...posMap.entries()].filter(([,e]) => e.spId === 'beetle')
          beetles.forEach(([,e], i) => { e.variation.camouflage = i % 2 === 0 ? -40 : 40 })
          setTimeout(() => sim.triggerEvent('cold_snap'), 200)
        },
        highlight:  'beetle',
        trialBtns:  [{ label: 'Trigger Cold Snap', event: 'cold_snap' }],
      },
      {
        title:  'The Feedback Loop',
        sprite: 'friendly',
        body:   `The relationship between all three systems is continuous and circular. Genetics produces variation through mutation. Ecology determines which traits are advantageous. Evolution filters those traits through survival and reproduction.\n\nThe connection runs through three layers of code. applyDNA() converts genotype to phenotype. The IBM uses those stats for survival decisions. sexualOffspring() inherits the winning traits with a mutation delta. No single function does evolution. It is the interaction of all three systems running every frame simultaneously that produces it.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(3),
        sparklines: ['beetle', 'frog', 'hawk'],
      },
    ],
  },

  {
    id:        'realworld',
    cat:       'project',
    title:     'Real-World Significance',
    teaser:    'Yellowstone wolves, antibiotic resistance, and cheetah genetics all run on the same underlying mechanics.',
    sparklines: ['deer', 'hawk'],
    trialBtns: [{ label: 'Trigger Wildfire', event: 'wildfire' }],
    body:
`The systems in the Island of Life simulation are motivated by real biological, ecological, and environmental processes observed in natural ecosystems. The goal is to see how living systems behave in reality by modeling the same relationships between genetics, population dynamics, environmental pressure, and ecosystem stability.

Yellowstone National Park: when wolves were reintroduced in 1995, elk populations shifted, vegetation recovered, and river systems changed. One predator-prey relationship restructured an entire ecosystem. Antibiotic resistance demonstrates natural selection in real time. Endangered species such as cheetahs demonstrate the real cost of the bottleneck effect.`,
    cites: [
      { label: 'Yellowstone Wolf Reintroduction — National Park Service',        url: 'nps.gov/yell/learn/nature/wolf.htm' },
      { label: 'Food Web Structure & Energy Flow — National Geographic Education', url: 'education.nationalgeographic.org/resource/food-web/' },
    ],
    acts: [
      {
        title:  'Real-World Connections',
        sprite: 'friendly',
        body:   `The systems in the Island of Life simulation are motivated by real biological, ecological, and environmental processes observed in natural ecosystems.\n\nYellowstone National Park: when wolves were reintroduced in 1995, elk populations shifted, vegetation recovered, and river systems changed. One predator-prey relationship restructured an entire ecosystem. Antibiotic resistance demonstrates natural selection in real time. Endangered species such as cheetahs demonstrate the real cost of the bottleneck effect.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
        sparklines: ['deer', 'hawk'],
      },
      {
        title:  'The Trophic Cascade Live',
        sprite: 'threat',
        body:   `A wildfire will now remove most of the island's vegetation. Watch the cascade.\n\nHerbivore food supply drops. Deer populations crash. With fewer deer, hawk populations follow. With fewer hawks, some prey populations temporarily recover. Then starvation takes them too.\n\nThis is the Yellowstone cascade — one event at the base of the food web restructuring everything above it. The simulation models that same chain reaction every frame.[[threat]]`,
        onEnter: (_p, sim, setSpeed) => {
          setSpeed(3)
          setTimeout(() => sim.triggerEvent('wildfire'), 200)
        },
        trialBtns:  [{ label: 'Trigger Wildfire', event: 'wildfire' }],
        sparklines: ['deer', 'hawk'],
      },
    ],
  },

  {
    id:        'rationale',
    cat:       'project',
    title:     'Why a Game: Design Rationale',
    teaser:    'A game lets all three biological disciplines run simultaneously and be observed at the same time.',
    body:
`We decided to choose a game format, as with a traditional explanation, it is impossible to talk about all of the complex ideas at once, but with a game format, different aspects of evolution, ecology, and genetics can happen at the same time, and one could simply look closer at each one one at a time. It has been proven that games that also have learning in them can cause people to learn without even realizing.

We had a god perspective on the ecosystem as we believed it would make it so that the complex elements at play are a lot easier to understand. We decided to allow you to change genetics to simulate "mutations" then watch it ripple through the population.`,
    acts: [
      {
        title:  'Why a Game?',
        sprite: 'friendly',
        body:   `We decided to choose a game format, as with a traditional explanation, it is impossible to talk about all of the complex ideas at once, but with a game format, different aspects of evolution, ecology, and genetics can happen at the same time, and one could simply look closer at each one one at a time.\n\nIt has been proven that games that also have learning in them can cause people to learn without even realizing. A simulation may also have been a possible solution, but by choosing a game, we added interaction and made a reason for people to want to experience the learning.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'Why These Mechanics?',
        sprite: 'neutral',
        body:   `We had a god perspective on the ecosystem as we believed it would make it so that the complex elements at play are a lot easier to understand. We also decided that animals would be imported to the island, as it would allow players to get used to simple mechanics before more came up.\n\nAdditionally, we decided to allow you to change genetics to simulate mutations then watch it ripple through the population. A lot of games or simulations may make mutations something that happens randomly, but by taking a slightly less realistic route, we make the mutations a lot more interactive.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
    ],
  },

  {
    id:        'limitations',
    cat:       'project',
    title:     'Limitations & Reflection',
    teaser:    'Every simplification was a deliberate trade between accuracy and observability.',
    body:
`One limitation is that genetics in the simulation is simplified into a few codons / traits, while real DNA is much more complex. In real organisms, one gene can affect multiple traits at the same time, but in the game one codon usually changes only one clear trait.

Another limitation is that the environment is simplified into one shared island, so all organisms experience the same conditions at the same time. A third limitation is that population changes are more controlled and predictable than in real ecosystems.

Before building this, evolution was a concept that happened over millions of years to populations you could not observe. After writing the natural selection code, it became a mathematical consequence of survival probability and reproduction rate. The mechanism became visible. Natural selection was never coded. It appeared.`,
    acts: [
      {
        title:  'What We Simplified',
        sprite: 'neutral',
        body:   `One limitation is that genetics in the simulation is simplified into a few codons and traits, while real DNA is much more complex. In real organisms, one gene can affect multiple traits at the same time, but in the game one codon usually changes only one clear trait.\n\nAnother limitation is that the environment is simplified into one shared island, so all organisms experience the same conditions at the same time. A third limitation is that population changes are more controlled and predictable than in real ecosystems.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
      {
        title:  'What We Learned',
        sprite: 'friendly',
        body:   `Before building this, evolution was a concept that happened over millions of years to populations you could not observe. After writing the natural selection code, it became a mathematical consequence of survival probability and reproduction rate. The mechanism became visible. Natural selection was never coded. It appeared.\n\nBiology is not a set of isolated topics, but an interconnected system where genetics determines variation, ecology determines environmental pressure, and evolution determines long-term change. By having these relationships run in real time, the Island of Life allows anyone to observe how small molecular changes can scale into large ecosystem-level effects.`,
        onEnter: (_p, _s, setSpeed) => setSpeed(2),
      },
    ],
  },
]

// ── Main component ────────────────────────────────────────────────────

export default function ShowcasePage() {
  const navigate = useNavigate()

  // Grid mode state
  const [expandedId,     setExpandedId]     = useState(null)
  const [activeCategory, setActiveCategory] = useState('evolution')
  const [firedTrials,    setFiredTrials]    = useState(new Set())

  // Scene mode state
  const [mode,           setMode]           = useState('grid')
  const [sceneCardId,    setSceneCardId]    = useState(null)
  const [actIdx,         setActIdx]         = useState(0)
  const [charCount,      setCharCount]      = useState(0)
  const [isTyping,       setIsTyping]       = useState(false)
  const [mouthOpen,      setMouthOpen]      = useState(false)
  const [spriteOverride, setSpriteOverride] = useState(null)

  // Shared state
  const [speed,       setSpeed]       = useState(3)
  const [worldLoaded, setWorldLoaded] = useState(false)
  const [winPos,  setWinPos]  = useState({ x: 40, y: 0 })
  const [winSize, setWinSize] = useState({ w: 820, h: 380 })

  const sectionRefs    = useRef({})
  const biomeScoresRef = useRef({})
  const posMapRef      = useRef(new Map())
  const popsRef        = useRef({})
  const biomeAtRef     = useRef(null)
  const simTickRef     = useRef(0)
  const externalVpRef  = useRef(null)
  const typingRef      = useRef(null)
  const mouthRef       = useRef(null)

  const dnaOverrides = useMemo(() =>
    Object.fromEntries(SPECIES.map(s => [
      s.id, Object.fromEntries(Object.entries(s.dna).map(([k, v]) => [k, [...v]])),
    ])), []
  )
  const dnaBySpecies = useMemo(() =>
    Object.fromEntries(SPECIES.map(s => [s.id, { baseStats: s.stats, dna: dnaOverrides[s.id] }])),
    [dnaOverrides]
  )

  const sim = useSimulation(speed, dnaBySpecies, biomeScoresRef, posMapRef, popsRef, biomeAtRef)
  simTickRef.current = sim.tick

  // Init world on mount
  useEffect(() => {
    if (worldLoaded) return
    const check = setInterval(() => {
      if (biomeAtRef.current) {
        clearInterval(check)
        sim.initDevWorld()
        setWorldLoaded(true)
      }
    }, 300)
    return () => clearInterval(check)
  }, [worldLoaded])

  // Set initial overseer window position
  useEffect(() => {
    const h = window.innerHeight
    setWinPos({ x: 40, y: Math.max(48, h - 410) })
  }, [])

  // ── Scene mode helpers ──────────────────────────────────────────────

  const sceneCard    = sceneCardId ? CARDS.find(c => c.id === sceneCardId) : null
  const currentAct   = sceneCard?.acts?.[actIdx] ?? null
  const { clean: fullText, changes: spriteChanges } = currentAct
    ? parseBody(currentAct.body)
    : { clean: '', changes: [] }
  const isDone = charCount >= fullText.length

  function startTyping() {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
    setSpriteOverride(null)
  }

  function skipTyping() {
    clearInterval(typingRef.current)
    setCharCount(fullText.length)
    setIsTyping(false)
    if (spriteChanges.length > 0)
      setSpriteOverride(spriteChanges[spriteChanges.length - 1].sprite)
  }

  // Typewriter effect
  useEffect(() => {
    if (!isTyping || mode !== 'scene') return
    typingRef.current = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1
        const change = spriteChanges.find(c => c.atChar === next)
        if (change) setSpriteOverride(change.sprite)
        if (next >= fullText.length) {
          clearInterval(typingRef.current)
          setIsTyping(false)
        }
        return next
      })
    }, CHAR_DELAY)
    return () => clearInterval(typingRef.current)
  }, [isTyping, fullText, spriteChanges, mode])

  // Mouth animation
  useEffect(() => {
    if (!isTyping || mode !== 'scene') { setMouthOpen(false); return }
    mouthRef.current = setInterval(() => setMouthOpen(o => !o), MOUTH_DELAY)
    return () => clearInterval(mouthRef.current)
  }, [isTyping, mode])

  // Reset typewriter when act changes
  useEffect(() => {
    if (mode !== 'scene' || !currentAct) return
    startTyping()
  }, [actIdx, sceneCardId, mode])

  const runActEnter = useCallback((act) => {
    if (act?.onEnter) {
      setTimeout(() => act.onEnter(posMapRef.current, sim, setSpeed), 300)
    }
    if (act?.trialBtns === undefined && act?.trialBtn) {
      // nothing — just for backwards compat
    }
  }, [sim])

  function enterScene(cardId) {
    const card = CARDS.find(c => c.id === cardId)
    if (!card?.acts?.length) return
    setFiredTrials(new Set())
    setSceneCardId(cardId)
    setActIdx(0)
    setMode('scene')
    sim.initDevWorld()
    if (card.acts[0]?.onEnter) {
      setTimeout(() => card.acts[0].onEnter(posMapRef.current, sim, setSpeed), 400)
    }
  }

  function exitScene() {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setMode('grid')
    setSceneCardId(null)
    setActIdx(0)
    setFiredTrials(new Set())
    setSpeed(3)
  }

  function goNext() {
    if (!isDone) { skipTyping(); return }
    const acts = sceneCard?.acts ?? []
    if (actIdx < acts.length - 1) {
      const nextIdx = actIdx + 1
      setActIdx(nextIdx)
      runActEnter(acts[nextIdx])
    } else {
      exitScene()
    }
  }

  function goPrev() {
    if (actIdx > 0) {
      const prevIdx = actIdx - 1
      setActIdx(prevIdx)
      runActEnter(sceneCard?.acts?.[prevIdx] ?? null)
    } else {
      exitScene()
    }
  }

  function fireTrial(cardId, eventId) {
    sim.triggerEvent(eventId)
    setFiredTrials(prev => new Set([...prev, `${cardId}:${eventId}`]))
  }

  // Grid helpers
  function toggle(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const expandedCard = CARDS.find(c => c.id === expandedId) ?? null

  // Derived for scene mode
  const stepSprite    = spriteOverride ?? currentAct?.sprite ?? 'neutral'
  const talkingSprite = mouthOpen ? 'neutral' : 'friendly'
  const narratorKey   = isTyping && stepSprite !== 'threat' ? talkingSprite : stepSprite
  const displayed     = fullText.slice(0, charCount)
  const isFirstAct    = actIdx === 0
  const isLastAct     = actIdx === (sceneCard?.acts?.length ?? 1) - 1

  const sceneHighlight = currentAct?.highlight ?? sceneCard?.highlight ?? null

  // ── Scene mode render ───────────────────────────────────────────────

  if (mode === 'scene' && sceneCard) {
    const acts = sceneCard.acts ?? []
    const cat  = CATEGORIES.find(c => c.id === sceneCard.cat)

    return (
      <div className="sc">
        <div className="sc__scene">
          {/* Full-screen simulation */}
          <div className="sc__scene-sim">
            <IslandCanvas
              speed={speed}
              pops={sim.pops}
              individuals={sim.individuals}
              dnaOverrides={dnaOverrides}
              biomeScoresRef={biomeScoresRef}
              posMapRef={posMapRef}
              popsRef={popsRef}
              biomeAtRef={biomeAtRef}
              simTickRef={simTickRef}
              arrivedSpecies={sim.arrivedSpecies}
              diversityRef={sim.diversityRef}
              deathLogRef={sim.deathLogRef}
              highlightSpecies={sceneHighlight}
              externalVpRef={externalVpRef}
            />
            {!worldLoaded && <div className="sc__loading">Initialising ecosystem…</div>}
          </div>

          {/* Back to cards */}
          <button className="sc__back-btn pixel-btn pixel-btn--outline" onClick={exitScene}>
            Back to Cards
          </button>

          {/* Speed controls */}
          <div className="sc__scene-speed">
            <button className={`sc__spd${speed===0?' sc__spd--on':''}`} onClick={() => setSpeed(0)}>Pause</button>
            <button className={`sc__spd${speed===1?' sc__spd--on':''}`} onClick={() => setSpeed(1)}>1×</button>
            <button className={`sc__spd${speed===3?' sc__spd--on':''}`} onClick={() => setSpeed(3)}>3×</button>
            <button className={`sc__spd${speed===5?' sc__spd--on':''}`} onClick={() => setSpeed(5)}>5×</button>
            <span className="sc__yr">Yr {sim.year}</span>
          </div>

          {/* Overseer window */}
          <FloatingWindow
            title={`${sceneCard.title} — ${actIdx + 1} / ${acts.length}`}
            pos={winPos} size={winSize} zIndex={200}
            onClose={exitScene}
            onFocus={() => {}}
            onMove={setWinPos}
            onResize={setWinSize}
            minW={560} minH={280}
          >
            <div className="tut-win">

              {/* Progress pips */}
              <div className="tut-win__meta">
                <span className="tut-win__counter">
                  <span style={{ color: cat?.color }}>■</span>&nbsp;{sceneCard.title}
                </span>
                <div className="tut-win__bar">
                  {acts.map((_, i) => (
                    <div
                      key={i}
                      className={`tut-win__pip${i <= actIdx ? ' tut-win__pip--done' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setActIdx(i); runActEnter(acts[i]) }}
                      title={acts[i].title}
                    />
                  ))}
                </div>
              </div>

              <div className="tut-win__divider" />

              {/* Narrator + dialogue */}
              <div className="tut-win__content-row">
                <div className={`tut-win__stage tut-win__stage--${stepSprite}`}>
                  {Object.entries(NARRATOR_IMGS).map(([key, src]) => (
                    <img
                      key={key} src={src} alt={key}
                      className="tut-win__narrator"
                      style={{ opacity: narratorKey === key ? 1 : 0 }}
                    />
                  ))}
                </div>

                <div
                  className="tut-win__dialogue"
                  onClick={!isDone ? skipTyping : undefined}
                  style={{ cursor: !isDone ? 'pointer' : 'default' }}
                >
                  <div className="tut-win__step-title">{currentAct?.title}</div>
                  <div className="tut-win__text">
                    {displayed.split('\n').map((line, i, arr) =>
                      line === ''
                        ? <br key={i} />
                        : <span key={i}>
                            {line}
                            {i === arr.length - 1 && !isDone
                              ? <span className="tut-cursor">▮</span>
                              : <br />}
                          </span>
                    )}

                    {isDone && currentAct?.formula === 'k' && (
                      <KWidget pops={sim.pops} tick={sim.tick} />
                    )}
                    {isDone && currentAct?.formula === 'nutrients' && (
                      <NutrientWidget deadMatter={sim.deadMatter} pops={sim.pops} />
                    )}
                    {isDone && currentAct?.formula === 'diversity' && (
                      <DiversityWidget diversity={sim.diversity} arrivedSpecies={sim.arrivedSpecies} />
                    )}

                    {isDone && currentAct?.sparklines?.length > 0 && (
                      <SparklineWidget species={currentAct.sparklines} popHistory={sim.popHistory} />
                    )}

                    {isDone && currentAct?.trialBtns?.length > 0 && (
                      <div className="sc-card__trials">
                        {currentAct.trialBtns.map(btn => {
                          const key     = `${sceneCard.id}:${btn.event}`
                          const fired   = firedTrials.has(key)
                          const blocked = !!sim.event
                          return (
                            <button
                              key={btn.event}
                              className="pixel-btn sc-trial-btn"
                              onClick={e => { e.stopPropagation(); if (!fired && !blocked) fireTrial(sceneCard.id, btn.event) }}
                              disabled={fired || blocked}
                            >
                              {fired ? 'Done' : blocked ? 'Event active' : btn.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nav */}
              <div className="tut-win__nav">
                <div className="tut-win__nav-left">
                  {!isFirstAct && (
                    <button className="pixel-btn tut-btn" onClick={goPrev}>Back</button>
                  )}
                  {isFirstAct && (
                    <button className="pixel-btn tut-btn pixel-btn--outline" onClick={exitScene}>Cards</button>
                  )}
                </div>
                <div className="tut-win__nav-right">
                  {!isDone
                    ? <button className="pixel-btn tut-btn" onClick={skipTyping}>Skip</button>
                    : isLastAct
                      ? <button className="pixel-btn tut-btn" onClick={exitScene}>Done</button>
                      : <button className="pixel-btn tut-btn" onClick={goNext}>Next</button>
                  }
                </div>
              </div>

            </div>
          </FloatingWindow>
        </div>
      </div>
    )
  }

  // ── Grid mode render ────────────────────────────────────────────────

  return (
    <div className="sc">

      <div className="sc__topbar">
        <span className="sc__toplabel">Island of Life — Biology Final Project Showcase</span>
        <div className="sc__topcontrols">
          <button className="sc__spd" onClick={() => navigate('/teacher')}>Full Walkthrough</button>
          <button className={`sc__spd${speed===0?' sc__spd--on':''}`} onClick={() => setSpeed(0)}>Pause</button>
          <button className={`sc__spd${speed===1?' sc__spd--on':''}`} onClick={() => setSpeed(1)}>1×</button>
          <button className={`sc__spd${speed===3?' sc__spd--on':''}`} onClick={() => setSpeed(3)}>3×</button>
          <button className={`sc__spd${speed===5?' sc__spd--on':''}`} onClick={() => setSpeed(5)}>5×</button>
          <span className="sc__yr">Yr {sim.year}</span>
        </div>
      </div>

      <div className="sc__body">

        <div className="sc__sim">
          <IslandCanvas
            speed={speed}
            pops={sim.pops}
            individuals={sim.individuals}
            dnaOverrides={dnaOverrides}
            biomeScoresRef={biomeScoresRef}
            posMapRef={posMapRef}
            popsRef={popsRef}
            biomeAtRef={biomeAtRef}
            simTickRef={simTickRef}
            arrivedSpecies={sim.arrivedSpecies}
            diversityRef={sim.diversityRef}
            deathLogRef={sim.deathLogRef}
            highlightSpecies={expandedCard?.highlight ?? null}
            externalVpRef={externalVpRef}
          />
          {!worldLoaded && <div className="sc__loading">Initialising ecosystem…</div>}
        </div>

        <div className="sc__panel">

          {/* Sticky category tabs */}
          <div className="sc__tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`sc__tab${activeCategory === cat.id ? ' sc__tab--active' : ''}`}
                style={activeCategory === cat.id ? { boxShadow: `inset 0 -2px 0 ${cat.color}`, color: cat.color } : {}}
                onClick={() => {
                  setActiveCategory(cat.id)
                  sectionRefs.current[cat.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {CATEGORIES.map(cat => {
            const catCards = CARDS.filter(c => c.cat === cat.id)
            return (
              <div key={cat.id} className="sc__section" ref={el => sectionRefs.current[cat.id] = el}>
                <div className="sc__section-title" style={{ borderBottomColor: cat.color }}>
                  <span className="sc__section-dot" style={{ background: cat.color }} />
                  {cat.label}
                </div>
                <div className="sc__grid">
                  {catCards.map(card => {
                    const isOpen = expandedId === card.id
                    return (
                      <div
                        key={card.id}
                        className={`sc-card${isOpen ? ' sc-card--expanded' : ''}`}
                        style={{ borderLeftColor: cat.color }}
                        onClick={() => !isOpen && toggle(card.id)}
                      >
                        <div className="sc-card__header">
                          <span className="sc-card__cat" style={{ background: cat.color }}>{cat.label}</span>
                          <span className="sc-card__title">{card.title}</span>
                          {isOpen && (
                            <button className="sc-card__close" onClick={e => { e.stopPropagation(); toggle(card.id) }}>✕</button>
                          )}
                        </div>

                        {!isOpen && <div className="sc-card__teaser">{card.teaser}</div>}

                        {isOpen && (
                          <>
                            <div className="sc-card__body">{card.body}</div>

                            {/* Deep dive button */}
                            {card.acts?.length > 0 && (
                              <div className="sc-card__deepdive">
                                <button
                                  className="pixel-btn sc-deepdive-btn"
                                  onClick={e => { e.stopPropagation(); enterScene(card.id) }}
                                >
                                  Deep Dive with Overseer
                                </button>
                              </div>
                            )}

                            {/* Trial buttons */}
                            {card.trialBtns?.length > 0 && (
                              <div className="sc-card__trials">
                                {card.trialBtns.map(btn => {
                                  const key     = `${card.id}:${btn.event}`
                                  const fired   = firedTrials.has(key)
                                  const blocked = !!sim.event
                                  return (
                                    <button
                                      key={btn.event}
                                      className="pixel-btn sc-trial-btn"
                                      onClick={e => { e.stopPropagation(); if (!fired && !blocked) fireTrial(card.id, btn.event) }}
                                      disabled={fired || blocked}
                                    >
                                      {fired ? 'Done' : blocked ? 'Event active' : btn.label}
                                    </button>
                                  )
                                })}
                              </div>
                            )}

                            {/* Code section */}
                            {card.code && (
                              <div className="sc-card__code">
                                <div className="sc-card__code-label">How it's coded</div>
                                <div className="sc-card__code-body">{card.code}</div>
                              </div>
                            )}

                            {/* Formula widgets */}
                            {card.formula === 'k'         && <KWidget pops={sim.pops} tick={sim.tick} />}
                            {card.formula === 'nutrients' && <NutrientWidget deadMatter={sim.deadMatter} pops={sim.pops} />}
                            {card.formula === 'diversity' && <DiversityWidget diversity={sim.diversity} arrivedSpecies={sim.arrivedSpecies} />}

                            {/* Sparklines */}
                            {card.sparklines?.length > 0 && (
                              <SparklineWidget species={card.sparklines} popHistory={sim.popHistory} />
                            )}

                            {/* Works cited */}
                            {card.cites?.length > 0 && (
                              <div className="sc-card__code">
                                <div className="sc-card__code-label">Works Cited</div>
                                <div className="sc-card__code-body">
                                  {card.cites.map((c, i) => (
                                    <div key={i} className="sc-card__cite">{c.label}<br /><span className="sc-card__cite-url">{c.url}</span></div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
