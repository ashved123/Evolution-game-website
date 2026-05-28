import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import IslandCanvas from './components/IslandCanvas.jsx'
import EcosystemPanel from './components/EcosystemPanel.jsx'
import SpeciesList from './components/SpeciesList.jsx'
import GeneEditor from './components/GeneEditor.jsx'
import GeneticsPanel from './components/GeneticsPanel.jsx'
import EventsPanel from './components/EventsPanel.jsx'
import FloatingWindow from './components/FloatingWindow.jsx'
import TutorialWindow from './components/TutorialWindow.jsx'
import SpotlightOverlay from './components/SpotlightOverlay.jsx'
import OverseerPopup from './components/OverseerPopup.jsx'
import { TUTORIAL_STEPS } from './data/tutorialSteps.js'
import { SPECIES } from './data/species.js'
import { useSimulation } from './simulation/useSimulation.js'
import { getSeason, BREEDING_TICKS } from './simulation/individuals.js'
import './styles/App.css'

const SPEED_LABELS = ['⏸', '👁 Watch', '1×', '4×', '⏭ Skip']
const SPECIES_EMOJI = { beetle: '🪲', deer: '🦌', frog: '🐸', hawk: '🦅' }

// Anchor resolver: returns { x, y } pixel position for the tutorial window given viewport + window size
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
function resolveTutAnchor(anchor, W, H, w, h) {
  switch (anchor) {
    case 'center':      return { x: clamp(Math.round(W / 2 - w / 2), 20, W - w - 20), y: clamp(Math.round(H * 0.22), 60, H - h - 20) }
    case 'bottom-left': return { x: 20, y: clamp(H - h - 30, 60, H - h - 20) }
    case 'near-gene':   return { x: clamp(W - w - 20, 20, W - w - 20), y: 60 }
    case 'near-time':   return { x: 20,                             y: clamp(H - h - 30, 60, H - h - 20) }
    case 'near-events': return { x: clamp(W - w - 20, 20, W - w - 20), y: clamp(H - h - 30, 60, H - h - 20) }
    default:            return { x: clamp(Math.round(W / 2 - w / 2), 20, W - w - 20), y: 60 }
  }
}

function breedingNow(tick) {
  const t = ((tick % 12) + 12) % 12
  return Object.entries(BREEDING_TICKS)
    .filter(([, ticks]) => ticks?.includes(t))
    .map(([id]) => SPECIES_EMOJI[id] ?? id)
}

const DEFAULT_WINS = {
  clock:     { open: false, pos: { x: 20,  y: 60  }, size: { w: 280, h: 148 } },
  events:    { open: false, pos: { x: 320, y: 60  }, size: { w: 360, h: 460 } },
  ecosystem: { open: false, pos: { x: 380, y: 80  }, size: { w: 380, h: 440 } },
  species:   { open: false, pos: { x: 80,  y: 110 }, size: { w: 360, h: 480 } },
  gene:      { open: false, pos: { x: 60,  y: 70  }, size: { w: 780, h: 500 } },
}

export default function App() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const island     = state?.island ?? null
  const isNew      = state?.isNew  ?? false

  const [wins,    setWins]    = useState(DEFAULT_WINS)
  const [winOrder, setWinOrder] = useState(['ecosystem', 'events', 'species', 'gene', 'clock', 'tutorial'])

  // Tutorial state — auto-opens on new island creation; persisted otherwise
  const [tutOpen,  setTutOpen]  = useState(() => isNew || localStorage.getItem('tutDone') !== '1')
  const [tutStep,  setTutStep]  = useState(() => {
    if (isNew) { localStorage.removeItem('tutDone'); localStorage.setItem('tutStep', '0'); return 0 }
    return Number(localStorage.getItem('tutStep') ?? 0)
  })
  const [tutPos,      setTutPos]      = useState({ x: Math.max(20, Math.round(window.innerWidth  / 2) - 280), y: 60 })
  const [tutSize,     setTutSize]     = useState({ w: 740, h: 305 })
  const [tutDnaEdited, setTutDnaEdited] = useState(false)

  const [selectedSpecies,     setSelectedSpecies]     = useState(null)
  const [speed,               setSpeed]               = useState(2)
  const [highlightMutationId, setHighlightMutationId] = useState(null)

  // DNA overrides: { [speciesId]: { [statKey]: [c1, c2, c3] } }
  const [dnaOverrides, setDnaOverrides] = useState(() =>
    Object.fromEntries(SPECIES.map(s => [
      s.id,
      Object.fromEntries(Object.entries(s.dna).map(([k, v]) => [k, [...v]])),
    ]))
  )

  const biomeScoresRef     = useRef({})
  const posMapRef          = useRef(new Map())
  const popsRef            = useRef({})
  const biomeAtRef         = useRef(null)
  const spawnMoreTreesRef  = useRef(null)
  const focusViewportRef   = useRef(null)

  const dnaBySpecies = useMemo(() =>
    Object.fromEntries(SPECIES.map(s => [
      s.id,
      { baseStats: s.stats, dna: dnaOverrides[s.id] },
    ])),
    [dnaOverrides]
  )

  const sim = useSimulation(tutOpen ? 0 : speed, dnaBySpecies, biomeScoresRef, posMapRef, popsRef, biomeAtRef)

  const simTickRef = useRef(0)
  simTickRef.current = sim.tick

  // ── Window management ────────────────────────────────────────────────

  const focusWin  = (id) => setWinOrder(prev => [...prev.filter(w => w !== id), id])
  const closeWin  = (id) => setWins(prev => ({ ...prev, [id]: { ...prev[id], open: false } }))
  const moveWin   = (id, pos)  => setWins(prev => ({ ...prev, [id]: { ...prev[id], pos  } }))
  const resizeWin = (id, size) => setWins(prev => ({ ...prev, [id]: { ...prev[id], size } }))
  const winZ      = (id) => (winOrder.indexOf(id) + 1) * 10 + 20

  function toggleWin(id) {
    setWins(prev => ({ ...prev, [id]: { ...prev[id], open: !prev[id].open } }))
    focusWin(id)
  }

  function openGeneEditor(sp) {
    setSelectedSpecies(sp)
    setWins(prev => ({ ...prev, gene: { ...prev.gene, open: true } }))
    focusWin('gene')
  }

  function closeGeneEditor() {
    setSelectedSpecies(null)
    closeWin('gene')
  }

  function handleDnaChange(speciesId, newDna) {
    setDnaOverrides(prev => ({ ...prev, [speciesId]: newDna }))
    setTutDnaEdited(true)
  }

  // Tutorial helpers
  function tutNext() {
    const next = tutStep + 1
    setTutStep(next)
    localStorage.setItem('tutStep', next)
  }
  function tutBack() {
    const prev = Math.max(0, tutStep - 1)
    setTutStep(prev)
    localStorage.setItem('tutStep', prev)
  }
  function tutDone() {
    setTutOpen(false)
    localStorage.setItem('tutDone', '1')
  }
  function tutReopen() {
    setTutStep(0)
    setTutOpen(true)
    setTutDnaEdited(false)
    localStorage.removeItem('tutDone')
    localStorage.setItem('tutStep', '0')
    focusWin('tutorial')
  }

  // Move + resize tutorial window when step changes
  const tutSizeRef = useRef({ w: 740, h: 305 })
  tutSizeRef.current = tutSize
  useEffect(() => {
    if (!tutOpen) return
    const step = TUTORIAL_STEPS[tutStep]
    if (!step) return
    const W = window.innerWidth, H = window.innerHeight
    const { w, h } = tutSizeRef.current
    if (step.windowAnchor) setTutPos(resolveTutAnchor(step.windowAnchor, W, H, w, h))
  }, [tutStep, tutOpen])

  // Tutorial step side-effects: tree spawning, viewport focus, window auto-close
  const FIRST_ORGANISM_STEP = TUTORIAL_STEPS.findIndex(s => s.id === 'first_organism')
  const DNA_FIXED_STEP      = TUTORIAL_STEPS.findIndex(s => s.id === 'dna_fixed')

  // Windows to auto-close when a given step is entered
  const STEP_CLOSE_WINS = {
    [DNA_FIXED_STEP]: ['gene', 'species'],
  }

  useEffect(() => {
    if (!tutOpen) return
    if (tutStep === FIRST_ORGANISM_STEP) {
      sim.triggerFirstTree()
      spawnMoreTreesRef.current?.(1)
      // Small delay so the tree is in posMap before we try to focus on it
      setTimeout(() => focusViewportRef.current?.(), 120)
    } else if (tutStep === DNA_FIXED_STEP) {
      spawnMoreTreesRef.current?.(6)
    }
    // Auto-close windows no longer needed at this step
    const toClose = STEP_CLOSE_WINS[tutStep]
    if (toClose) {
      setWins(prev => {
        const next = { ...prev }
        toClose.forEach(id => { next[id] = { ...next[id], open: false } })
        return next
      })
    }
  }, [tutStep, tutOpen])

  const tutStepComplete = useMemo(() => {
    const step = TUTORIAL_STEPS[tutStep]
    if (!step?.completeWhen) return false
    switch (step.completeWhen) {
      case 'gene_open':        return wins.gene.open
      case 'species_selected': return selectedSpecies !== null
      case 'codon_changed':    return tutDnaEdited
      case 'clock_open':       return wins.clock.open
      case 'events_open':      return wins.events.open
      default:                 return false
    }
  }, [tutStep, wins, selectedSpecies, tutDnaEdited])

  // Time window content helpers
  const season       = getSeason(sim.tick)
  const mating       = breedingNow(sim.tick)
  const tickOfYear   = ((sim.tick % 12) + 12) % 12
  const tickOfSeason = (tickOfYear % 3) + 1

  return (
    <div className="app-shell">

      <IslandCanvas
        speed={speed}
        onSelectSpecies={openGeneEditor}
        preset={island?.preset ?? 'standard'}
        pops={sim.pops}
        individuals={sim.individuals}
        dnaOverrides={dnaOverrides}
        biomeScoresRef={biomeScoresRef}
        posMapRef={posMapRef}
        popsRef={popsRef}
        biomeAtRef={biomeAtRef}
        simTickRef={simTickRef}
        highlightMutationId={highlightMutationId}
        arrivedSpecies={sim.arrivedSpecies}
        spawnMoreTreesRef={spawnMoreTreesRef}
        focusViewportRef={focusViewportRef}
      />

      <Header
        year={sim.year}
        islandName={island?.name ?? null}
        onBackToDashboard={() => navigate('/islands')}
        wins={wins}
        onToggleWin={toggleWin}
        onOpenTutorial={tutReopen}
      />

      {/* Overseer narrator popup — arrivals and environmental events */}
      {(sim.eventBanner || sim.arrivalBanner) && (
        <OverseerPopup
          message={sim.eventBanner ?? sim.arrivalBanner}
          onDismiss={sim.eventBanner ? sim.dismissEventBanner : sim.dismissArrivalBanner}
        />
      )}

      {/* ── Floating windows ──────────────────────────────────────────── */}

      {wins.clock.open && (
        <FloatingWindow
          title="⏱ Time"
          pos={wins.clock.pos} size={wins.clock.size} zIndex={winZ('clock')}
          onClose={() => closeWin('clock')} onFocus={() => focusWin('clock')}
          onMove={pos => moveWin('clock', pos)} onResize={size => resizeWin('clock', size)}
          minW={220} minH={140}
        >
          <div className="time-win">
            <div className="time-win__info">
              <span className="time-win__year">Year {sim.year}</span>
              <span className="time-win__season">
                {season.emoji} {season.name}
                <span style={{ opacity: 0.6 }}>{tickOfSeason}/3</span>
              </span>
              {mating.length > 0 && (
                <span className="time-win__mating">💕 Breeding: {mating.join('')}</span>
              )}
            </div>
            <div className="time-win__divider" />
            <div className="time-win__controls">
              <span className="speed-label">{SPEED_LABELS[speed]}</span>
              <div className="speed-slider-wrap">
                <input
                  type="range" min={0} max={4} step={1} value={speed}
                  className="speed-slider"
                  onChange={e => setSpeed(Number(e.target.value))}
                />
                <div className="speed-ticks">
                  {SPEED_LABELS.map((_, i) => <span key={i} />)}
                </div>
              </div>
              {speed === 0 && (
                <button className="speed-btn--step" onClick={sim.stepTick} title="Step one tick">▶|</button>
              )}
            </div>
          </div>
        </FloatingWindow>
      )}

      {wins.events.open && (
        <FloatingWindow
          title="📋 Events"
          pos={wins.events.pos} size={wins.events.size} zIndex={winZ('events')}
          onClose={() => closeWin('events')} onFocus={() => focusWin('events')}
          onMove={pos => moveWin('events', pos)} onResize={size => resizeWin('events', size)}
          minW={300} minH={220}
        >
          <EventsPanel
            nextArrival={sim.nextArrival}
            pops={sim.pops}
            livePops={popsRef.current}
            event={sim.event}
            log={sim.log}
          />
        </FloatingWindow>
      )}

      {wins.ecosystem.open && (
        <FloatingWindow
          title="🌍 Ecosystem"
          pos={wins.ecosystem.pos} size={wins.ecosystem.size} zIndex={winZ('ecosystem')}
          onClose={() => closeWin('ecosystem')} onFocus={() => focusWin('ecosystem')}
          onMove={pos => moveWin('ecosystem', pos)} onResize={size => resizeWin('ecosystem', size)}
          minW={300} minH={200}
        >
          <EcosystemPanel
            event={sim.event}
            log={sim.log}
            deadMatter={sim.deadMatter}
            pops={sim.pops}
            arrivedSpecies={sim.arrivedSpecies}
          />
        </FloatingWindow>
      )}

      {wins.species.open && (
        <FloatingWindow
          title="🐾 Species"
          pos={wins.species.pos} size={wins.species.size} zIndex={winZ('species')}
          onClose={() => closeWin('species')} onFocus={() => focusWin('species')}
          onMove={pos => moveWin('species', pos)} onResize={size => resizeWin('species', size)}
          minW={280} minH={200}
        >
          <SpeciesList
            pops={sim.pops}
            dnaOverrides={dnaOverrides}
            onSelectSpecies={openGeneEditor}
            selectedSpecies={selectedSpecies}
            individuals={sim.individuals}
            arrivedSpecies={sim.arrivedSpecies}
          />
        </FloatingWindow>
      )}

      {wins.gene.open && (
        <FloatingWindow
          title={`🧬 Gene Lab${selectedSpecies ? ' · ' + selectedSpecies.name : ''}`}
          pos={wins.gene.pos} size={wins.gene.size} zIndex={winZ('gene')}
          onClose={closeGeneEditor} onFocus={() => focusWin('gene')}
          onMove={pos => moveWin('gene', pos)} onResize={size => resizeWin('gene', size)}
          minW={420} minH={300}
          bodyStyle={{ overflow: 'hidden' }}
        >
          <div className="gene-panel-split" style={{ height: '100%' }}>
            <div className="gene-panel-split__editor">
              {selectedSpecies
                ? <GeneEditor
                    species={selectedSpecies}
                    dna={dnaOverrides[selectedSpecies.id]}
                    onDnaChange={newDna => handleDnaChange(selectedSpecies.id, newDna)}
                    onClose={closeGeneEditor}
                    livePop={sim.pops[selectedSpecies.id] ?? 0}
                    onInjectMutation={(deltas, count) => sim.injectMutation(selectedSpecies.id, deltas, count)}
                  />
                : (
                  <div className="panel-empty">
                    <span>Select a species first.</span>
                    <button className="pixel-btn" onClick={() => toggleWin('species')}>
                      Open Species
                    </button>
                  </div>
                )
              }
            </div>
            <div className="gene-panel-split__genetics">
              <GeneticsPanel
                mutationRegistry={sim.mutationRegistry}
                mutationFreqHistory={sim.mutationFreqHistory}
                pops={sim.pops}
                highlightMutationId={highlightMutationId}
                onHighlight={setHighlightMutationId}
              />
            </div>
          </div>
        </FloatingWindow>
      )}

      {tutOpen && (
        <>
          {/* Hide overlay on interactive steps (no highlightEl) or once the action is done */}
          {!(TUTORIAL_STEPS[tutStep]?.completeWhen && !TUTORIAL_STEPS[tutStep]?.highlightEl) && !tutStepComplete && (
            <SpotlightOverlay
              selector={TUTORIAL_STEPS[tutStep]?.highlightEl ?? null}
              zIndex={150}
            />
          )}
          <TutorialWindow
            step={tutStep}
            stepComplete={tutStepComplete}
            pos={tutPos} size={tutSize}
            zIndex={160}
            onNext={tutNext} onBack={tutBack} onSkip={tutDone}
            onClose={tutDone}
            onFocus={() => focusWin('tutorial')}
            onMove={setTutPos} onResize={setTutSize}
            animated
          />
        </>
      )}

    </div>
  )
}
