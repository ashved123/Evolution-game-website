// Each codon has a single expression modifier (how much it adds to whatever trait it sits in).
// Three codons per trait → the trait modifier = sum of all three.
// Maximum range per trait: 3 × (+20) = +60 or 3 × (−20) = −60 on top of the species base stat.

export const CODONS = {
  // ── Strong positive (+20) ────────────────────────────────────────
  GAC: { label: 'Hypermorphic',       modifier: +20 },
  ATT: { label: 'Overexpressed',      modifier: +20 },
  // ── Moderate positive (+12) ─────────────────────────────────────
  TGC: { label: 'Dominant allele',    modifier: +12 },
  ACG: { label: 'Upregulated',        modifier: +12 },
  GGC: { label: 'Strong expression',  modifier: +12 },
  // ── Mild positive (+5) ──────────────────────────────────────────
  CGT: { label: 'Active promoter',    modifier:  +5 },
  AGC: { label: 'Mild upregulation',  modifier:  +5 },
  TCA: { label: 'Expressed locus',    modifier:  +5 },
  // ── Neutral (0) ─────────────────────────────────────────────────
  ATG: { label: 'Start codon',        modifier:   0 },
  TAA: { label: 'Stop codon',         modifier:   0 },
  GCC: { label: 'Silent',             modifier:   0 },
  // ── Mild negative (−5) ──────────────────────────────────────────
  GTA: { label: 'Weak promoter',      modifier:  -5 },
  TAT: { label: 'Mild suppression',   modifier:  -5 },
  TCG: { label: 'Reduced expression', modifier:  -5 },
  // ── Moderate negative (−12) ─────────────────────────────────────
  AAT: { label: 'Hypomorphic',        modifier: -12 },
  CCG: { label: 'Loss of function',   modifier: -12 },
  GAT: { label: 'Silenced locus',     modifier: -12 },
  // ── Strong negative (−20) ───────────────────────────────────────
  GGA: { label: 'Null mutation',      modifier: -20 },
  CTA: { label: 'Truncated gene',     modifier: -20 },
}

// Stat groups for the gene editor UI
export const STAT_GROUPS = [
  {
    label: 'Movement',
    stats: [
      { key: 'speed',         label: 'Speed',         color: '#42a5f5', desc: 'Movement rate & awareness range' },
      { key: 'strength',      label: 'Strength',      color: '#ffee58', desc: 'Hunt force & seed dispersal radius' },
    ],
  },
  {
    label: 'Survival',
    stats: [
      { key: 'constitution',  label: 'Constitution',  color: '#ff8a65', desc: 'Lifespan length' },
      { key: 'resilience',    label: 'Resilience',    color: '#66bb6a', desc: 'Resistance to death & disease' },
      { key: 'heatTolerance', label: 'Heat Tolerance',color: '#ef5350', desc: 'Survival in hot/cold events' },
    ],
  },
  {
    label: 'Behaviour',
    stats: [
      { key: 'reasoning',     label: 'Reasoning',     color: '#26c6da', desc: 'Decision quality & pathfinding' },
      { key: 'camouflage',    label: 'Camouflage',    color: '#ab47bc', desc: 'Stealth — reduces predator detection' },
    ],
  },
  {
    label: 'Physiology',
    stats: [
      { key: 'metabolism',    label: 'Metabolism',    color: '#ffa726', desc: 'Hunger drain rate & seed drop rate' },
      { key: 'fertility',     label: 'Fertility',     color: '#f06292', desc: 'Breeding speed & offspring rate' },
    ],
  },
]

export const STAT_META = STAT_GROUPS.flatMap(g => g.stats)
export const STAT_KEYS  = STAT_META.map(s => s.key)

// Default neutral 3-codon string for any trait slot
export const NEUTRAL_CODONS = ['ATG', 'TAA', 'GCC']

// dna is now { [statKey]: [codon1, codon2, codon3] }
// Each trait's modifier = sum of its three codons' modifier values, clamped 0–100.
export function applyDNA(baseStats, dna) {
  const result = { ...baseStats }
  for (const key of STAT_KEYS) {
    const codons = dna?.[key] ?? NEUTRAL_CODONS
    const modifier = codons.reduce((sum, c) => sum + (CODONS[c]?.modifier ?? 0), 0)
    result[key] = Math.min(100, Math.max(0, (baseStats[key] ?? 0) + modifier))
  }
  return result
}
