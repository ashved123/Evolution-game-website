// Codon → trait label + stat modifiers.
// Modifiers are added on top of a species' base stats (result clamped 0–100).

export const CODONS = {
  ATG: { label: 'Baseline',          effects: {} },
  TAA: { label: 'Average build',     effects: {} },
  GCC: { label: 'Standard vision',   effects: { speed: +5 } },
  GAC: { label: 'Keen eyesight',     effects: { speed: +15, strength: +10 } },
  AAT: { label: 'Cryptic colouring', effects: { camouflage: +22, speed: -5 } },
  GGC: { label: 'Fast metabolism',   effects: { metabolism: +22, resilience: -12 } },
  CGT: { label: 'Heat adapted',      effects: { heatTolerance: +25, metabolism: -8 } },
  TGC: { label: 'Thick integument',  effects: { resilience: +20, heatTolerance: +10, speed: -8 } },
  CTA: { label: 'Immune upregulated',effects: { resilience: +22 } },
  ACG: { label: 'Streamlined body',  effects: { speed: +18, resilience: -10 } },
  TCA: { label: 'Night vision',      effects: { speed: +8, camouflage: +10 } },
  GTA: { label: 'High endurance',    effects: { resilience: +12, metabolism: +10 } },
}

export const STAT_META = [
  { key: 'speed',         label: 'Speed',       color: '#42a5f5' },
  { key: 'resilience',    label: 'Resilience',  color: '#66bb6a' },
  { key: 'metabolism',    label: 'Metabolism',  color: '#ffa726' },
  { key: 'camouflage',    label: 'Camouflage',  color: '#ab47bc' },
  { key: 'heatTolerance', label: 'Heat Tol.',   color: '#ef5350' },
  { key: 'strength',      label: 'Strength',    color: '#ffee58' },
]

// Apply codon effects to a base stats object, return new stats (clamped 0–100)
export function applyDNA(baseStats, dnaSequence) {
  const result = { ...baseStats }
  dnaSequence.forEach(codon => {
    const entry = CODONS[codon]
    if (!entry) return
    Object.entries(entry.effects).forEach(([stat, delta]) => {
      result[stat] = Math.min(100, Math.max(0, (result[stat] ?? 0) + delta))
    })
  })
  return result
}
