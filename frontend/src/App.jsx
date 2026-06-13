import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Avaliacao from './pages/Avaliacao'
import Resumo from './pages/Resumo'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/avaliar/:id" element={<Avaliacao />} />
      <Route path="/resumo" element={<Resumo />} />
    </Routes>
  )
}
