import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import App              from './App.jsx'
import AuthPage         from './pages/AuthPage.jsx'
import IslandsPage      from './pages/IslandsPage.jsx'
import CreateIslandPage from './pages/CreateIslandPage.jsx'
import TeacherModePage  from './pages/TeacherModePage.jsx'
import './styles/global.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 24, fontFamily: 'monospace' }}>Loading...</div>
  if (!user)   return <Navigate to="/auth" replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/islands' : '/auth'} replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"               element={<RootRedirect />} />
          <Route path="/auth"           element={<AuthPage />} />
          <Route path="/islands"        element={<ProtectedRoute><IslandsPage /></ProtectedRoute>} />
          <Route path="/create-island"  element={<ProtectedRoute><CreateIslandPage /></ProtectedRoute>} />
          <Route path="/game/:id"       element={<ProtectedRoute><App /></ProtectedRoute>} />
          <Route path="/teacher"        element={<TeacherModePage />} />
          <Route path="/showcase"       element={<TeacherModePage />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
