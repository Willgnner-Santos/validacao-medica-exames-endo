import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { fetchAvaliacao, fetchAvaliacoes, fetchProgresso, salvarAvaliacao, getMedico } from '../api'

const CONCORDANCIA = [
  { valor: 1, label: 'Região errada',        desc: 'O destaque não corresponde ao achado',  cor: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' },
  { valor: 2, label: 'Parcialmente correta', desc: 'O destaque está próximo, mas impreciso', cor: 'border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100' },
  { valor: 3, label: 'Correta',              desc: 'O destaque cobre a região do achado',    cor: 'border-green-300 bg-green-50 text-green-800 hover:bg-green-100' },
]

export default function Avaliacao() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [av, setAv]               = useState(null)
  const [todos, setTodos]         = useState(location.state?.todos ?? [])
  const [concordancia, setConcordancia] = useState(null)
  const [ativacao, setAtivacao]   = useState('')
  const [obs, setObs]             = useState('')
  const [salvando, setSalvando]         = useState(false)
  const [loading, setLoading]           = useState(true)
  const [mostrarConclusao, setMostrarConclusao] = useState(false)

  useEffect(() => {
    setConcordancia(null)
    setAtivacao('')
    setObs('')
    setLoading(true)
  }, [id])

  useEffect(() => {
    const listaPromise = todos.length > 0 ? Promise.resolve(todos) : fetchAvaliacoes()
    Promise.all([fetchAvaliacao(Number(id)), listaPromise])
      .then(([item, lista]) => {
        setAv(item)
        setTodos(lista)
        if (item.avaliado) {
          setConcordancia(item.concordancia)
          setAtivacao(item.ativacao_na_lesao ?? '')
          setObs(item.observacao ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const navIds = todos.map((t) => t.id)
  const idx    = navIds.indexOf(Number(id))
  const prevId = idx > 0 ? navIds[idx - 1] : null
  const nextId = idx < navIds.length - 1 ? navIds[idx + 1] : null

  async function handleSalvar() {
    if (!concordancia) return
    setSalvando(true)
    try {
      await salvarAvaliacao(Number(id), {
        concordancia,
        ativacao_na_lesao: ativacao || null,
        observacao: obs || null,
      })

      // Atualiza a lista local sem ir ao servidor
      const todosAtualizados = todos.map(t =>
        t.id === Number(id) ? { ...t, avaliado: true, concordancia } : t
      )
      setTodos(todosAtualizados)

      const pendentes = todosAtualizados.filter(t => !t.avaliado).length
      if (pendentes === 0) {
        setMostrarConclusao(true)
        return
      }

      const navState = { state: { todos: todosAtualizados } }
      const proximaNaoAvaliada = todosAtualizados.find(t => !t.avaliado && t.id !== Number(id))
      if (nextId) navigate(`/avaliar/${nextId}`, navState)
      else if (proximaNaoAvaliada) navigate(`/avaliar/${proximaNaoAvaliada.id}`, navState)
      else navigate('/dashboard')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      Carregando...
    </div>
  )
  if (!av) return null

  if (mostrarConclusao) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-10 text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          Avaliação concluída!
        </h1>
        <p className="text-slate-600 leading-relaxed mb-2">
          Todas as {todos.length} imagens foram avaliadas com sucesso.
        </p>
        <p className="text-slate-600 leading-relaxed mb-6">
          Agradecemos imensamente o seu tempo e a sua expertise clínica.
          Sua contribuição é fundamental para validar a explicabilidade
          do modelo de IA e tornar este trabalho mais confiável e relevante
          para a prática médica.
        </p>
        <p className="text-sm text-slate-400 mb-8 italic">
          As suas respostas foram salvas automaticamente e serão
          analisadas com total sigilo para fins de pesquisa científica.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/resumo')}
            className="w-full py-3 rounded-xl bg-medical-600 text-white font-semibold hover:bg-medical-700 transition shadow"
          >
            Ver estatísticas
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition"
          >
            Ver todas as imagens
          </button>
        </div>
      </div>
    </div>
  )

  const precisaLuz = av.rotulo === 'EROSÃO' && av.tem_reflexo_luz
  const podeSalvar = concordancia !== null && (!precisaLuz || ativacao !== '')

  // Constrói URLs das imagens localmente — não depende do backend retornar o campo
  const stem = av.image_name.replace(/\.[^.]+$/, '')
  const slug = av.rotulo
    .replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ã/g,'A').replace(/É/g,'E')
  const urlOriginal = `/api/imagem/${stem}_${slug}_original.png`
  const urlOverlay  = av.overlay_path ?? `/api/imagem/${stem}_${slug}_overlay.png`

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-slate-600 transition text-sm">
            ← Voltar
          </button>
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-700">
              Imagem {idx + 1} de {todos.length}
            </span>
            <span className="ml-2 text-xs text-slate-400">{av.image_name}</span>
          </div>
          <div className="flex gap-2">
            {prevId && (
              <button onClick={() => navigate(`/avaliar/${prevId}`, { state: { todos } })}
                className="text-sm px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                ‹ Anterior
              </button>
            )}
            {nextId && (
              <button onClick={() => navigate(`/avaliar/${nextId}`, { state: { todos } })}
                className="text-sm px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                Próxima ›
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Coluna 1 — imagem original */}
          <div>
            <p className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Imagem original
            </p>
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg aspect-square">
              <img
                src={urlOriginal}
                alt={`Original ${av.rotulo}`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              Como a imagem chegou ao modelo
            </p>
          </div>

          {/* Coluna 2 — overlay Grad-CAM */}
          <div>
            <p className="text-center text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Atenção do modelo (Grad-CAM)
            </p>
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg aspect-square">
              <img
                src={urlOverlay}
                alt={`Grad-CAM ${av.rotulo}`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              Vermelho/amarelo = onde a IA focou para detectar {av.rotulo.toLowerCase()}
            </p>
          </div>

          {/* Coluna 3 — informações e formulário */}
          <div className="flex flex-col gap-5">

            {/* Informações do achado */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-800 text-lg">{av.rotulo}</h2>
                <span className="text-sm bg-medical-100 text-medical-700 px-3 py-1 rounded-full font-medium">
                  {(av.confianca_modelo * 100).toFixed(1)}% confiança
                </span>
              </div>

              {av.tem_reflexo_luz && (
                <div className="mb-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                  <span>⚡</span>
                  <span>Esta imagem contém reflexo de luz</span>
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed">{av.interpretation}</p>
            </div>

            {/* Pergunta principal */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="font-medium text-slate-800 mb-4">
                A região destacada corresponde à localização do achado?
              </p>
              <div className="flex flex-col gap-2">
                {CONCORDANCIA.map((op) => (
                  <button
                    key={op.valor}
                    onClick={() => setConcordancia(op.valor)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                      ${concordancia === op.valor
                        ? op.cor + ' ring-2 ring-offset-1 ring-medical-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <span className="font-medium">{op.label}</span>
                    <span className="text-xs block mt-0.5 opacity-70">{op.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pergunta extra — só EROSÃO com LUZ */}
            {precisaLuz && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
                <p className="font-medium text-amber-800 mb-3">
                  ⚡ A ativação do modelo está sobre a lesão ou sobre o reflexo de luz?
                </p>
                <div className="flex gap-3">
                  {[{ v: 'S', l: 'Sobre a lesão' }, { v: 'N', l: 'Sobre o reflexo' }].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setAtivacao(v)}
                      className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition
                        ${ativacao === v
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-100'
                        }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Observação livre */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Observação (opcional)
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                placeholder="Comentário clínico, dúvida, ou observação adicional..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                  text-slate-700 placeholder-slate-300 focus:outline-none
                  focus:ring-2 focus:ring-medical-400 resize-none"
              />
            </div>

            {/* Botão salvar */}
            <button
              onClick={handleSalvar}
              disabled={!podeSalvar || salvando}
              className={`w-full py-3.5 rounded-xl font-semibold text-base transition
                ${podeSalvar && !salvando
                  ? 'bg-medical-600 text-white hover:bg-medical-700 shadow-md hover:shadow-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {salvando ? 'Salvando...' : nextId ? 'Salvar e ir para a próxima →' : 'Salvar e ver resumo ✓'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
