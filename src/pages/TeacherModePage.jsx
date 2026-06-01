import React, { useState, useEffect, useRef, useMemo } from 'react'
import FloatingWindow   from '../components/FloatingWindow.jsx'
import SpotlightOverlay from '../components/SpotlightOverlay.jsx'
import IslandCanvas     from '../components/IslandCanvas.jsx'
import { SPECIES }      from '../data/species.js'
import { useSimulation } from '../simulation/useSimulation.js'
import { K }            from '../simulation/engine.js'
import { CARRYING_CAPACITY, SEASON_K_FACTOR } from '../simulation/agentConfig.js'
import { getSeason }    from '../simulation/individuals.js'
import narratorFriendly from '../assets/sprites/narrator/pose_friendly.png'
import narratorNeutral  from '../assets/sprites/narrator/pose_neutral.png'
import narratorThreat   from '../assets/sprites/narrator/pose_threat.png'
import '../components/TutorialWindow.css'
import './TeacherModePage.css'

const NARRATOR_IMGS = { friendly: narratorFriendly, neutral: narratorNeutral, threat: narratorThreat }
const CHAR_DELAY  = 22
const MOUTH_DELAY = 160
const ALL_K = { ...K, ...CARRYING_CAPACITY }

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

// ── Live formula components ───────────────────────────────────────────

function KFormula({ pops, tick }) {
  const season = getSeason(tick)
  const seasonMult = SEASON_K_FACTOR[season.name] ?? 1
  const grassCount = Math.round(pops.grass ?? 0)
  const boarCount  = Math.round(pops.boar  ?? 0)
  const adjusted   = Math.max(0, grassCount - boarCount * 0.4)
  const optimal    = 2000
  const ratio      = Math.min(1.5, Math.max(0.15, adjusted / optimal)).toFixed(2)
  const effectiveK = Math.max(1, Math.round(60 * parseFloat(ratio) * seasonMult))
  return (
    <div className="tm-formula">
      <div className="tm-formula__title">LIVE: Carrying Capacity for Deer</div>
      <div className="tm-formula__row">effectiveK = baseK × (food / optimal) × season</div>
      <div className="tm-formula__row tm-formula__row--calc">
        = 60 × ({adjusted.toFixed(0)} / {optimal}) × {seasonMult.toFixed(2)}
      </div>
      <div className="tm-formula__row tm-formula__row--result">
        = <span className="tm-formula__val">{effectiveK}</span>
        <span className="tm-formula__season"> {season.name}</span>
      </div>
      <div className="tm-formula__note">Grass: {grassCount} | Boar consuming {(boarCount * 0.4).toFixed(0)} units | Adjusted: {adjusted.toFixed(0)}</div>
    </div>
  )
}

function DiversityFormula({ diversity, arrivedSpecies }) {
  const entries = Object.entries(diversity)
    .filter(([id]) => arrivedSpecies?.has(id))
    .sort(([, a], [, b]) => a - b)
  if (!entries.length) return null
  return (
    <div className="tm-formula">
      <div className="tm-formula__title">LIVE: Genetic Diversity Index (0 = fully inbred, 100 = diverse)</div>
      {entries.map(([spId, idx]) => {
        const sp  = SPECIES.find(s => s.id === spId)
        const col = idx >= 60 ? '#4caf50' : idx >= 30 ? '#c08820' : '#c04020'
        const warn = idx < 30 ? '  INBREEDING RISK' : ''
        return (
          <div key={spId} className="tm-formula__bar-row">
            <span className="tm-formula__bar-label">{sp?.name}</span>
            <div className="tm-formula__bar-track">
              <div className="tm-formula__bar-fill" style={{ width: `${idx}%`, background: col }} />
            </div>
            <span className="tm-formula__bar-val" style={{ color: col }}>{idx}{warn}</span>
          </div>
        )
      })}
    </div>
  )
}

function NutrientFormula({ deadMatter, pops }) {
  const fungi    = Math.round(pops.fungi ?? 0)
  const consumed = Math.min(deadMatter, fungi * 0.15).toFixed(1)
  const returned = (parseFloat(consumed) * 0.45).toFixed(1)
  return (
    <div className="tm-formula">
      <div className="tm-formula__title">LIVE: Decomposer Loop</div>
      <div className="tm-formula__row">Dead matter pool: <b>{Math.round(deadMatter)}</b> units</div>
      <div className="tm-formula__row">Fungi: <b>{fungi}</b> × 0.15 = <b>{consumed}</b> consumed/tick</div>
      <div className="tm-formula__row tm-formula__row--result">
        Nutrients returned: {consumed} × 0.45 = <span className="tm-formula__val">{returned}</span> /tick
      </div>
      <div className="tm-formula__note">Nutrients boost grass and tree growth by up to 65%</div>
    </div>
  )
}

function ConceptList({ concepts }) {
  if (!concepts?.length) return null
  return (
    <div className="tm-concepts">
      {concepts.map(c => (
        <span key={c} className="concept-badge">{c}</span>
      ))}
    </div>
  )
}

// ── Walkthrough script — 20 acts covering all 22 biology concepts ─────
// Each act has a `concepts` array listing the specific rubric concepts demonstrated.

const ACTS = [
  {
    title:    'What You Are Looking At',
    sprite:   'neutral',
    concepts: [],
    body: `This is Island of Life. A real-time ecosystem simulation built as a high school biology final project demonstrating Evolution, Ecology, and DNA.\n\nEvery organism you see is a software agent making independent decisions every animation frame. The hawk circling overhead is running a targeting algorithm. The beetles are returning to their home trees. The deer are deciding whether to graze or flee.\n\nNone of it is animated. None of it is scripted. It is running right now.\n\nI suggest you watch for a moment before we continue.[[friendly]]`,
    onEnter:     (_sim, setSpeed) => setSpeed(1),
    highlightEl: '.island-canvas-wrap',
  },
  {
    title:    'What This Project Covers',
    sprite:   'neutral',
    concepts: ['Evolution', 'Ecology', 'DNA & Genetics'],
    body: `This project demonstrates mastery of three biology topics: Evolution, Ecology, and DNA.\n\nNot as a poster. Not as a diagram. As a functioning simulation where every concept is mechanically enforced by mathematics running at sixty frames per second.\n\nEvolution: natural selection, mutation, adaptation, fitness, genetic drift, bottleneck effect, allele frequency, inbreeding depression, sexual selection.\n\nEcology: predator-prey relationships, trophic levels, carrying capacity, limiting factors, population growth, symbiotic relationships, autotrophs and heterotrophs, matter and energy flow, habitat dependency, resource competition.\n\nDNA: base pairing, codons, gene expression, point mutation.\n\nTwenty-two specific biology concepts. All mechanically implemented. All running live on this island right now.[[friendly]]`,
  },
  {
    title:    'Trophic Levels & The Food Web',
    sprite:   'friendly',
    concepts: ['Trophic Levels', 'Matter & Energy Flow', 'Food Web'],
    body: `The island supports ten species across five trophic levels.\n\nFungi at the base as decomposers. Grass and trees as producers — autotrophs. Beetles, fireflies, deer, and boar as primary consumers. Frogs and monitor lizards as secondary consumers. The hawk at the top as the apex predator.\n\nTrophic levels describe the position of organisms in a food chain based on energy transfer from producers to consumers. Grass is a producer. Beetles are primary consumers. Frogs are secondary consumers. Hawks are apex predators.\n\nEnergy flows upward through trophic levels. Approximately 10% transfers at each step. This means the island can support many more beetles than hawks — reflected in their respective carrying capacities: 300 beetles versus 10 hawks.\n\nThe Ecosystem panel has an interactive food web diagram. When a species goes extinct, its arrows go dashed. The cascade propagates upward. The code does not model a food web. It models individual hunger. The food web emerges from that.`,
  },
  {
    title:    'Autotrophs, Heterotrophs & Symbiosis',
    sprite:   'neutral',
    concepts: ['Autotrophs vs Heterotrophs', 'Symbiotic Relationships', 'Decomposer Loop'],
    body: `Every organism on the island is either an autotroph or a heterotroph.\n\nAutotrophs — grass and fig trees — produce their own energy using soil nutrients. They require no other organism to eat. They are the base of all energy on the island.\n\nHeterotrophs consume other organisms. This includes every animal on the island and the fungi.\n\nThe fungi represent a symbiotic relationship with the ecosystem. They break down dead organisms and return 45% of the consumed matter as soil nutrients, indirectly helping grass and trees grow. Remove them and grass growth slows. Producers weaken. The entire food web weakens from the bottom up.\n\nThis is not a passive relationship. The decomposer loop is mechanically load-bearing. Without it, the nutrient cycle collapses and nothing grows efficiently.\n\nThe numbers below are running live.`,
    formula: 'nutrients',
  },
  {
    title:    'Predator-Prey Dynamics',
    sprite:   'neutral',
    concepts: ['Predator-Prey Relationships', 'Population Cycles', 'Ecosystem Balance'],
    body: `Predator-prey relationships describe interactions where one organism hunts another, creating population cycles and ecosystem balance.\n\nIn this simulation: more frogs mean more food for hawks. Hawk populations rise. Hawks eat more frogs. Frog populations decline. Hawks go hungry. Hawk populations fall. Frogs recover. The cycle continues without any line of code specifying it.\n\nThis mirrors the wolf-elk dynamics in Yellowstone National Park. When wolves were reintroduced in 1995, elk populations shifted, vegetation recovered in previously overgrazed areas, and river systems were altered by changed elk movement patterns. One predator restructured an entire ecosystem.\n\nPredator-prey oscillations are not a game mechanic. They are a mathematical consequence of hunger, reproduction, and death running simultaneously.[[threat]]`,
  },
  {
    title:    'Carrying Capacity & Limiting Factors',
    sprite:   'neutral',
    concepts: ['Carrying Capacity', 'Limiting Factors', 'Logistic Population Growth'],
    body: `Carrying capacity is the maximum population size an environment can support based on available resources like food and space.\n\nK is not a fixed ceiling. Every frame: effectiveK = baseK × food ratio × season multiplier.\n\nIf grass falls below optimal for deer, deer K shrinks proportionally. In winter, all K values drop. In spring they rise 15%. Deer and boar compete for the same grass — each boar removes 0.4 units from deer-accessible food supply.\n\nWhen population exceeds 80% of effective K, a crowding multiplier increases hunger drain. Population growth slows as resources become limiting. This is logistic growth. Not a label on a diagram. An equation running every frame.\n\nLimiting factors — food, space, season, disease, habitat — restrict population growth exactly as real ecological theory predicts. The numbers below are running live from this island.`,
    formula:  'k',
    onEnter:  (_sim, setSpeed) => setSpeed(3),
  },
  {
    title:    'Natural Selection & Adaptation',
    sprite:   'neutral',
    concepts: ['Natural Selection', 'Adaptation', 'Directional Selection'],
    body: `There is no selector.\n\nWhat exists is: agents with low speed get caught. Agents with low constitution starve faster when crowded. Agents with low resilience die younger. These agents reproduce less. Over generations, the variation deltas of surviving individuals accumulate in the gene pool. The population shifts toward stronger stats. Natural selection. Without a single line of code that says prefer the fitter individual.[[threat]]\n\nThis reflects Darwin's core insight: individuals vary in heritable traits; certain traits improve survival and reproduction; successful traits become more common over generations; populations adapt to environmental conditions over time.\n\nAdaptation is the long-term result. During a cold snap, organisms with higher heat tolerance survive at higher rates. Over multiple generations, the average heat tolerance of the population rises. The environment selected for it. The population became better adapted. Over time, this leads to directional selection — gradual shifts in population traits as an emergent, non-random process driven by environmental pressure.\n\nClick below to trigger a disease outbreak. Watch which species takes the hit.`,
    onEnter:  (_sim, setSpeed) => setSpeed(3),
    trialBtn: {
      label:  'Trigger Disease Outbreak',
      action: (sim) => sim.triggerEvent('disease'),
    },
  },
  {
    title:    'Fitness, Genetic Drift & Bottleneck Effect',
    sprite:   'neutral',
    concepts: ['Fitness', 'Genetic Drift', 'Bottleneck Effect', 'Allele Frequency'],
    body: `Fitness is not physical strength. It is overall reproductive success. A hawk that catches more prey produces more offspring and passes its hunting traits forward. Over time, the average hunting ability of the population rises.\n\nBut natural selection is not the only mechanism of evolution.\n\nGenetic drift is the random change in allele frequencies in a population, especially in small populations where chance has a strong effect. After a disaster reduces deer numbers, certain traits may become common purely by chance rather than survival advantage.\n\nThe bottleneck effect occurs when a population is drastically reduced due to an event, leaving survivors with low genetic diversity. The Florida panther. The cheetah. The northern elephant seal. Documented populations that survived bottlenecks and paid the genetic cost for generations afterward — surviving populations carry only a fraction of original genetic diversity, increasing vulnerability to future changes.\n\nIn this simulation, wildfire cuts grass by 65% instantly. Deer populations crash. Survivors carry a narrower genetic profile. Evolution resumes from what remains.[[threat]]\n\nClick below. Watch what happens.`,
    onEnter:  (_sim, setSpeed) => setSpeed(3),
    trialBtn: {
      label:  'Fire a Wildfire Now',
      action: (sim) => sim.triggerEvent('wildfire'),
    },
  },
  {
    title:    'The Individual-Based Model',
    sprite:   'neutral',
    concepts: ['Individual-Based Model', 'Agent State Machine', 'Emergent Behavior'],
    body: `The IBM. Every animal is a separate software agent with its own state machine.\n\nWANDER: exploring its preferred biome.\nHUNT: locked onto a specific prey individual, pathfinding directly toward it. The agent must physically reach the prey's coordinates to eat it. No phantom consumption from across the map.\nFLEE: predator within awareness range. Everything else abandoned.\nCOURT: pathfinding toward an accepted mate during breeding season.\n\nThe reasoning stat drives two things: target selection — high-reasoning agents pick prey with the best energy-gain-to-distance ratio — and path quality — low-reasoning agents add up to 63 degrees of random noise per frame.\n\nHawks bypass standard movement entirely: they soar in a wide ellipse around their nest tree, diving at 2.2× speed when prey is locked. Frogs must be in water to mate. Beetles must physically travel to a different tree to lay eggs.\n\nPopulation dynamics emerge from thousands of these transitions running simultaneously.`,
  },
  {
    title:    'DNA, Base Pairing & Codons',
    sprite:   'friendly',
    concepts: ['DNA Base Pairing', 'Codons', 'Point Mutation', 'Gene Structure'],
    body: `Every species has a DNA sequence. Nine traits, each encoded by three codons. Each codon is three base pairs: A, T, G, or C.\n\nDNA base pairing is the rule that DNA bases match in pairs — A with T, and C with G — to ensure accurate genetic replication. When DNA copies itself, correct base pairing preserves genetic information unless a mutation occurs.\n\nCodons are groups of three DNA bases that code for amino acids, which form proteins that determine traits. A codon change in beetles can alter a protein affecting camouflage, making them harder for predators to detect.\n\nChange a single base and the codon changes. The codon maps to a biological modifier between negative 20 and positive 20. That modifier shifts the effective stat. Change ATG to GTG in the metabolism row and every individual of that species burns energy at a different rate.\n\nThis is a point mutation. The project demonstrates it by making the consequences visible in a running simulation.\n\nOpen the Gene Lab tab at the top of the game to see it.`,
  },
  {
    title:    'Gene Expression',
    sprite:   'neutral',
    concepts: ['Gene Expression', 'Genotype vs Phenotype', 'Trait Modification'],
    body: `The full pipeline:\n\nA/T/G/C bases form a codon. The codon maps to a modifier. The modifier adds to the species base stat. The result is clamped between 0 and 100. That number determines the observable phenotype.\n\nThis reflects real biological processes: DNA encodes traits through gene expression, mutations introduce variation within populations, and beneficial mutations increase in frequency through natural selection.\n\nThe Gene Lab phenotype panel describes what each number means in biological terms. Higher metabolism shows how many hunger units drain per second. Higher camouflage shows what percentage of predator detection is blocked. Higher speed means more distance covered per frame.\n\nGenotype to phenotype. One pipeline. Every species. Every frame.\n\nThis creates a visible link between molecular change and organism behaviour, showing how DNA directly influences ecological success — the relationship the simulation was built to demonstrate.`,
  },
  {
    title:    'Mutation & Allele Frequency',
    sprite:   'friendly',
    concepts: ['Mutation', 'Allele Frequency', 'Inheritance', 'Mendelian Segregation'],
    body: `Mutation is a random change in an organism's DNA that creates new genetic variation within a population. A mutation that increases frog speed may help it escape hawk predation more often, improving survival and long-term fitness.\n\nDesigning a mutation in the Gene Lab does nothing on its own. The player must inject it.\n\nInjecting selects specific individuals and alters their variation deltas. They are now genetically distinct from the rest of the population. Their offspring inherit the mutation with 50% probability each — Mendelian segregation applied to a continuous trait model.\n\nThe Genetics panel then tracks what percentage of the population carries the mutation over time — allele frequency. The chart shows whether it is spreading, declining, or neutral. If the mutation improves survival under current conditions, allele frequency rises. If conditions change, a previously neutral mutation may become advantageous or harmful.\n\nClick below to inject a speed mutation into five deer right now.`,
    trialBtn: {
      label:  'Inject Speed Mutation into Deer',
      action: (sim) => sim.injectMutation('deer', { speed: 15 }, 5),
    },
  },
  {
    title:    'Inbreeding Depression',
    sprite:   'threat',
    concepts: ['Inbreeding Depression', 'Genetic Diversity', 'Population Vulnerability'],
    body: `Every tick the simulation computes the mean variance of all nine stats across the population. Low variance means the gene pool is narrowing.\n\nWhen diversity drops below a threshold, a death rate multiplier activates. Zero diversity produces up to 60% higher mortality per tick. The Genetics panel shows this as a colour-coded bar per species.\n\nIn real ecosystems, this is well-documented. After a bottleneck, the surviving population carries only a fraction of the original genetic diversity. This increases vulnerability to disease and environmental change — because fewer trait variations exist to respond to new pressures.\n\nThe cheetah. The Florida panther. The northern elephant seal. All documented cases where low genetic variation significantly reduces long-term survival capacity. The simulation demonstrates this through its inbreeding depression mechanic.\n\nThe bars below are running live. If anything is red, something on this island is in serious trouble.`,
    formula: 'diversity',
  },
  {
    title:    'Sexual Selection & Mate Choice',
    sprite:   'neutral',
    concepts: ['Sexual Selection', 'Fitness Signalling', 'Mate Choice'],
    body: `During breeding season, females scan males within their awareness radius. Each male receives a desirability score: the average of his speed, strength, constitution, and resilience.\n\nThe female acceptance threshold is set by her reasoning stat. High reasoning means a threshold of 66. Low reasoning means a threshold of 28. She chooses the highest-scoring male who clears her threshold and pathfinds toward him.\n\nNo programmer specified which traits should be attractive. Female choice determined it. Over generations this drives evolutionary pressure on all four signal traits simultaneously.\n\nThis models real sexual selection — mate choice creates selection pressure independent of direct survival advantage. Populations can evolve traits not because they help survival but because they attract mates. The genetic consequences are indistinguishable from natural selection in the short term.\n\nPeacocks would understand.[[friendly]]`,
    onEnter:  (_sim, setSpeed) => setSpeed(1),
  },
  {
    title:    'Beetle Lifecycle & Habitat Dependency',
    sprite:   'friendly',
    concepts: ['Habitat Dependency', 'Resource Competition', 'Lifecycle & Reproduction'],
    body: `Beetles do not wander freely. Each beetle has a homeTreeId — a specific tree it lives on. When not hunting, it returns to that tree.\n\nWhen ready to reproduce, it acquires a breedTreeId: a different tree. It travels there, lays two to four eggs at that location, and the larvae hatch already bonded to that tree. The population hard cap is numTrees × 4. Destroy the forest and the beetle colony collapses regardless of anything else.\n\nThis models habitat dependency — beetles require trees for their entire lifecycle. Frogs require ponds to breed and desiccate rapidly away from water. Fireflies die quickly outside pond biomes. Each species has a specific habitat requirement that limits where and how much it can grow.\n\nResource competition is also at work: deer and boar share grass. Boar eat beetles. Every consumer competes for limited resources, enforcing the carrying capacity calculations that govern the whole system.\n\nMonitors eat beetles. Frogs eat beetles. Hawks eat frogs. Cut the trees and the cascade reaches the hawk. One habitat. Four trophic connections.`,
    onEnter:     (_sim, setSpeed) => setSpeed(1),
    highlightEl: '.island-canvas-wrap',
  },
  {
    title:    'Environmental Events & Ecosystem Disturbance',
    sprite:   'neutral',
    concepts: ['Bottleneck Effect', 'Ecological Resilience', 'Ecosystem Disturbance'],
    body: `Six environmental events fire at random intervals. Drought. Wildfire. Volcanic ash. Cold snap. Disease outbreak. New migration.\n\nEach is a real ecological concept with real mathematical consequences. Wildfire cuts grass by 65% instantly and initiates a bottleneck event. Survivors carry a narrower genetic profile. Evolution resumes from what remains.\n\nThe cascade from a wildfire: trees burn, beetles lose habitat. Deer populations that initially increase as predators lose forest cover later crash from starvation as plant resources deplete. Hawk populations follow. This chain reaction shows how interconnected ecosystems truly are.\n\nThese disturbances are based on real-world events becoming more frequent due to climate change. In real ecosystems, they reduce population sizes, alter habitats, and shift species distributions. In the simulation they force rapid ecological change — demonstrating how fragile ecosystems respond to sudden environmental stress.\n\nA pressure indicator rises in the Events panel between events. Players can watch it build and prepare mutations in advance.`,
    onEnter:  (_sim, setSpeed) => setSpeed(3),
    trialBtn: {
      label:  'Fire a Wildfire Now',
      action: (sim) => sim.triggerEvent('wildfire'),
    },
  },
  {
    title:    'The Decomposer Loop',
    sprite:   'neutral',
    concepts: ['Matter & Energy Flow', 'Nutrient Cycling', 'Ecosystem Stability'],
    body: `Dead matter accumulates from every animal death and plant senescence. Fungi consume it and return 45% as soil nutrients. Nutrients accelerate producer growth by up to 65%.\n\nFungi are not decorative. Remove them and grass grows slower, trees seed less often, herbivores face food scarcity, and the food web weakens from the bottom.\n\nThis is matter and energy flow through an ecosystem. Dead organisms are not wasted. Their stored chemical energy re-enters the system through decomposition, becoming available to autotrophs again. The carbon cycle, modelled.\n\nThe ecological system models food webs, energy transfer, and population regulation. Producers grow using logistic models limited by carrying capacity, while consumers transfer energy through predation. The decomposer loop closes the cycle — energy and matter circulate continuously through the system, never created or destroyed, only transformed.\n\nIt runs whether or not anyone is watching it.`,
    formula: 'nutrients',
  },
  {
    title:    'The Three-Topic Connection',
    sprite:   'friendly',
    concepts: ['Evolution-Ecology-DNA Connection', 'Systems Thinking', 'Emergent Behaviour'],
    body: `Here is the required connection between Evolution, Ecology, and DNA.\n\nA mutation changes a codon — a point mutation in the camouflage gene. That codon change alters gene expression and raises the effective camouflage stat. In the next predation event, camouflaged individuals are harder to detect. They survive more often. They reproduce more often. Their offspring inherit the mutation with 50% probability. Allele frequency rises. The beetle population stabilises. The food web holds.\n\nDNA drove Evolution drove Ecology. One codon change. Three topics. Connected through a single base pair substitution and its consequences in a living simulation.\n\nThe relationship is circular: genetics produces variation through mutation, ecology determines which traits are advantageous, and evolution filters those traits through survival and reproduction. These interactions create emergent behaviour — population cycles, ecosystem stability, and collapse events that were never explicitly programmed.\n\nClick below to trigger a cold snap. Watch the chain.[[friendly]]`,
    trialBtn: {
      label:  'Trigger Cold Snap',
      action: (sim) => sim.triggerEvent('cold_snap'),
    },
  },
  {
    title:    'Real-World Significance',
    sprite:   'friendly',
    concepts: ['Conservation Biology', 'Climate Change', 'Island Biogeography', 'Antibiotic Resistance'],
    body: `The systems in this simulation are motivated by real biological, ecological, and environmental processes observed in natural ecosystems.\n\nYellowstone National Park. When wolves were reintroduced in 1995, elk populations shifted, vegetation recovered in overgrazed areas, and river systems changed because elk avoided certain valleys. One predator-prey relationship restructured an entire ecosystem. This simulation models that same chain reaction every frame.\n\nAntibiotic resistance demonstrates natural selection in real time. Bacteria with resistance genes survive antibiotic treatment and dominate the population. The simulation shows the identical mechanism through cold snaps and heat tolerance — organisms with the right trait survive, reproduce, shift the allele frequency.\n\nEndangered species such as cheetahs and Florida panthers demonstrate the real cost of the bottleneck effect. Critically low genetic diversity increases disease vulnerability and reduces adaptive capacity. The inbreeding depression mechanic in this simulation models exactly that consequence.\n\nThe ability for organisms to migrate and colonise the island reflects real ecological processes such as species dispersal and island biogeography. In nature, ecosystems are constantly shaped by migration events, where new species arrive, compete, and either integrate or go extinct depending on environmental conditions.[[friendly]]`,
    onEnter: (_sim, setSpeed) => setSpeed(5),
  },
  {
    title:    'Rationale, Reflection & Works Cited',
    sprite:   'neutral',
    concepts: ['Design Rationale', 'Individual Reflection', 'Simulation Limitations'],
    body: `Why a game.\n\nA traditional explanation cannot show all of these concepts simultaneously. A poster shows one diagram. A game lets evolution, ecology, and genetics happen at the same time, and lets you examine each one while the others continue running.\n\nThe god perspective was deliberate — seeing the entire island makes complex interactions legible. Sequential species arrival was deliberate — complexity builds gradually so each relationship is visible before the next one arrives. The gene editor makes mutations interactive so you can watch consequences rather than wait for random chance.\n\nSimplifications were necessary and honest. Real DNA has billions of base pairs. This has nine traits, three codons each. Real ecosystems take centuries to show evolutionary change. This compresses it to minutes. Every simplification was a trade between accuracy and observability.\n\nWhat was learned: before building this, evolution was a concept that happened over millions of years to populations you could not observe. After writing the natural selection code, it became a mathematical consequence of survival probability and reproduction rate. The mechanism became visible. Natural selection was never coded. It appeared.\n\nBiology is not a set of isolated topics. It is an interconnected system where genetics determines variation, ecology determines environmental pressure, and evolution determines long-term change. By having these relationships run in real time, the Island of Life allows anyone to observe how small molecular changes can scale into large ecosystem-level effects.\n\nWorks Cited:\nnps.gov/yell/learn/nature/wolf.htm — Yellowstone wolf-elk dynamics\neducation.nationalgeographic.org/resource/food-web/ — Food web structure and energy flow[[friendly]]`,
    onEnter: (_sim, setSpeed) => setSpeed(3),
  },
]

export default function TeacherModePage() {
  const [actIdx,         setActIdx]         = useState(0)
  const [charCount,      setCharCount]      = useState(0)
  const [isTyping,       setIsTyping]       = useState(true)
  const [mouthOpen,      setMouthOpen]      = useState(false)
  const [spriteOverride, setSpriteOverride] = useState(null)
  const [speed,          setSpeed]          = useState(1)
  const [worldLoaded,    setWorldLoaded]    = useState(false)
  const [trialFired,     setTrialFired]     = useState(false)
  const [winPos,  setWinPos]  = useState({ x: 60, y: 0 })
  const [winSize, setWinSize] = useState({ w: 900, h: 360 })

  const typingRef = useRef(null)
  const mouthRef  = useRef(null)

  useEffect(() => {
    const h = window.innerHeight
    setWinPos({ x: 60, y: Math.max(48, h - 390) })
  }, [])

  const act = ACTS[actIdx]
  const { clean: fullText, changes: spriteChanges } = parseBody(act.body)
  const isDone = charCount >= fullText.length

  useEffect(() => {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
    setSpriteOverride(null)
    setTrialFired(false)
  }, [actIdx])

  const simRef = useRef(null)
  useEffect(() => {
    if (simRef.current && act.onEnter) act.onEnter(simRef.current, setSpeed)
  }, [actIdx])

  useEffect(() => {
    if (!isTyping) return
    typingRef.current = setInterval(() => {
      setCharCount(prev => {
        const next = prev + 1
        for (const ch of spriteChanges) {
          if (prev < ch.atChar && next >= ch.atChar) setSpriteOverride(ch.sprite)
        }
        if (next >= fullText.length) { setIsTyping(false); clearInterval(typingRef.current) }
        return next
      })
    }, CHAR_DELAY)
    return () => clearInterval(typingRef.current)
  }, [isTyping, fullText, spriteChanges])

  useEffect(() => {
    if (!isTyping) { setMouthOpen(false); return }
    mouthRef.current = setInterval(() => setMouthOpen(o => !o), MOUTH_DELAY)
    return () => clearInterval(mouthRef.current)
  }, [isTyping])

  function skipTyping() {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(fullText.length)
    setIsTyping(false)
    setMouthOpen(false)
    if (spriteChanges.length > 0) setSpriteOverride(spriteChanges[spriteChanges.length - 1].sprite)
  }

  function goNext() {
    if (!isDone) { skipTyping(); return }
    if (actIdx < ACTS.length - 1) setActIdx(actIdx + 1)
  }
  function goPrev() { if (actIdx > 0) setActIdx(actIdx - 1) }

  const stepSprite    = spriteOverride ?? act.sprite ?? 'neutral'
  const talkingSprite = mouthOpen ? 'neutral' : 'friendly'
  const narratorKey   = isTyping && stepSprite !== 'threat' ? talkingSprite : stepSprite
  const narratorSrc   = NARRATOR_IMGS[narratorKey]
  const displayed     = fullText.slice(0, charCount)
  const lines         = displayed.split('\n')

  const biomeScoresRef = useRef({})
  const posMapRef      = useRef(new Map())
  const popsRef        = useRef({})
  const biomeAtRef     = useRef(null)
  const simTickRef     = useRef(0)

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
  simRef.current = sim

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

  function fireTrial() {
    if (act.trialBtn) {
      act.trialBtn.action(sim, setSpeed)
      setTrialFired(true)
    }
  }

  const isFirst = actIdx === 0
  const isLast  = actIdx === ACTS.length - 1

  return (
    <div className="tm">

      <div className="tm__bg">
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
        />
        {!worldLoaded && <div className="tm__loading">Initialising ecosystem…</div>}

        <div className="tm__topbar">
          <span className="tm__toplabel">Island of Life — Biology Final Project Showcase</span>
          <div className="tm__topcontrols">
            <button className={`tm__spd${speed===0?' tm__spd--on':''}`} onClick={()=>setSpeed(0)}>Pause</button>
            <button className={`tm__spd${speed===1?' tm__spd--on':''}`} onClick={()=>setSpeed(1)}>1x</button>
            <button className={`tm__spd${speed===3?' tm__spd--on':''}`} onClick={()=>setSpeed(3)}>3x</button>
            <button className={`tm__spd${speed===5?' tm__spd--on':''}`} onClick={()=>setSpeed(5)}>5x</button>
            <span className="tm__yr">Yr {sim.year}</span>
          </div>
        </div>
      </div>

      {act.highlightEl && isDone && (
        <SpotlightOverlay selector={act.highlightEl} zIndex={48} />
      )}

      <FloatingWindow
        title={`Showcase — ${actIdx + 1} / ${ACTS.length} — ${act.title}`}
        pos={winPos} size={winSize} zIndex={200}
        onClose={() => {}}
        onFocus={() => {}}
        onMove={setWinPos}
        onResize={setWinSize}
        minW={600} minH={280}
      >
        <div className="tut-win">

          <div className="tut-win__meta">
            <span className="tut-win__counter">Step {actIdx + 1} / {ACTS.length}</span>
            <div className="tut-win__bar">
              {ACTS.map((a, i) => (
                <div key={i}
                  className={`tut-win__pip${i <= actIdx ? ' tut-win__pip--done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActIdx(i)}
                  title={a.title}
                />
              ))}
            </div>
          </div>

          <div className="tut-win__divider" />

          <div className="tut-win__content-row">
            <div className={`tut-win__stage tut-win__stage--${stepSprite}`}>
              {Object.entries(NARRATOR_IMGS).map(([key, src]) => (
                <img key={key} className="tut-win__narrator" src={src} alt=""
                  style={{ opacity: narratorSrc === src ? 1 : 0 }} />
              ))}
            </div>

            <div className="tut-win__dialogue"
              onClick={!isDone ? skipTyping : undefined}
              style={{ cursor: !isDone ? 'pointer' : 'default' }}>
              <div className="tut-win__step-title">{act.title}</div>
              <div className="tut-win__text">
                {lines.map((line, i) =>
                  line === ''
                    ? <br key={i} />
                    : <span key={i}>
                        {line}
                        {i === lines.length - 1 && !isDone
                          ? <span className="tut-cursor">▮</span>
                          : <br />}
                      </span>
                )}

                {isDone && act.formula === 'k'         && <KFormula pops={sim.pops} tick={sim.tick} />}
                {isDone && act.formula === 'diversity' && <DiversityFormula diversity={sim.diversity ?? {}} arrivedSpecies={sim.arrivedSpecies} />}
                {isDone && act.formula === 'nutrients' && <NutrientFormula deadMatter={sim.deadMatter ?? 0} pops={sim.pops} />}

                {isDone && <ConceptList concepts={act.concepts} />}
              </div>
            </div>
          </div>

          <div className="tut-win__nav">
            <div className="tut-win__nav-left">
              {!isFirst && (
                <button className="pixel-btn tut-btn" onClick={goPrev}>Back</button>
              )}
              {act.trialBtn && isDone && (
                <button
                  className={`pixel-btn tut-btn tm-trial-btn${trialFired ? ' tm-trial-btn--done' : ''}`}
                  onClick={fireTrial}
                  disabled={trialFired}
                >
                  {trialFired ? 'Done' : act.trialBtn.label}
                </button>
              )}
            </div>
            <div className="tut-win__nav-right">
              {!isDone
                ? <button className="pixel-btn tut-btn" onClick={skipTyping}>Skip</button>
                : isLast
                  ? <span className="tut-win__counter" style={{color:'var(--color-accent2)'}}>Showcase complete.</span>
                  : <button className="pixel-btn tut-btn" onClick={goNext}>Next</button>
              }
            </div>
          </div>

        </div>
      </FloatingWindow>
    </div>
  )
}
