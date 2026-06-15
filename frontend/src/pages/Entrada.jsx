import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMedico, setMedico } from '../api'

export default function Entrada() {
  const [nome, setNome] = useState(getMedico())
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  function handleEntrar(e) {
    e.preventDefault()
    const trimmed = nome.trim()
    if (!trimmed) {
      setErro('Por favor, informe seu nome antes de continuar.')
      return
    }
    setMedico(trimmed)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-medical-100 mb-4">
            <svg className="w-8 h-8 text-medical-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Validação de Explicabilidade
          </h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            IA para Gastroscopia — Avaliação Clínica
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-base font-semibold text-slate-700 mb-1">
            Identificação do avaliador
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Informe seu nome para iniciar ou continuar sua avaliação.
            Cada avaliador tem um conjunto independente de respostas.
          </p>

          <form onSubmit={handleEntrar} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setErro('') }}
                placeholder="Ex.: Dr. João Silva"
                autoFocus
                className={`w-full px-4 py-3 rounded-xl border text-slate-800 placeholder-slate-300
                  focus:outline-none focus:ring-2 focus:ring-medical-400 transition
                  ${erro ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
              />
              {erro && (
                <p className="mt-1.5 text-xs text-red-600">{erro}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-medical-600 text-white font-semibold
                hover:bg-medical-700 transition shadow-sm hover:shadow-md mt-2"
            >
              Iniciar avaliação →
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
          Suas respostas são salvas automaticamente e identificadas pelo nome informado.
          <br />Use sempre o mesmo nome para continuar uma avaliação já iniciada.
        </p>
      </div>
    </div>
  )
}
