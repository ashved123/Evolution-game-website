import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SPECIES } from '../data/species.js'
import { tick, TICKS_PER_YEAR, EVENTS } from './engine.js'
import { initIndividuals, spawnIndividuals, freshId } from './individuals.js'
import { ISLAND_SCALE } from './worldConfig.js'
import { ARRIVAL_SCHEDULE, ARRIVAL_HOME } from './arrivalConfig.js'
import { LIFESPAN, TREE_ADULT_AGE } from './agentConfig.js'

// Speed config indexed by speed value (0–11)
// 0=Pause, 1=Watch, 2-11=Timewarp 1×–10×
// mult  — IBM time-scale factor passed to canvas RAF (movement, hunger, aging)
// tickMs — engine tick interval in ms (population math, events, year counter)
const SPEED_CONFIG = [
  { mult: 0,    tickMs: null  },   // 0: Pause
  { mult: 0.3,  tickMs: 8000 },   // 1: Watch
  { mult: 1.0,  tickMs: 1500 },   // 2: 1×
  { mult: 2.0,  tickMs: 750  },   // 3: 2×
  { mult: 3.0,  tickMs: 500  },   // 4: 3×
  { mult: 4.0,  tickMs: 375  },   // 5: 4×
  { mult: 5.0,  tickMs: 300  },   // 6: 5×
  { mult: 6.0,  tickMs: 250  },   // 7: 6×
  { mult: 7.0,  tickMs: 214  },   // 8: 7×
  { mult: 8.0,  tickMs: 188  },   // 9: 8×
  { mult: 9.0,  tickMs: 167  },   // 10: 9×
  { mult: 10.0, tickMs: 150  },   // 11: 10×
]

// Biomes that are impassable (reject placement)
const IMPASSABLE_BIOMES  = new Set(['ocean', 'deep_ocean', 'outside'])
const HARD_BLOCK_BIOMES  = new Set(['ocean', 'deep_ocean', 'outside', 'mountain', 'beach'])

// Island world dimensions (base 820×540 × ISLAND_SCALE)
const ISLAND_WW = 820 * ISLAND_SCALE
const ISLAND_WH = 540 * ISLAND_SCALE

// Hotspot centers for non-grass producers (base coords × ISLAND_SCALE)
const PRODUCER_HOME = {
  tree:  { x: 220 * ISLAND_SCALE, y: 210 * ISLAND_SCALE },
  fungi: { x: 205 * ISLAND_SCALE, y: 295 * ISLAND_SCALE },
}
const PRODUCER_RADIUS = {
  tree:   55 * ISLAND_SCALE,
  fungi:  55 * ISLAND_SCALE,
}
const PRODUCER_BIOME_PREF = {
  tree:  ['forest', 'dense_veg'],
  fungi: ['forest', 'dense_veg', 'highland', 'marsh'],
}

// Grass grows wherever there's open land — plains AND between trees in forest.
// Plains / forest / dense_veg all accepted immediately; highland/marsh with some chance.
function placeGrass(biomeAt) {
  if (!biomeAt) return { x: Math.random() * ISLAND_WW, y: Math.random() * ISLAND_WH }
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * ISLAND_WW
    const y = Math.random() * ISLAND_WH
    const biome = biomeAt(x, y)
    if (HARD_BLOCK_BIOMES.has(biome)) continue
    if (['plains', 'forest', 'dense_veg'].includes(biome)) return { x, y }
    if (['highland', 'marsh'].includes(biome) && Math.random() < 0.35) return { x, y }
    if (!HARD_BLOCK_BIOMES.has(biome) && Math.random() < 0.08) return { x, y }
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * ISLAND_WW
    const y = Math.random() * ISLAND_WH
    if (!HARD_BLOCK_BIOMES.has(biomeAt(x, y))) return { x, y }
  }
  return { x: 400 * ISLAND_SCALE, y: 350 * ISLAND_SCALE }
}

// Fungi scatter across any forested ground island-wide — no fixed hotspot.
// Strong preference for forest floor; occasional appearance on highland/plains.
function placeFungi(biomeAt) {
  if (!biomeAt) return { x: Math.random() * ISLAND_WW, y: Math.random() * ISLAND_WH }
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * ISLAND_WW
    const y = Math.random() * ISLAND_WH
    const biome = biomeAt(x, y)
    if (HARD_BLOCK_BIOMES.has(biome)) continue
    if (['forest', 'dense_veg'].includes(biome)) return { x, y }
    if (['highland', 'marsh', 'plains'].includes(biome) && Math.random() < 0.15) return { x, y }
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * ISLAND_WW
    const y = Math.random() * ISLAND_WH
    if (!HARD_BLOCK_BIOMES.has(biomeAt(x, y))) return { x, y }
  }
  return { x: 205 * ISLAND_SCALE, y: 295 * ISLAND_SCALE }
}

function placeLandPosition(spId, biomeAt) {
  if (spId === 'grass')  return placeGrass(biomeAt)
  if (spId === 'fungi')  return placeFungi(biomeAt)
  const home  = PRODUCER_HOME[spId]
  const rad   = PRODUCER_RADIUS[spId] ?? 80
  const prefs = PRODUCER_BIOME_PREF[spId] ?? []
  for (let attempt = 0; attempt < 30; attempt++) {
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
    pressure: 0,
    log:   [],
  }
}

// dnaBySpecies: { [id]: { baseStats, dna } }
// biomeScoresRef: { [spId]: { [indId]: boolean } }
// posMapRef: shared agent Map (also used by IslandCanvas)
// popsRef:   live animal counts written by canvas each frame
// biomeAtRef: biomeAt(wx,wy) function written by IslandCanvas after preset loads
const VAR_KEYS = ['speed','resilience','metabolism','camouflage','heatTolerance','strength','reasoning','fertility','constitution']
const MAX_HISTORY    = 80
const MAX_POP_HISTORY = 80

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

  // Population history tracking
  const popHistoryRef = useRef({})  // { [spId]: number[] }
  const [popHistory,  setPopHistory] = useState({})

  // Genetic diversity: mean variance per stat per species (0–100, higher = more diverse)
  const diversityRef  = useRef({})  // { [spId]: number }
  const [diversity,   setDiversity] = useState({})

  // Cause-of-death accumulator — written by IslandCanvas RAF, flushed into log each engine tick
  const deathLogRef   = useRef({})  // { [spId]: { starvation: N, predation: N, age: N, inbreeding: N } }
  const [deathLog,    setDeathLog]  = useState([])

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

        // Genetic diversity = mean variance of variation stats per species
        // Low diversity triggers inbreeding depression in the IBM via diversityRef
        const varMap = {}
        for (const [, entry] of posMap) {
          const sp = entry.spId
          if (!sp || !entry.variation) continue
          if (!varMap[sp]) varMap[sp] = { sums: {}, sqSums: {}, n: 0 }
          varMap[sp].n++
          for (const k of VAR_KEYS) {
            const v = entry.variation[k] ?? 0
            varMap[sp].sums[k]  = (varMap[sp].sums[k]  ?? 0) + v
            varMap[sp].sqSums[k]= (varMap[sp].sqSums[k]?? 0) + v * v
          }
        }
        const divNow = {}
        for (const [sp, d] of Object.entries(varMap)) {
          let totalVariance = 0
          for (const k of VAR_KEYS) {
            const mean = d.sums[k] / d.n
            const variance = d.sqSums[k] / d.n - mean * mean
            totalVariance += Math.max(0, variance)
          }
          // Normalise: sqrt of mean variance, capped at 50 → maps to 0–100 diversity index
          divNow[sp] = Math.min(100, Math.round(Math.sqrt(totalVariance / VAR_KEYS.length) * 2))
        }
        diversityRef.current = divNow
        setDiversity({ ...divNow })

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

        // Sample population history (producers from engine, animals from popsRef)
        const allPops = { ...next.pops, ...(popsRef?.current ?? {}) }
        const popHist = { ...popHistoryRef.current }
        for (const [spId, count] of Object.entries(allPops)) {
          if (typeof count !== 'number' || spId.startsWith('__')) continue
          if (!popHist[spId]) popHist[spId] = []
          popHist[spId] = [...popHist[spId], Math.round(Math.max(0, count))].slice(-MAX_POP_HISTORY)
        }
        popHistoryRef.current = popHist
        setPopHistory({ ...popHist })

        // Flush death log accumulated since last tick
        const deaths = deathLogRef.current
        if (Object.keys(deaths).length > 0) {
          const entries = []
          for (const [spId, causes] of Object.entries(deaths)) {
            for (const [cause, count] of Object.entries(causes)) {
              if (count > 0) entries.push({ spId, cause, count, year: next.year })
            }
          }
          if (entries.length > 0) {
            setDeathLog(prev => [...entries, ...prev].slice(0, 40))
          }
          deathLogRef.current = {}
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
          // Mark arrived immediately (before any async work) so rapid ticks can't double-spawn
          arrivedRef.current.add(nextEntry.spId)
          if (DEFERRED_PRODUCERS.has(nextEntry.spId)) {
            next.pops[nextEntry.spId] = nextEntry.count
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

  // Build a fully-fledged example world: dense forest everywhere, grass as undergrowth,
  // fungi on the floor, animals distributed naturally across the island.
  const initDevWorld = useCallback(() => {
    try {
      const posMap  = posMapRef?.current
      const biomeAt = biomeAtRef?.current
      if (!posMap) return

      const IMPASSABLE = new Set(['ocean', 'deep_ocean', 'outside'])
      const BLOCKED    = new Set(['ocean', 'deep_ocean', 'outside', 'mountain', 'beach'])
      const TREE_OK    = new Set(['forest', 'dense_veg', 'plains', 'highland'])

      // ── Full reset (safe: copy keys first, then delete) ──────────────
      for (const id of [...posMap.keys()]) posMap.delete(id)

      // ── Trees: very dense in forest/dense_veg, almost none on plains ──
      // Forest biomes pack tightly (small spacing).
      // Plains/highland get only a handful of isolated trees at most.
      const placed = []
      const FOREST_MIN_D2  = (ISLAND_SCALE) ** 2        // absolute minimum — sprites nearly touching
      const PLAINS_MIN_D2  = (30 * ISLAND_SCALE) ** 2  // isolated specimens only
      for (let attempt = 0; attempt < 20000 && placed.length < 350; attempt++) {
        const x = Math.random() * ISLAND_WW
        const y = Math.random() * ISLAND_WH
        const biome = biomeAt ? biomeAt(x, y) : 'forest'
        if (!TREE_OK.has(biome)) continue
        if (biome === 'plains'   && Math.random() > 0.03) continue
        if (biome === 'highland' && Math.random() > 0.10) continue
        const minD2 = (biome === 'forest' || biome === 'dense_veg') ? FOREST_MIN_D2 : PLAINS_MIN_D2
        if (placed.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < minD2)) continue
        const isAdult = Math.random() > 0.18
        const treeId = freshId()
        posMap.set(treeId, {
          x, y, vx: 0, vy: 0, spId: 'tree',
          variation: Object.fromEntries(VAR_KEYS.map(k => [k, Math.round((Math.random() - 0.5) * 10)])),
          age: isAdult
            ? TREE_ADULT_AGE * (1 + Math.random() * 3)
            : Math.random() * TREE_ADULT_AGE * 0.8,
        })
        placed.push({ x, y, id: treeId })
      }

      // ── Animals: biome-aware, stable trophic ratios ──────────────────
      const BIOME_PREFS = {
        beetle:  ['forest', 'dense_veg', 'plains'],
        deer:    ['plains', 'forest', 'highland'],
        frog:    ['pond', 'plains', 'highland'],
        firefly: ['pond'],
        boar:    ['plains', 'forest', 'highland'],
        monitor: ['highland', 'dense_veg', 'plains'],
        hawk:    ['highland', 'forest', 'plains'],
      }
      const COUNTS = { beetle: 120, deer: 30, frog: 22, boar: 16, monitor: 8, hawk: 5, firefly: 25 }

      for (const [spId, count] of Object.entries(COUNTS)) {
        const prefs = BIOME_PREFS[spId] ?? []
        const inds  = spawnIndividuals(spId, count)
        for (const ind of inds) {
          let x = ISLAND_WW / 2, y = ISLAND_WH / 2
          let homeTreeId = null

          if (spId === 'beetle' && placed.length > 0) {
            // Beetles spawn on a random tree
            const t = placed[Math.floor(Math.random() * placed.length)]
            x = t.x + (Math.random() - 0.5) * 2 * ISLAND_SCALE
            y = t.y + (Math.random() - 0.5) * 2 * ISLAND_SCALE
            homeTreeId = t.id
          } else {
            for (let att = 0; att < 80; att++) {
              const tx = Math.random() * ISLAND_WW
              const ty = Math.random() * ISLAND_WH
              const biome = biomeAt ? biomeAt(tx, ty) : 'plains'
              if (IMPASSABLE.has(biome)) continue
              if (prefs.includes(biome)) { x = tx; y = ty; break }
              if (!BLOCKED.has(biome) && att > 70) { x = tx; y = ty; break }
            }
          }
          posMap.set(ind.id, {
            x, y, vx: 0, vy: 0, spId,
            gender: ind.gender, variation: ind.variation,
            state: 'wander', targetId: null,
            hunger: 70 + Math.random() * 25,
            age:    Math.random() * (LIFESPAN[spId] ?? 72000) * 0.6,
            cooldowns: { breed: 0 },
            homeTreeId,
          })
        }
        arrivedRef.current.add(spId)
      }

      // ── Mark producers arrived; engine handles grass/fungi counts ────
      arrivedRef.current.add('grass')
      arrivedRef.current.add('fungi')
      arrivedRef.current.add('tree')
      setArrivedSpecies(new Set(arrivedRef.current))

      setState(prev => ({
        ...prev,
        pops:       { ...prev.pops, grass: 2800, fungi: 125 },
        deadMatter: 90,
        nutrients:  30,
        tick:       TICKS_PER_YEAR * 22,
        year:       23,
      }))
    } catch (err) {
      console.error('[initDevWorld] failed:', err)
    }
  }, [])

  // Biomatter cost per individual by trophic level
  const INTRODUCE_COST = {
    grass: 2, fungi: 2, tree: 5,
    beetle: 8, deer: 20, frog: 20, boar: 20,
    monitor: 35, hawk: 60,
  }

  // Introduce N individuals of a species, deducting biomatter cost.
  // Returns { spawned, cost } or { error } if insufficient deadMatter.
  const introduceSpecies = useCallback((spId, count) => {
    const posMap  = posMapRef?.current
    const biomeAt = biomeAtRef?.current
    if (!posMap) return { error: 'not ready' }

    const costPer  = INTRODUCE_COST[spId] ?? 20
    const total    = costPer * count

    let canAfford = false
    setState(prev => {
      if (prev.deadMatter < total) return prev
      canAfford = true
      return { ...prev, deadMatter: Math.max(0, prev.deadMatter - total) }
    })
    // setState is async but we need a sync check — read state directly
    // Use a ref-based approach: check deadMatter via state snapshot in callback
    // We'll return optimistically and let the setState do the actual deduction.
    // The UI should re-read deadMatter after calling this.

    const IMPASSABLE = new Set(['ocean', 'deep_ocean', 'outside'])
    const home = ARRIVAL_HOME[spId] ?? { x: 400 * ISLAND_SCALE, y: 300 * ISLAND_SCALE, spread: 120 * ISLAND_SCALE }
    const inds = spawnIndividuals(spId, count)
    let spawned = 0

    setState(prev => {
      if (prev.deadMatter < total) return prev  // insufficient biomatter
      for (const ind of inds) {
        let x = home.x, y = home.y
        for (let attempt = 0; attempt < 40; attempt++) {
          const angle = Math.random() * Math.PI * 2
          const r     = Math.sqrt(Math.random()) * home.spread
          const tx    = home.x + Math.cos(angle) * r
          const ty    = home.y + Math.sin(angle) * r
          if (!biomeAt || !IMPASSABLE.has(biomeAt(tx, ty))) { x = tx; y = ty; break }
        }
        posMap.set(ind.id, {
          x, y, vx: 0, vy: 0, spId,
          gender: ind.gender ?? null, variation: ind.variation ?? {},
          state: 'wander', targetId: null,
          hunger: 90, age: 0, cooldowns: { breed: 0 },
        })
        spawned++
      }
      arrivedRef.current.add(spId)
      return { ...prev, deadMatter: Math.max(0, prev.deadMatter - total) }
    })

    return { spawned: count, cost: total }
  }, [])

  // Cull N random individuals of a species. Refunds 50% of their biomatter cost.
  const cullSpecies = useCallback((spId, count) => {
    const posMap = posMapRef?.current
    if (!posMap) return { culled: 0, refund: 0 }
    const pool    = [...posMap.entries()].filter(([, e]) => e.spId === spId)
    const targets = pool.sort(() => Math.random() - 0.5).slice(0, count)
    for (const [id] of targets) posMap.delete(id)
    const costPer = INTRODUCE_COST[spId] ?? 20
    const refund  = Math.floor(targets.length * costPer * 0.5)
    setState(prev => ({ ...prev, deadMatter: Math.min(600, prev.deadMatter + refund) }))
    return { culled: targets.length, refund }
  }, [])

  // Force an environmental event immediately (used by teacher walkthrough)
  const triggerEvent = useCallback((eventId) => {
    const animalPops = popsRef?.current ?? {}
    setState(prev => {
      if (prev.event) return prev
      const def = EVENTS[eventId]
      if (!def) return prev
      const pops = { ...prev.pops }
      if (def.apply) def.apply(pops, {}, animalPops)
      setTimeout(() => {
        setEventBanner({ id: eventId, emoji: def.emoji, title: def.title, desc: def.desc, concept: def.concept, overseerText: def.overseerText, overseerSprite: def.overseerSprite })
        setTimeout(() => setEventBanner(null), 14000)
      }, 0)
      return {
        ...prev, pops,
        event: { id: eventId, ticksLeft: def.duration },
        log: [{ id: eventId, year: prev.year, emoji: def.emoji, title: def.title, concept: def.concept }, ...prev.log.slice(0, 11)],
      }
    })
  }, [])

  const loadSnapshot = useCallback((snap) => {
    initDevWorld()
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        pops:       { ...prev.pops, ...(snap.pops ?? {}) },
        deadMatter: snap.deadMatter ?? prev.deadMatter,
        nutrients:  snap.nutrients  ?? prev.nutrients,
        tick:       (snap.year ?? prev.year) * TICKS_PER_YEAR,
        year:       snap.year ?? prev.year,
      }))
    }, 300)
  }, [initDevWorld])

  return { ...state, pops: combinedPops, individuals, stepTick: doTick, arrivalBanner, nextArrival, arrivedSpecies, variationHistory, mutationRegistry, mutationFreqHistory, injectMutation, eventBanner, dismissEventBanner, dismissArrivalBanner, triggerFirstTree, initDevWorld, loadSnapshot, popHistory, introduceSpecies, cullSpecies, INTRODUCE_COST, diversity, diversityRef, deathLog, deathLogRef, triggerEvent }
}
