# Validação Médica — Grad-CAM EDA

Interface para avaliação clínica dos mapas de ativação (Grad-CAM) gerados pelo modelo M2 Swin-Tiny.

## Como rodar

### Com Docker (recomendado)

```bash
cd validacao-medica
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs

### Desenvolvimento local

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Fluxo

1. Na primeira inicialização, o backend lê `metadata.json` e popula o banco PostgreSQL.
2. A médica abre `http://localhost:3000`, vê o grid de 22 imagens.
3. Clica em cada imagem, vê o overlay Grad-CAM, e responde:
   - **Concordância:** 1=Errado / 2=Parcial / 3=Correto
   - **Ativação na lesão (só EROSÃO com LUZ):** S ou N
   - **Observação:** texto livre opcional
4. Ao finalizar, clica em "Exportar CSV" para baixar `avaliacoes_medicas.csv`.

## Exportar dados para o artigo

```
GET /api/exportar  →  avaliacoes_medicas.csv
```

Ou clique em "Exportar CSV" na interface.
