import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAvaliacoes, fetchProgresso } from '../api'

const CLASSES = ['ENANTEMA', 'PÓLIPO', 'ÚLCERA', 'EROSÃO', 'MICRONODULARIDADE']

const ROTULO_ESTILO = {
  ENANTEMA:          { bg: 'bg-orange-50',  borda: 'border-orange-300',  badge: 'bg-orange-100 text-orange-800 border-orange-200',  barra: 'bg-orange-400' },
  'PÓLIPO':          { bg: 'bg-purple-50',  borda: 'border-purple-300',  badge: 'bg-purple-100 text-purple-800 border-purple-200',  barra: 'bg-purple-400' },
  'ÚLCERA':          { bg: 'bg-red-50',     borda: 'border-red-300',     badge: 'bg-red-100 text-red-800 border-red-200',           barra: 'bg-red-400'    },
  'EROSÃO':          { bg: 'bg-yellow-50',  borda: 'border-yellow-300',  badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',  barra: 'bg-yellow-400' },
  MICRONODULARIDADE: { bg: 'bg-teal-50',    borda: 'border-teal-300',    badge: 'bg-teal-100 text-teal-800 border-teal-200',        barra: 'bg-teal-400'   },
}

const CONCORDANCIA_LABEL = { 1: 'Errado', 2: 'Parcial', 3: 'Correto' }
const CONCORDANCIA_COR   = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-yellow-100 text-yellow-700',
  3: 'bg-green-100 text-green-700',
}

export default function Dashboard() {
  const [avaliacoes, setAvaliacoes] = useState([])
  const [progresso, setProgresso]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([fetchAvaliacoes(), fetchProgresso()])
      .then(([avs, prog]) => { setAvaliacoes(avs); setProgresso(prog) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500 text-lg">Carregando...</div>
    </div>
  )

  const pct      = progresso?.pct_completo ?? 0
  const completo = pct >= 100
  const pendentes = progresso?.pendentes ?? 0

  const porClasse = {}
  CLASSES.forEach(c => { porClasse[c] = [] })
  avaliacoes.forEach(av => {
    if (porClasse[av.rotulo]) porClasse[av.rotulo].push(av)
  })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-800">
            Validação de Explicabilidade — IA Gastroscopia
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Avalie se as regiões destacadas pelo modelo fazem sentido clínico
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Barra de progresso em destaque ── */}
        <div className={`rounded-2xl border-2 p-5 mb-8 shadow-sm transition-colors ${
          completo
            ? 'bg-green-50 border-green-300'
            : pendentes <= 5
            ? 'bg-amber-50 border-amber-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-semibold text-base ${completo ? 'text-green-700' : pendentes <= 5 ? 'text-amber-700' : 'text-slate-700'}`}>
              {completo
                ? 'Avaliação concluída!'
                : `${pendentes} imagem${pendentes !== 1 ? 'ns' : ''} pendente${pendentes !== 1 ? 's' : ''}`}
            </span>
            <span className={`text-sm font-medium ${completo ? 'text-green-600' : 'text-slate-500'}`}>
              {progresso?.avaliados} / {progresso?.total}
            </span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-4 mt-2 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-700 ${
                completo ? 'bg-green-500' : pendentes <= 5 ? 'bg-amber-500' : 'bg-medical-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">0%</span>
            <span className={`font-medium ${completo ? 'text-green-600' : pendentes <= 5 ? 'text-amber-600' : 'text-slate-500'}`}>{pct}%</span>
            <span className="text-slate-400">100%</span>
          </div>

          {!completo && (
            <p className={`mt-3 text-sm rounded-lg px-3 py-2 ${
              pendentes <= 5
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-blue-50 text-blue-700 border border-blue-100'
            }`}>
              {pendentes <= 5
                ? `Faltam apenas ${pendentes} imagem${pendentes !== 1 ? 'ns' : ''}! Clique nas miniaturas abaixo para concluir.`
                : 'Clique em uma imagem abaixo para iniciar ou continuar a avaliação.'}
            </p>
          )}
          {completo && (
            <p className="mt-3 text-sm bg-green-100 text-green-800 border border-green-200 rounded-lg px-3 py-2">
              Todas as imagens foram avaliadas. Obrigada pela sua colaboração!
            </p>
          )}

          {progresso?.por_classe && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CLASSES.map((rotulo) => {
                const info = progresso.por_classe[rotulo]
                if (!info) return null
                const est  = ROTULO_ESTILO[rotulo] ?? {}
                const cpct = info.total > 0 ? Math.round(info.avaliados / info.total * 100) : 0
                return (
                  <div key={rotulo} className="text-xs bg-white rounded-lg p-2.5 border border-slate-100 shadow-sm">
                    <span className={`inline-block px-2 py-0.5 rounded-full border font-medium mb-1.5 ${est.badge ?? ''}`}>
                      {rotulo}
                    </span>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                      <div className={`h-1.5 rounded-full ${est.barra ?? 'bg-slate-400'}`} style={{ width: `${cpct}%` }} />
                    </div>
                    <span className="text-slate-400">{info.avaliados}/{info.total}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Seções por classe ── */}
        {CLASSES.map((rotulo) => {
          const imgs = porClasse[rotulo] ?? []
          if (!imgs.length) return null
          const est       = ROTULO_ESTILO[rotulo] ?? {}
          const nAvaliados = imgs.filter(a => a.avaliado).length
          const classeOk  = nAvaliados === imgs.length

          return (
            <section key={rotulo} className="mb-10">
              <div className={`flex items-center justify-between mb-3 px-4 py-3 rounded-xl border-l-4 ${est.bg ?? 'bg-slate-50'} ${est.borda ?? 'border-slate-300'}`}>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${est.badge ?? ''}`}>
                    {rotulo}
                  </span>
                  <span className="text-sm text-slate-500">
                    {nAvaliados} de {imgs.length} avaliadas
                  </span>
                </div>
                {classeOk && (
                  <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium">
                    Concluído
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {imgs.map((av) => (
                  <div
                    key={av.id}
                    className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden cursor-pointer
                      hover:shadow-md hover:-translate-y-0.5 transition-all duration-150
                      ${av.avaliado ? 'border-green-300' : 'border-slate-200 hover:border-slate-300'}`}
                    onClick={() => navigate(`/avaliar/${av.id}`)}
                  >
                    <div className="relative bg-slate-900 aspect-square overflow-hidden">
                      <img
                        src={av.overlay_path}
                        alt={`${av.rotulo} - ${av.image_name}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                      {av.avaliado && (
                        <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shadow">
                          ✓
                        </div>
                      )}
                      {av.tem_reflexo_luz && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-400 text-amber-900 text-xs px-1.5 py-0.5 rounded-full font-medium leading-none">
                          ⚡
                        </div>
                      )}
                    </div>

                    <div className="px-2 py-1.5">
                      <p className="text-xs text-slate-400 truncate">{av.image_name}</p>
                      {av.avaliado && av.concordancia ? (
                        <span className={`mt-1 inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${CONCORDANCIA_COR[av.concordancia]}`}>
                          {CONCORDANCIA_LABEL[av.concordancia]}
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-xs text-slate-300 italic">Pendente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
