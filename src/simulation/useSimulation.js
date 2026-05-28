import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SPECIES } from '../data/species.js'
import { tick, TICKS_PER_YEAR, EVENTS } from './engine.js'
import { initIndividuals, spawnIndividuals, freshId } from './individuals.js'
import { ISLAND_SCALE } from './worldConfig.js'
import { ARRIVAL_SCHEDULE, ARRIVAL_HOME } from './arrivalConfig.js'

// Speed config indexed by slider position (0–4)
// mult  — IBM time-scale factor passed to canvas RAF (movement, hunger, aging)
// tickMs — engine tick interval in ms (population math, events, year counter)
const SPEED_CONFIG = [
  { mult: 0,    tickMs: null  },   // 0: Pause
  { mult: 0.3,  tickMs: 8000 },   // 1: Watch  — real-time; observe individual behaviors
  { mult: 1.0,  tickMs: 1500 },   // 2: Normal — comfortable ecosystem pace
  { mult: 4.0,  tickMs: 400  },   // 3: Fast
  { mult: 12.0, tickMs: 80   },   // 4: Skip   — timewarp
]

// Which biomes each producer/decomposer prefers (for placement)
const PRODUCER_BIOME_PREF = {
  grass: ['plains', 'marsh', 'highland'],
  tree:  ['forest', 'dense_veg'],
  fungi: ['forest', 'dense_veg', 'highland', 'marsh'],
}

// Hotspot centers in base 820×540 coordinates, scaled by ISLAND_SCALE at runtime
const PRODUCER_HOME = {
  grass: { x: 560 * ISLAND_SCALE, y: 400 * ISLAND_SCALE },
  tree:  { x: 220 * ISLAND_SCALE, y: 210 * ISLAND_SCALE },
  fungi: { x: 205 * ISLAND_SCALE, y: 295 * ISLAND_SCALE },
}
const PRODUCER_RADIUS = {
  grass: 120 * ISLAND_SCALE,
  tree:   55 * ISLAND_SCALE,
  fungi:  55 * ISLAND_SCALE,
}

// Biomes that are impassable water (strong steer-away zone for placement)
const IMPASSABLE_BIOMES = new Set(['ocean', 'deep_ocean', 'outside'])

function placeLandPosition(spId, biomeAt) {
  const home = PRODUCER_HOME[spId]
  const rad  = PRODUCER_RADIUS[spId] ?? 80
  const prefs = PRODUCER_BIOME_PREF[spId] ?? []
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = Math.random() * Math.PI * 2
    const r     = Math.sqrt(Math.random()) * rad
    const x     = home.x + Math.cos(angle) * r
    const y     = home.y + Math.sin(angle) * r
    if (!biomeAt) return { x, y }
    const biome = biomeAt(x, y)
    if (!IMPASSABLE_BIOMES.has(biome) && prefs.includes(biome)) return { x, y }
  }
  return { x: home.x, y: home.y }
}

// Producers that start absent and are seeded by the arrival schedule
const DEFERRED_PRODUCERS = new Set(['grass', 'fungi'])

function initialState() {
  return {
    pops: Object.fromEntries(SPECIES.map(s => [s.id, DEFERRED_PRODUCERS.has(s.id) ? 0 : s.pop])),
    deadMatter: 0,
    nutrients:  0,
    tick:  0,
    year:  1,
    event: null,
    log:   [],
  }
}

// dnaBySpecies: { [id]: { baseStats, dna } }
// biomeScoresRef: { [spId]: { [indId]: boolean } }
// posMapRef: shared agent Map (also used by IslandCanvas)
// popsRef:   live animal counts written by canvas each frame
// biomeAtRef: biomeAt(wx,wy) function written by IslandCanvas after preset loads
const VAR_KEYS = ['speed','resilience','metabolism','camouflage','heatTolerance','strength','reasoning','fertility','constitution']
const MAX_HISTORY = 80  // samples kept per stat per species

export function useSimulation(speed, dnaBySpecies, biomeScoresRef, posMapRef, popsRef, biomeAtRef) {
  const [state,       setState]       = useState(initialState)
  const [individuals, setIndividuals] = useState(initIndividuals)
  const [arrivalBanner,   setArrivalBanner]   = useState(null)  // { spId, label, message, concept } | null
  const [eventBanner,     setEventBanner]     = useState(null)  // { id, emoji, title, desc, concept } | null
  const [arrivedSpecies,  setArrivedSpecies]  = useState(() => new Set())

  // Genetics tracking
  const variationHistoryRef  = useRef({})  // { [spId]: { [statKey]: number[] } }
  const mutationRegistryRef  = useRef({})  // { [mutId]: { mutId, spId, deltas, count, tick } }
  const mutationFreqHistRef  = useRef({})  // { [mutId]: number[] }  (0–100 %)
  const mutCounterRef        = useRef(0)
  const [variationHistory,   setVariationHistory]   = useState({})
  const [mutationRegistry,   setMutationRegistry]   = useState({})
  const [mutationFreqHistory, setMutationFreqHistory] = useState({})
  const simTickRef           = useRef(0)

  const arrivedRef = useRef(new Set())  // species physically present on the island

  const dnaRef = useRef(dnaBySpecies)
  dnaRef.current = dnaBySpecies

  // Called by the tutorial when the "first_organism" step is shown
  function triggerFirstTree() {
    const entry = ARRIVAL_SCHEDULE[0]
    if (entry && entry.spId === 'tree' && !arrivedRef.current.has('tree')) {
      spawnArrival(entry)
    }
  }

  // Sync producers in posMap to match engine pops and migrate events
  function syncProducers(producerPops, eventPops) {
    const posMap  = posMapRef?.current
    const biomeAt = biomeAtRef?.current
    if (!posMap) return

    // Trees are IBM-driven (seeds + herbivory) — syncProducers only manages grass and fungi
    for (const spId of ['grass', 'fungi']) {
      const target  = Math.round(producerPops[spId] ?? 0)
      const entries = [...posMap.entries()].filter(([, e]) => e.spId === spId)
      const delta   = target - entries.length

      if (delta > 0) {
        for (let i = 0; i < delta; i++) {
          const pos = placeLandPosition(spId, biomeAt)
          posMap.set(freshId(), { ...pos, spId, vx: 0, vy: 0, age: 0, variation: {} })
        }
      } else if (delta < 0) {
        // Remove non-carriers first to preserve injected mutations in the population
        const sorted = [...entries].sort(([, a], [, b]) =>
          ((a.carriers?.size ?? 0) > 0 ? 1 : 0) - ((b.carriers?.size ?? 0) > 0 ? 1 : 0)
        )
        const toRemove = sorted.slice(0, -delta)
        for (const [id] of toRemove) posMap.delete(id)
      }
    }

    // Handle migration event: only boost species that have already arrived via the schedule
    if (eventPops?.__migration) {
      const spawnVariation = () => Object.fromEntries(
        ['speed','resilience','metabolism','camouflage','heatTolerance','strength','reasoning'].map(k => [k, 0])
      )
      if (arrivedRef.current.has('deer')) {
        for (let i = 0; i < 9; i++) {
          const home = {
            x: 400 * ISLAND_SCALE + (Math.random() - 0.5) * 120 * ISLAND_SCALE,
            y: 390 * ISLAND_SCALE + (Math.random() - 0.5) * 120 * ISLAND_SCALE,
          }
          posMap.set(freshId(), {
            ...home, vx: 0, vy: 0, spId: 'deer',
            gender: Math.random() < 0.5 ? 'M' : 'F',
            variation: spawnVariation(),
            state: 'wander', targetId: null, hunger: 100, age: 0, cooldowns: { breed: 0 },
          })
        }
      }
      if (arrivedRef.current.has('beetle')) {
        for (let i = 0; i < 16; i++) {
          const home = {
            x: 390 * ISLAND_SCALE + (Math.random() - 0.5) * 100 * ISLAND_SCALE,
            y: 410 * ISLAND_SCALE + (Math.random() - 0.5) * 100 * ISLAND_SCALE,
          }
          posMap.set(freshId(), {
            ...home, vx: 0, vy: 0, spId: 'beetle',
            gender: Math.random() < 0.5 ? 'M' : 'F',
            variation: spawnVariation(),
            state: 'wander', targetId: null, hunger: 100, age: 0, cooldowns: { breed: 0 },
          })
        }
      }
    }
  }

  // Reconstruct React individuals snapshot from posMap for UI components
  function rebuildIndividuals() {
    const posMap = posMapRef?.current
    if (!posMap) return
    const bySpecies = {}
    for (const [id, entry] of posMap) {
      const spId = entry.spId
      if (!spId) continue
      if (!bySpecies[spId]) bySpecies[spId] = []
      bySpecies[spId].push({
        id,
        gender:    entry.gender    ?? null,
        variation: entry.variation ?? {},
      })
    }
    setIndividuals(bySpecies)
  }

  // Spawn a newly-arrived species into the posMap
  function spawnArrival(entry) {
    const posMap  = posMapRef?.current
    const biomeAt = biomeAtRef?.current
    if (!posMap) return

    // Trees are seeded by IslandCanvas (biome-aware placement) — just mark arrived
    if (entry.spId !== 'tree') {
      const home = ARRIVAL_HOME[entry.spId]
      const inds = spawnIndividuals(entry.spId, entry.count)
      const IMPASSABLE = new Set(['ocean', 'deep_ocean', 'outside'])

      for (const ind of inds) {
        let placed = false
        for (let attempt = 0; attempt < 30; attempt++) {
          const angle = Math.random() * Math.PI * 2
          const r     = Math.sqrt(Math.random()) * home.spread
          const x     = home.x + Math.cos(angle) * r
          const y     = home.y + Math.sin(angle) * r
          if (biomeAt && IMPASSABLE.has(biomeAt(x, y))) continue
          posMap.set(ind.id, {
            x, y, vx: 0, vy: 0,
            spId:    entry.spId,
            gender:  ind.gender,
            variation: ind.variation,
            state:   'wander', targetId: null,
            hunger:  100, age: 0, cooldowns: { breed: 0 },
          })
          placed = true; break
        }
        if (!placed) {
          posMap.set(ind.id, {
            x: home.x, y: home.y, vx: 0, vy: 0,
            spId:    entry.spId,
            gender:  ind.gender,
            variation: ind.variation,
            state:   'wander', targetId: null,
            hunger:  100, age: 0, cooldowns: { breed: 0 },
          })
        }
      }
    }

    arrivedRef.current.add(entry.spId)
    setArrivedSpecies(new Set(arrivedRef.current))
    // Tree arrival is narrated by the tutorial — suppress the banner
    if (entry.spId !== 'tree') {
      setArrivalBanner({ spId: entry.spId, label: entry.label, message: entry.message, concept: entry.concept, overseerText: entry.overseerText, overseerSprite: entry.overseerSprite })
      setTimeout(() => setArrivalBanner(null), 14000)
    }
  }

  // Inject variation deltas into N random living agents; tag each with a unique mutation ID
  const injectMutation = useCallback((spId, deltas, count) => {
    const posMap = posMapRef?.current
    if (!posMap) return 0
    const candidates = [...posMap.entries()].filter(([, e]) => e.spId === spId)
    if (!candidates.length) return 0
    const shuffled = candidates.sort(() => Math.random() - 0.5)
    const targets  = shuffled.slice(0, Math.min(count, shuffled.length))

    const mutId = `mut_${++mutCounterRef.current}`

    for (const [, entry] of targets) {
      if (!entry.variation) entry.variation = {}
      if (!entry.carriers)  entry.carriers  = new Set()
      for (const [key, delta] of Object.entries(deltas)) {
        entry.variation[key] = Math.round(
          Math.max(-60, Math.min(60, (entry.variation[key] ?? 0) + delta))
        )
      }
      entry.carriers.add(mutId)
    }

    const newReg = {
      ...mutationRegistryRef.current,
      [mutId]: { mutId, spId, deltas, count: targets.length, tick: simTickRef.current },
    }
    mutationRegistryRef.current = newReg
    setMutationRegistry({ ...newReg })

    return targets.length
  }, [])

  // Single tick advance — called by interval and by manual step button
  const doTick = useCallback(() => {
    setState(prev => {
      const animalPops = popsRef?.current ?? {}
      const next = tick(prev, dnaRef.current, animalPops)
      simTickRef.current = next.tick ?? 0
      // Sync producers into posMap based on engine output
      syncProducers(next.pops, next.pops)
      // Rebuild UI individuals snapshot
      rebuildIndividuals()
      // Sample mean variation per trait per species
      const posMap = posMapRef?.current
      if (posMap) {
        const sums = {}, counts = {}
        for (const [, entry] of posMap) {
          const sp = entry.spId
          if (!sp || !entry.variation) continue
          if (!sums[sp]) { sums[sp] = {}; counts[sp] = 0 }
          counts[sp]++
          for (const k of VAR_KEYS) sums[sp][k] = (sums[sp][k] ?? 0) + (entry.variation[k] ?? 0)
        }
        const hist = { ...variationHistoryRef.current }
        for (const [sp, statSums] of Object.entries(sums)) {
          if (!hist[sp]) hist[sp] = {}
          for (const k of VAR_KEYS) {
            const mean = counts[sp] > 0 ? Math.round((statSums[k] ?? 0) / counts[sp]) : 0
            if (!hist[sp][k]) hist[sp][k] = []
            hist[sp][k] = [...hist[sp][k], mean].slice(-MAX_HISTORY)
          }
        }
        variationHistoryRef.current = hist
        setVariationHistory({ ...hist })

        // Sample carrier frequency per registered mutation
        const registry = mutationRegistryRef.current
        if (Object.keys(registry).length > 0) {
          const speciesCounts    = {}
          const mutCarrierCounts = {}
          for (const [, entry] of posMap) {
            if (!entry.spId) continue
            speciesCounts[entry.spId] = (speciesCounts[entry.spId] ?? 0) + 1
            if (entry.carriers?.size) {
              for (const mutId of entry.carriers) {
                mutCarrierCounts[mutId] = (mutCarrierCounts[mutId] ?? 0) + 1
              }
            }
          }
          const freqHist = { ...mutationFreqHistRef.current }
          for (const [mutId, meta] of Object.entries(registry)) {
            const total    = speciesCounts[meta.spId] ?? 0
            const carriers = mutCarrierCounts[mutId]  ?? 0
            const freq     = total > 0 ? Math.round((carriers / total) * 100) : 0
            if (!freqHist[mutId]) freqHist[mutId] = []
            freqHist[mutId] = [...freqHist[mutId], freq].slice(-100)
          }
          mutationFreqHistRef.current = freqHist
          setMutationFreqHistory({ ...freqHist })
        }
      }

      // Fire event popup when a new environmental event starts
      if (next.event && !prev.event) {
        const evDef = EVENTS[next.event.id]
        if (evDef) {
          setTimeout(() => {
            setEventBanner({ id: next.event.id, emoji: evDef.emoji, title: evDef.title, desc: evDef.desc, concept: evDef.concept, overseerText: evDef.overseerText, overseerSprite: evDef.overseerSprite })
            setTimeout(() => setEventBanner(null), 14000)
          }, 0)
        }
      }

      // Check arrival schedule — only evaluate the first un-arrived species
      const nextEntry = ARRIVAL_SCHEDULE.find(e => !arrivedRef.current.has(e.spId))
      if (nextEntry) {
        const livePops = popsRef?.current ?? {}
        if (nextEntry.readyWhen(next.pops, livePops)) {
          if (DEFERRED_PRODUCERS.has(nextEntry.spId)) {
            next.pops[nextEntry.spId] = nextEntry.count
            arrivedRef.current.add(nextEntry.spId)
            setTimeout(() => {
              setArrivedSpecies(new Set(arrivedRef.current))
              setArrivalBanner({ spId: nextEntry.spId, label: nextEntry.label, message: nextEntry.message, concept: nextEntry.concept, overseerText: nextEntry.overseerText, overseerSprite: nextEntry.overseerSprite })
              setTimeout(() => setArrivalBanner(null), 14000)
            }, 0)
          } else {
            setTimeout(() => spawnArrival(nextEntry), 0)
          }
        }
      }

      return next
    })
  }, []) // reads only from stable refs — never needs to re-create


  useEffect(() => {
    const cfg = SPEED_CONFIG[speed]
    if (!cfg || !cfg.tickMs) return
    const id = setInterval(doTick, cfg.tickMs)
    return () => clearInterval(id)
  }, [speed, doTick])

  // Combine engine producer pops with live animal pops for consumers (PopulationPanel etc.)
  const combinedPops = {
    ...state.pops,
    ...(popsRef?.current ?? {}),
  }

  // Next species yet to arrive
  const nextArrival = ARRIVAL_SCHEDULE.find(e => !arrivedRef.current.has(e.spId)) ?? null

  const dismissEventBanner   = useCallback(() => setEventBanner(null), [])
  const dismissArrivalBanner = useCallback(() => setArrivalBanner(null), [])

  return { ...state, pops: combinedPops, individuals, stepTick: doTick, arrivalBanner, nextArrival, arrivedSpecies, variationHistory, mutationRegistry, mutationFreqHistory, injectMutation, eventBanner, dismissEventBanner, dismissArrivalBanner, triggerFirstTree }
}
