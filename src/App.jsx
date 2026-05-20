import React, { useState, useRef } from 'react'
import Header from './components/Header.jsx'
import IslandCanvas from './components/IslandCanvas.jsx'
import EcosystemPanel from './components/EcosystemPanel.jsx'
import SpeciesList from './components/SpeciesList.jsx'
import GeneEditor from './components/GeneEditor.jsx'
import './styles/App.css'

function startDrag(e, startVal, onUpdate) {
  e.preventDefault()
  const origin = { x: e.clientX, y: e.clientY }
  function onMove(mv) { onUpdate(mv, origin, startVal) }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

export default function App() {
  const [selectedSpecies, setSelectedSpecies] = useState(null)
  const [speed, setSpeed]           = useState(1)
  const [year]                      = useState(1)
  const [rightWidth, setRightWidth] = useState(340)
  const [spHeight, setSpHeight]     = useState(220)

  function onVDividerDrag(e) {
    startDrag(e, rightWidth, (mv, origin, start) => {
      const next = Math.round(start - (mv.clientX - origin.x))
      setRightWidth(Math.max(220, Math.min(600, next)))
    })
  }

  function onHDividerDrag(e) {
    startDrag(e, spHeight, (mv, origin, start) => {
      const next = Math.round(start - (mv.clientY - origin.y))
      setSpHeight(Math.max(80, Math.min(520, next)))
    })
  }

  return (
    <div className="app-shell">

      {/* Island fills the entire background */}
      <IslandCanvas speed={speed} onSelectSpecies={setSelectedSpecies} />

      {/* Header overlaid at top */}
      <Header year={year} speed={speed} onSpeedChange={setSpeed} />

      {/* Right panel overlaid on the right */}
      <div className="overlay-panel" style={{ width: rightWidth }}>
        {/* Left edge — drag to resize panel width */}
        <div className="divider divider--v" onPointerDown={onVDividerDrag} />

        <div className="overlay-panel__body">
          <div className="pane--ecosystem">
            <EcosystemPanel />
          </div>

          <div className="divider divider--h" onPointerDown={onHDividerDrag} />

          <div className="pane--species" style={{ height: spHeight }}>
            <SpeciesList
              onSelectSpecies={setSelectedSpecies}
              selectedSpecies={selectedSpecies}
            />
          </div>
        </div>
      </div>

      {/* Gene editor tray slides up from bottom */}
      <div className={`gene-editor-tray ${selectedSpecies ? 'gene-editor-tray--open' : ''}`}>
        <GeneEditor species={selectedSpecies} onClose={() => setSelectedSpecies(null)} />
      </div>

    </div>
  )
}
