import React, { useState, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import IslandCanvas from './components/IslandCanvas.jsx'
import EcosystemPanel from './components/EcosystemPanel.jsx'
import PopulationPanel from './components/PopulationPanel.jsx'
import AnimalsPanel from './components/AnimalsPanel.jsx'
import SpeciesList from './components/SpeciesList.jsx'
import GeneEditor from './components/GeneEditor.jsx'
import { SPECIES } from './data/species.js'
import { useSimulation } from './simulation/useSimulation.js'
import './styles/App.css'

export default function App() {
  const { state }                             = useLocation()
  const navigate                              = useNavigate()
  const island                                = state?.island ?? null

  const [activePanel,     setActivePanel]     = useState(null)
  const [selectedSpecies, setSelectedSpecies] = useState(null)
  const [speed,           setSpeed]           = useState(1)

  // DNA overrides: { [speciesId]: string[] }  (starts from species defaults)
  const [dnaOverrides, setDnaOverrides] = useState(() =>
    Object.fromEntries(SPECIES.map(s => [s.id, [...s.dna]]))
  )

  // Shared biome score map — written by IslandCanvas RAF loop, read by useSimulation tick.
  // { [speciesId]: { [individualId]: boolean } }  true = in preferred biome
  const biomeScoresRef = useRef({})

  // Build the dnaBySpecies map the simulation engine needs
  const dnaBySpecies = useMemo(() =>
    Object.fromEntries(SPECIES.map(s => [
      s.id,
      { baseStats: s.stats, dna: dnaOverrides[s.id] },
    ])),
    [dnaOverrides]
  )

  const sim = useSimulation(speed, dnaBySpecies, biomeScoresRef)

  function handleDnaChange(speciesId, newDna) {
    setDnaOverrides(prev => ({ ...prev, [speciesId]: newDna }))
  }

  function togglePanel(name) {
    setActivePanel(prev => prev === name ? null : name)
  }

  function openGeneEditor(sp) {
    setSelectedSpecies(sp)
    setActivePanel('gene')
  }

  function closeGeneEditor() {
    setSelectedSpecies(null)
    setActivePanel(null)
  }

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
      />

      <Header
        year={sim.year}
        tick={sim.tick}
        speed={speed}
        onSpeedChange={setSpeed}
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        selectedSpecies={selectedSpecies}
        islandName={island?.name ?? null}
        onBackToDashboard={() => navigate('/islands')}
      />

      {activePanel === 'ecosystem' && (
        <div className="dropdown-panel">
          <EcosystemPanel
            event={sim.event}
            log={sim.log}
            deadMatter={sim.deadMatter}
          />
        </div>
      )}

      {activePanel === 'population' && (
        <div className="dropdown-panel">
          <PopulationPanel pops={sim.pops} />
        </div>
      )}

      {activePanel === 'animals' && (
        <div className="dropdown-panel">
          <AnimalsPanel />
        </div>
      )}

      {activePanel === 'species' && (
        <div className="dropdown-panel">
          <SpeciesList
            pops={sim.pops}
            dnaOverrides={dnaOverrides}
            onSelectSpecies={openGeneEditor}
            selectedSpecies={selectedSpecies}
            individuals={sim.individuals}
          />
        </div>
      )}

      {activePanel === 'gene' && (
        <div className="dropdown-panel dropdown-panel--wide">
          {selectedSpecies
            ? <GeneEditor
                species={selectedSpecies}
                dna={dnaOverrides[selectedSpecies.id]}
                onDnaChange={newDna => handleDnaChange(selectedSpecies.id, newDna)}
                onClose={closeGeneEditor}
              />
            : (
              <div className="panel-empty">
                <span>No species selected.</span>
                <button className="pixel-btn" onClick={() => setActivePanel('species')}>
                  Open Species
                </button>
              </div>
            )
          }
        </div>
      )}

    </div>
  )
}
