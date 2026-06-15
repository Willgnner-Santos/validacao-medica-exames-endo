import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProgresso, getMedico, exportarCSV } from '../api'

const COR_MEDIA = (m) => {
  if (!m) return 'text-slate-400'
  if (m >= 2.5) return 'text-green-600 font-semibold'
  if (m >= 1.8) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

export default function Resumo() {
  const [prog, setProg] = useState(null)
  const navigate = useNavigate()
  const medico = getMedico()

  useEffect(() => { fetchProgresso().then(setProg) }, [])

  if (!prog) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  )

  const completo = prog.pct_completo === 100

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

        {/* Título */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">{completo ? '🎉' : '📊'}</div>
          <h1 className="text-2xl font-bold text-slate-800">
            {completo ? 'Avaliação concluída!' : 'Resumo parcial'}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {medico} — {prog.avaliados} de {prog.total} imagens avaliadas ({prog.pct_completo}%)
          </p>
        </div>

        {/* Barra */}
        <div className="w-full bg-slate-200 rounded-full h-3 mb-8">
          <div
            className="bg-medical-500 h-3 rounded-full transition-all"
            style={{ width: `${prog.pct_completo}%` }}
          />
        </div>

        {/* Tabela por classe */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Classe</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Avaliados</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Média concordância</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(prog.por_classe).map(([rotulo, info]) => (
                <tr key={rotulo} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{rotulo}</td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {info.avaliados}/{info.total}
                  </td>
                  <td className={`px-4 py-3 text-center ${COR_MEDIA(info.media_concordancia)}`}>
                    {info.media_concordancia != null
                      ? `${info.media_concordancia.toFixed(2)} / 3.00`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400 text-center mb-6">
          Concordância: 1 = Errado · 2 = Parcial · 3 = Correto
        </p>

        {/* Ações */}
        <div className="flex flex-col gap-3">
          {!completo ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-xl bg-medical-600 text-white font-semibold hover:bg-medical-700 transition shadow"
            >
              Continuar avaliando →
            </button>
          ) : (
            <>
              <button
                onClick={exportarCSV}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow"
              >
                Exportar CSV
              </button>
              <div className="text-center text-sm text-slate-500 bg-slate-100 rounded-xl px-4 py-3">
                Suas respostas foram salvas. Obrigado pela avaliação!
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition"
              >
                Ver todas as imagens
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
