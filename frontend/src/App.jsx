import { Routes, Route, Navigate } from 'react-router-dom'
import Entrada from './pages/Entrada'
import Dashboard from './pages/Dashboard'
import Avaliacao from './pages/Avaliacao'
import Resumo from './pages/Resumo'
import { getMedico } from './api'

function ProtectedRoute({ children }) {
  if (!getMedico()) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Entrada />} />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/avaliar/:id" element={
        <ProtectedRoute><Avaliacao /></ProtectedRoute>
      } />
      <Route path="/resumo" element={
        <ProtectedRoute><Resumo /></ProtectedRoute>
      } />
    </Routes>
  )
}
