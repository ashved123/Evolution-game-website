import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import FloatingWindow  from '../components/FloatingWindow.jsx'
import SpotlightOverlay from '../components/SpotlightOverlay.jsx'
import IslandCanvas    from '../components/IslandCanvas.jsx'
import { SPECIES }     from '../data/species.js'
import { useSimulation } from '../simulation/useSimulation.js'
import { K }           from '../simulation/engine.js'
import { CARRYING_CAPACITY, SEASON_K_FACTOR } from '../simulation/agentConfig.js'
import { getSeason }   from '../simulation/individuals.js'
import narratorFriendly from '../assets/sprites/narrator/pose_friendly.png'
import narratorNeutral  from '../assets/sprites/narrator/pose_neutral.png'
import narratorThreat   from '../assets/sprites/narrator/pose_threat.png'
import '../components/TutorialWindow.css'
import './TeacherModePage.css'

const NARRATOR_IMGS = { friendly: narratorFriendly, neutral: narratorNeutral, threat: narratorThreat }
const CHAR_DELAY  = 26
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
      <div className="tm-formula__row">effectiveK = baseK x (food / optimal) x season</div>
      <div className="tm-formula__row tm-formula__row--calc">
        = 60 x ({adjusted.toFixed(0)} / {optimal}) x {seasonMult.toFixed(2)}
      </div>
      <div className="tm-formula__row tm-formula__row--result">
        = <span className="tm-formula__val">{effectiveK}</span>
        <span className="tm-formula__season"> {season.name}</span>
      </div>
      <div className="tm-formula__note">Grass: {grassCount} | Boar eating {(boarCount * 0.4).toFixed(0)} of it | Adjusted: {adjusted.toFixed(0)}</div>
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
      <div className="tm-formula__title">LIVE: Genetic Diversity Index (0 = inbred, 100 = diverse)</div>
      {entries.map(([spId, idx]) => {
        const sp   = SPECIES.find(s => s.id === spId)
        const col  = idx >= 60 ? '#4caf50' : idx >= 30 ? '#c08820' : '#c04020'
        const warn = idx < 30 ? ' INBREEDING RISK' : ''
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
      <div className="tm-formula__row">Fungi: <b>{fungi}</b> individuals x 0.15 = <b>{consumed}</b> consumed/tick</div>
      <div className="tm-formula__row tm-formula__row--result">
        Nutrients returned: {consumed} x 0.45 = <span className="tm-formula__val">{returned}</span> /tick
      </div>
      <div className="tm-formula__note">Nutrients boost grass and tree growth by up to 65%</div>
    </div>
  )
}

// ── Question component ────────────────────────────────────────────────

function QuestionBlock({ question, answeredIdx, onAnswer }) {
  return (
    <div className="tm-question">
      <div className="tm-question__q">{question.q}</div>
      <div className="tm-question__options">
        {question.options.map((opt, i) => {
          const isChosen  = answeredIdx === i
          const isCorrect = i === question.answer
          let cls = 'tm-question__opt'
          if (answeredIdx !== null) {
            if (isCorrect) cls += ' tm-question__opt--correct'
            else if (isChosen) cls += ' tm-question__opt--wrong'
            else cls += ' tm-question__opt--dim'
          }
          return (
            <button key={i} className={cls}
              onClick={() => answeredIdx === null && onAnswer(i)}
              disabled={answeredIdx !== null}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </button>
          )
        })}
      </div>
      {answeredIdx !== null && (
        <div className={`tm-question__response ${answeredIdx === question.answer ? 'tm-question__response--correct' : 'tm-question__response--wrong'}`}>
          {question.responses[answeredIdx]}
        </div>
      )}
    </div>
  )
}

// ── Walkthrough script ────────────────────────────────────────────────

const ACTS = [
  {
    title:  'What You Are Looking At',
    sprite: 'neutral',
    body:   'This is Island of Life. A real-time ecosystem simulation.\n\nEvery organism you see is a software agent making independent decisions every animation frame. The hawk circling up there is running a targeting algorithm. The beetles are returning to their home trees. The deer are deciding whether to graze or run.\n\nNone of it is animated. None of it is scripted. It is running right now.\n\nI suggest you watch for a moment before we continue.[[friendly]]',
    onEnter: (_sim, setSpeed) => setSpeed(1),
    highlightEl: '.island-canvas-wrap',
  },
  {
    title:  'What This Project Covers',
    sprite: 'neutral',
    body:   'This project demonstrates mastery of three biology topics: Evolution, Ecology, and DNA.\n\nNot as a poster. Not as a diagram. As a functioning simulation where every concept is mechanically enforced by mathematics running at sixty frames per second.\n\nTwenty-two specific biology concepts. All of them are in there. We will go through them.\n\nI will try to keep it interesting. You have been grading projects all day. I understand.',
  },
  {
    title:  'The Food Web',
    sprite: 'friendly',
    body:   'The island supports nine species across five trophic levels.\n\nFungi at the base as decomposers. Grass and trees as producers. Beetles, deer, and boar as primary consumers. Frogs and monitor lizards as secondary consumers. The hawk at the top as the apex predator.\n\nThe Ecosystem panel has an interactive SVG food web diagram. Arrows show energy flow direction. When a species goes extinct, its arrows go dashed and the cascade propagates upward.\n\nThe code does not model a food web. It models individual hunger. The food web emerges.',
  },
  {
    title:  'The Individual-Based Model',
    sprite: 'neutral',
    body:   'The IBM. Every animal is a separate software agent with its own state machine.\n\nWANDER: exploring its preferred biome.\nHUNT: locked onto a specific prey individual, pathfinding directly toward it.\nFLEE: predator within awareness range, everything else abandoned.\nCOURT: pathfinding toward an accepted mate during breeding season.\n\nThe agent transitions between states based on distance, hunger, season, and reasoning ability. Population dynamics emerge from thousands of these transitions running simultaneously.',
    question: {
      q: 'A deer is grazing peacefully. A hawk enters its awareness radius. What happens?',
      options: [
        'The deer keeps grazing. The hawk needs to get closer first.',
        'The deer sets the hawk as a food target.',
        'The deer abandons everything and switches to FLEE.',
        'The deer alerts nearby herd members.',
      ],
      answer: 2,
      responses: [
        'Incorrect. Awareness radius is exactly where FLEE triggers. The deer does not wait to see what happens.',
        'Hawks eat deer. Not the other way around. Re-read the food web.',
        'Correct. FLEE overrides all other states. Food targets, mate targets, herd bonds. All of it abandoned. Survival is not negotiable.',
        'Deer do not have a communication system in this simulation. They run. That is it.',
      ],
    },
  },
  {
    title:  'Carrying Capacity',
    sprite: 'neutral',
    body:   'K is not a fixed ceiling. Every frame: effectiveK = baseK multiplied by food ratio multiplied by season multiplier.\n\nIf grass falls below optimal for deer, deer K shrinks proportionally. In winter, all K values halve. In spring they rise 15%. Deer and boar compete for the same grass. Each boar mathematically removes 0.4 units from deer-accessible food.\n\nWhen population exceeds 80% of effective K, a crowding multiplier increases hunger drain. Logistic growth. Not labelled. Enforced.\n\nThe numbers below are running live from this island right now.',
    formula: 'k',
    onEnter: (_sim, setSpeed) => setSpeed(3),
  },
  {
    title:  'Natural Selection',
    sprite: 'neutral',
    body:   'There is no selector.\n\nWhat exists is: agents with low speed get caught. Agents with low constitution starve faster when crowded. Agents with low resilience die younger. These agents reproduce less.\n\nOver generations, the variation deltas of surviving individuals accumulate in the gene pool. The population shifts toward stronger stats. Natural selection. Without a single line of code that says prefer the fitter individual.[[threat]]\n\nDarwin described this in 1859. It took 165 more years to run it in a browser.\n\nClick the button below to watch it happen now.',
    trialBtn: {
      label:  'Trigger Disease Outbreak',
      action: (sim) => sim.triggerEvent('disease'),
    },
  },
  {
    title:  'DNA and the Gene Lab',
    sprite: 'friendly',
    body:   'Every species has a DNA sequence. Nine traits, each encoded by three codons. Each codon is three base pairs: A, T, G, or C.\n\nChange a single base and the codon changes. The codon maps to a biological modifier between negative 20 and positive 20. That modifier shifts the effective stat. Change ATG to GTG in the metabolism row and every individual of that species burns energy at a different rate.\n\nThis is a point mutation. The project demonstrates it by making the consequences visible in a running simulation.\n\nOpen the Gene Lab tab at the top of the game to see it.',
  },
  {
    title:  'Gene Expression',
    sprite: 'neutral',
    body:   'The full pipeline:\n\nA/T/G/C bases form a codon. The codon maps to a modifier. The modifier adds to the species base stat. The result is clamped between 0 and 100. That number determines the observable phenotype.\n\nThe Gene Lab phenotype panel describes what each number means in biological terms. Higher metabolism shows how many hunger units drain per second. Higher camouflage shows what percentage of predator detection is blocked.\n\nGenotype to phenotype. In code.',
  },
  {
    title:  'Mutation Injection',
    sprite: 'friendly',
    body:   'Designing a mutation in the Gene Lab does nothing on its own. The player must inject it.\n\nSelecting individuals injects the new variation deltas into those specific agents. They are now genetically distinct from the rest of the population. Their offspring inherit the mutation with 50% probability each. Mendelian segregation applied to a continuous trait model.\n\nThe Genetics panel then tracks what percentage of the population carries the mutation over time. The chart shows whether it is spreading, declining, or neutral.\n\nClick below to inject a speed mutation into five deer right now.',
    trialBtn: {
      label:  'Inject Speed Mutation into Deer',
      action: (sim) => sim.injectMutation('deer', { speed: 15 }, 5),
    },
  },
  {
    title:  'Inbreeding Depression',
    sprite: 'threat',
    body:   'Every tick the simulation computes the mean variance of all nine stats across the population. Low variance means the gene pool is narrowing.\n\nWhen diversity drops below a threshold, a death rate multiplier activates. Zero diversity produces up to 60% higher mortality per tick. The Genetics panel shows this as a colour-coded bar per species.\n\nThe Florida panther. The cheetah. The northern elephant seal. Documented cases of populations surviving a bottleneck and paying the genetic cost for generations afterward.\n\nThe bars below are running live. If anything is red, something on this island is in trouble.',
    formula: 'diversity',
  },
  {
    title:  'Sexual Selection',
    sprite: 'neutral',
    body:   'During breeding season, females scan males within their awareness radius. Each male receives a desirability score: the average of his speed, strength, constitution, and resilience.\n\nThe female acceptance threshold is set by her reasoning stat. High reasoning means a threshold of 66. Low reasoning means a threshold of 28. She chooses the highest-scoring male who clears her bar and pathfinds toward him.\n\nNo programmer specified which traits should be attractive. Female choice determined it. Over generations this drives evolutionary pressure on all four signal traits.\n\nPeacocks would understand.[[friendly]]',
    onEnter: (_sim, setSpeed) => setSpeed(1),
    question: {
      q: 'What determines how selective a female is when evaluating mates?',
      options: [
        'Her fertility stat',
        'Her reasoning stat',
        'The current season',
        'How hungry she is',
      ],
      answer: 1,
      responses: [
        'Incorrect. Fertility controls how fast she reproduces, not who she chooses.',
        'Correct. High reasoning means a higher acceptance threshold. The mathematics of choosiness. Smarter females are pickier.',
        'Breeding season determines when she looks. Reasoning determines what she accepts. Not the same thing.',
        'Hunger below 40 cancels courting entirely. But it does not affect the threshold. Try again.',
      ],
    },
  },
  {
    title:  'Beetle Lifecycle',
    sprite: 'friendly',
    body:   'Beetles do not wander freely. Each beetle has a homeTreeId: a specific tree it lives on. When not hunting, it returns to that tree.\n\nWhen ready to reproduce, it acquires a breedTreeId: a different tree. It travels there, lays two to four eggs at that location, and the larvae hatch already bonded to that tree.\n\nThe population hard cap is numTrees multiplied by 4. Destroy the forest and the beetle colony collapses regardless of anything else.\n\nMonitors eat beetles. Frogs eat beetles. Hawks eat frogs. Cut the trees and the cascade reaches the hawk. One species. Four trophic connections.',
    onEnter: (_sim, setSpeed) => setSpeed(1),
    highlightEl: '.island-canvas-wrap',
  },
  {
    title:  'Environmental Events',
    sprite: 'neutral',
    body:   'Six environmental events fire at random intervals. Drought. Wildfire. Volcanic ash. Cold snap. Disease outbreak. New migration.\n\nEach is a real ecological concept with real mathematical consequences. Wildfire cuts grass by 65% instantly and initiates a population crash: a bottleneck event. Survivors carry a narrower genetic profile. Evolution resumes from what remains.\n\nA pressure indicator rises in the Events panel between events. The player can watch it build and prepare mutations before the next event fires.\n\nClick the button below. Watch what happens to the grass population.',
    onEnter: (_sim, setSpeed) => setSpeed(3),
    trialBtn: {
      label:  'Fire a Wildfire Now',
      action: (sim) => sim.triggerEvent('wildfire'),
    },
  },
  {
    title:  'Decomposer Loop',
    sprite: 'neutral',
    body:   'Dead matter accumulates from every animal death and plant senescence. Fungi consume it and return 45% as soil nutrients. Nutrients accelerate producer growth by up to 65%.\n\nFungi are not decorative. Remove them and grass grows slower, trees seed less often, herbivores face food scarcity, and the food web weakens from the bottom.\n\nThis is matter and energy flow through an ecosystem. The carbon cycle, modelled. It runs whether or not anyone is watching it.',
    formula: 'nutrients',
  },
  {
    title:  'The Three-Topic Connection',
    sprite: 'friendly',
    body:   'Here is the required connection between Evolution, Ecology, and DNA.\n\nA beetle gets a heat tolerance mutation: a codon change. That mutation changes gene expression and raises the effective stat. In a cold snap, it survives while low-tolerance individuals die. Its offspring inherit the mutation. Allele frequency rises. The beetle population holds. The food web holds.\n\nDNA drove Evolution drove Ecology. One event. Three topics. Connected through a single codon change and its consequences in a living simulation.\n\nClick below to fire the cold snap. The chain of consequences plays out live.',
    trialBtn: {
      label:  'Trigger Cold Snap',
      action: (sim) => sim.triggerEvent('cold_snap'),
    },
    question: {
      q: 'Which sequence correctly describes how DNA connects to Ecology in this simulation?',
      options: [
        'Codon change causes immediate population growth',
        'Codon changes gene expression, changes survival odds, changes allele frequency, changes ecosystem balance',
        'Mutation makes the species look different, attracting mates',
        'DNA change updates the Gene Lab score',
      ],
      answer: 1,
      responses: [
        'Incorrect. Mutations spread through reproduction over many generations. There is no immediate boost.',
        'Correct. That is the chain. DNA to gene expression to evolution to ecology. Every step is mechanically running.',
        'Phenotype in this simulation is statistical, not visual. No animal can see another animal\'s heat tolerance stat.',
        'There is no score. This is not a game show. Biology does not grade on a curve.',
      ],
    },
  },
  {
    title:  'What This Demonstrates',
    sprite: 'neutral',
    body:   'Twenty-two biology concepts. Not on a poster. Not in a video.\n\nMechanically implemented in approximately three thousand lines of code, written from scratch, without a game engine, without a biology framework, without a physics library.\n\nNatural selection was not labelled. It emerged from hunger mathematics. Carrying capacity was not diagrammed. It is enforced by an equation running every frame. Sexual selection was not explained. Females are running a desirability algorithm right now, above your head.[[threat]]\n\nTo build this correctly required understanding each concept well enough to translate it into mathematics. That is what this project demonstrates.',
    onEnter: (_sim, setSpeed) => setSpeed(5),
  },
]

export default function TeacherModePage() {
  const [actIdx,      setActIdx]      = useState(0)
  const [charCount,   setCharCount]   = useState(0)
  const [isTyping,    setIsTyping]    = useState(true)
  const [mouthOpen,   setMouthOpen]   = useState(false)
  const [spriteOverride, setSpriteOverride] = useState(null)
  const [speed,       setSpeed]       = useState(1)
  const [worldLoaded, setWorldLoaded] = useState(false)
  const [answeredIdx, setAnsweredIdx] = useState(null)
  const [trialFired,  setTrialFired]  = useState(false)
  const [winPos,  setWinPos]  = useState({ x: 60, y: 0 })
  const [winSize, setWinSize] = useState({ w: 860, h: 340 })

  const typingRef = useRef(null)
  const mouthRef  = useRef(null)

  useEffect(() => {
    const h = window.innerHeight
    setWinPos({ x: 60, y: Math.max(48, h - 370) })
  }, [])

  const act = ACTS[actIdx]
  const { clean: fullText, changes: spriteChanges } = parseBody(act.body)
  const isDone = charCount >= fullText.length

  // Reset on act change + run onEnter
  useEffect(() => {
    clearInterval(typingRef.current)
    clearInterval(mouthRef.current)
    setCharCount(0)
    setIsTyping(true)
    setMouthOpen(false)
    setSpriteOverride(null)
    setAnsweredIdx(null)
    setTrialFired(false)
  }, [actIdx])

  // Run onEnter after sim is ready
  const simRef = useRef(null)
  useEffect(() => {
    if (simRef.current && act.onEnter) act.onEnter(simRef.current, setSpeed)
  }, [actIdx])

  // Typewriter
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

  // Mouth
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

  // Simulation
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

      {/* Full-screen simulation */}
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

        {/* Top bar */}
        <div className="tm__topbar">
          <span className="tm__toplabel">📖 Teacher Walkthrough — Island of Life</span>
          <div className="tm__topcontrols">
            <button className={`tm__spd${speed===0?' tm__spd--on':''}`} onClick={()=>setSpeed(0)}>⏸</button>
            <button className={`tm__spd${speed===1?' tm__spd--on':''}`} onClick={()=>setSpeed(1)}>👁</button>
            <button className={`tm__spd${speed===3?' tm__spd--on':''}`} onClick={()=>setSpeed(3)}>▶▶</button>
            <span className="tm__yr">Yr {sim.year}</span>
          </div>
        </div>
      </div>

      {/* Spotlight overlay — behind the window (z 150), above canvas (z 30) */}
      {act.highlightEl && isDone && (
        <SpotlightOverlay selector={act.highlightEl} zIndex={48} />
      )}

      {/* Walkthrough window */}
      <FloatingWindow
        title="📖 Teacher Walkthrough"
        pos={winPos} size={winSize} zIndex={200}
        onClose={() => {}}
        onFocus={() => {}}
        onMove={setWinPos}
        onResize={setWinSize}
        minW={560} minH={260}
      >
        <div className="tut-win">

          {/* Progress pips */}
          <div className="tut-win__meta">
            <span className="tut-win__counter">Step {actIdx + 1} / {ACTS.length}</span>
            <div className="tut-win__bar">
              {ACTS.map((_, i) => (
                <div key={i}
                  className={`tut-win__pip${i <= actIdx ? ' tut-win__pip--done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActIdx(i)}
                  title={ACTS[i].title}
                />
              ))}
            </div>
          </div>

          <div className="tut-win__divider" />

          {/* Narrator + dialogue */}
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

                {/* Live formula */}
                {isDone && act.formula === 'k' && (
                  <KFormula pops={sim.pops} tick={sim.tick} />
                )}
                {isDone && act.formula === 'diversity' && (
                  <DiversityFormula diversity={sim.diversity ?? {}} arrivedSpecies={sim.arrivedSpecies} />
                )}
                {isDone && act.formula === 'nutrients' && (
                  <NutrientFormula deadMatter={sim.deadMatter ?? 0} pops={sim.pops} />
                )}

                {/* Question */}
                {isDone && act.question && (
                  <QuestionBlock
                    question={act.question}
                    answeredIdx={answeredIdx}
                    onAnswer={setAnsweredIdx}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="tut-win__nav">
            <div className="tut-win__nav-left">
              {!isFirst && (
                <button className="pixel-btn tut-btn" onClick={goPrev}>← Back</button>
              )}
              {act.trialBtn && isDone && (
                <button
                  className={`pixel-btn tut-btn tm-trial-btn${trialFired ? ' tm-trial-btn--done' : ''}`}
                  onClick={fireTrial}
                  disabled={trialFired}
                >
                  {trialFired ? '✓ Done' : `⚡ ${act.trialBtn.label}`}
                </button>
              )}
            </div>
            <div className="tut-win__nav-right">
              {!isDone
                ? <button className="pixel-btn tut-btn" onClick={skipTyping}>Skip ▶▶</button>
                : isLast
                  ? <span className="tut-win__counter" style={{color:'var(--color-accent2)'}}>Walkthrough complete.</span>
                  : <button className="pixel-btn tut-btn" onClick={goNext}>Next →</button>
              }
            </div>
          </div>

        </div>
      </FloatingWindow>
    </div>
  )
}
