import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App              from './App.jsx'
import IslandsPage      from './pages/IslandsPage.jsx'
import CreateIslandPage from './pages/CreateIslandPage.jsx'
import TeacherModePage  from './pages/TeacherModePage.jsx'
import ShowcasePage     from './pages/ShowcasePage.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Navigate to="/islands" replace />} />
        <Route path="/islands"       element={<IslandsPage />} />
        <Route path="/create-island" element={<CreateIslandPage />} />
        <Route path="/game/:id"      element={<App />} />
        <Route path="/teacher"       element={<TeacherModePage />} />
        <Route path="/showcase"      element={<ShowcasePage />} />
        <Route path="*"              element={<Navigate to="/islands" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
