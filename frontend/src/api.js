const BASE = '/api'

export function getMedico() {
  return localStorage.getItem('medico_nome') || ''
}

export function setMedico(nome) {
  // Normaliza para Title Case — evita duplicatas por capitalização
  const normalizado = nome.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  localStorage.setItem('medico_nome', normalizado)
}

export function clearMedico() {
  localStorage.removeItem('medico_nome')
}

function medicoParam() {
  return `medico=${encodeURIComponent(getMedico())}`
}

export async function fetchAvaliacoes() {
  const r = await fetch(`${BASE}/avaliacoes?${medicoParam()}`)
  if (!r.ok) throw new Error('Erro ao carregar avaliações')
  return r.json()
}

export async function fetchAvaliacao(id) {
  const r = await fetch(`${BASE}/avaliacoes/${id}?${medicoParam()}`)
  if (!r.ok) throw new Error('Avaliação não encontrada')
  return r.json()
}

export async function salvarAvaliacao(id, payload) {
  const r = await fetch(`${BASE}/avaliacoes/${id}?${medicoParam()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('Erro ao salvar avaliação')
  return r.json()
}

export async function fetchProgresso() {
  const r = await fetch(`${BASE}/progresso?${medicoParam()}`)
  if (!r.ok) throw new Error('Erro ao carregar progresso')
  return r.json()
}

export function exportarCSV() {
  window.open(`${BASE}/exportar`, '_blank')
}
