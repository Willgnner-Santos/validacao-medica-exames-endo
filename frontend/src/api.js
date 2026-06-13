const BASE = '/api'

export async function fetchAvaliacoes() {
  const r = await fetch(`${BASE}/avaliacoes`)
  if (!r.ok) throw new Error('Erro ao carregar avaliações')
  return r.json()
}

export async function fetchAvaliacao(id) {
  const r = await fetch(`${BASE}/avaliacoes/${id}`)
  if (!r.ok) throw new Error('Avaliação não encontrada')
  return r.json()
}

export async function salvarAvaliacao(id, payload) {
  const r = await fetch(`${BASE}/avaliacoes/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('Erro ao salvar avaliação')
  return r.json()
}

export async function fetchProgresso() {
  const r = await fetch(`${BASE}/progresso`)
  if (!r.ok) throw new Error('Erro ao carregar progresso')
  return r.json()
}

export function exportarCSV() {
  window.open(`${BASE}/exportar`, '_blank')
}
