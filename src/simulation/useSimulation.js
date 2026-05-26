import { useState, useEffect, useRef } from 'react'
import { SPECIES } from '../data/species.js'
import { tick, TICKS_PER_YEAR } from './engine.js'
import { initIndividuals, syncIndividuals } from './individuals.js'

// Milliseconds per tick at each speed setting
const TICK_MS = {
  1: Math.round(1000 / TICKS_PER_YEAR),        // ~83ms  → 1 year / 12s
  2: Math.round(1000 / (TICKS_PER_YEAR * 2)),   // ~42ms  → 1 year / 6s
  4: Math.round(1000 / (TICKS_PER_YEAR * 4)),   // ~21ms  → 1 year / 3s
}

function initialState() {
  return {
    pops: Object.fromEntries(SPECIES.map(s => [s.id, s.pop])),
    deadMatter: 0,
    nutrients:  0,
    tick:  0,
    year:  1,
    event: null,
    log:   [],
  }
}

// dnaBySpecies: { [id]: { baseStats, dna } }
// biomeScoresRef: React.MutableRefObject<{ [spId]: { [indId]: boolean } }>
export function useSimulation(speed, dnaBySpecies, biomeScoresRef) {
  const [state,       setState]       = useState(initialState)
  const [individuals, setIndividuals] = useState(initIndividuals)

  const dnaRef = useRef(dnaBySpecies)
  dnaRef.current = dnaBySpecies

  useEffect(() => {
    if (speed === 0) return
    const ms = TICK_MS[speed] ?? TICK_MS[1]
    const id = setInterval(() => {
      setState(prev => {
        const next = tick(prev, dnaRef.current)
        const biomeScores = biomeScoresRef?.current ?? null
        setIndividuals(prevInds => syncIndividuals(prevInds, next.pops, dnaRef.current, next.tick, biomeScores))
        return next
      })
    }, ms)
    return () => clearInterval(id)
  }, [speed])

  return { ...state, individuals }
}
