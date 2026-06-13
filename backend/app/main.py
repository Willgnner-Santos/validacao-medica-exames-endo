import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db, init_db
from .models import Avaliacao
from .schemas import AvaliacaoItem, AvaliacaoSubmit, Progresso

load_dotenv()

IMAGES_DIR    = Path(os.getenv("IMAGES_DIR", "/app/images"))
METADATA_JSON = Path(os.getenv("METADATA_JSON", "/app/data/metadata.json"))
EXPORTS_DIR   = Path(os.getenv("EXPORTS_DIR", "/app/exports"))
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Validação Médica — Grad-CAM EDA", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    await seed_from_metadata()


async def seed_from_metadata():
    """Popula a tabela avaliacoes a partir do metadata.json se ainda estiver vazia."""
    if not METADATA_JSON.exists():
        return

    from .database import SessionLocal
    async with SessionLocal() as db:
        count = await db.scalar(select(func.count()).select_from(Avaliacao))
        if count and count > 0:
            return

        with open(METADATA_JSON, encoding="utf-8") as f:
            entries = json.load(f)

        for entry in entries:
            stats = entry.get("cam_stats", {})
            av = Avaliacao(
                image_name        = entry["image_name"],
                rotulo            = entry["label_name"],
                confianca_modelo  = entry["confidence"],
                cam_mean          = stats.get("mean"),
                cam_pct_above_050 = stats.get("pct_above_050"),
                tem_reflexo_luz   = bool(entry.get("has_luz", False)),
                interpretation    = entry.get("interpretation"),
                avaliado          = False,
            )
            db.add(av)
        await db.commit()
        print(f"[seed] {len(entries)} imagens carregadas do metadata.json")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/avaliacoes", response_model=list[AvaliacaoItem])
async def listar_avaliacoes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Avaliacao).order_by(Avaliacao.rotulo, Avaliacao.id))
    rows = result.scalars().all()
    items = []
    for row in rows:
        item = AvaliacaoItem.model_validate(row)
        slug = row.rotulo.replace("Ó","O").replace("Ú","U").replace("Ã","A").replace("É","E")
        stem = Path(row.image_name).stem
        item.overlay_path   = f"/api/imagem/{stem}_{slug}_overlay.png"
        item.original_path  = f"/api/imagem/{stem}_{slug}_original.png"
        items.append(item)
    return items


@app.get("/api/avaliacoes/{av_id}", response_model=AvaliacaoItem)
async def get_avaliacao(av_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Avaliacao, av_id)
    if not row:
        raise HTTPException(404, "Avaliação não encontrada")
    item = AvaliacaoItem.model_validate(row)
    slug = row.rotulo.replace("Ó","O").replace("Ú","U").replace("Ã","A").replace("É","E")
    stem = Path(row.image_name).stem
    item.overlay_path = f"/api/imagem/{stem}_{slug}_overlay.png"
    return item


async def _regenerar_csv(db: AsyncSession):
    """Regenera avaliacoes_medicas.csv no servidor após cada avaliação salva.
    A médica não precisa fazer nada — você coleta quando quiser via /api/exportar."""
    result = await db.execute(select(Avaliacao).order_by(Avaliacao.rotulo, Avaliacao.id))
    rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "image_name", "rotulo", "confianca_modelo", "cam_mean",
        "cam_pct_above_050", "tem_reflexo_luz",
        "concordancia", "ativacao_na_lesao", "observacao", "avaliado_em",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.image_name, r.rotulo,
            r.confianca_modelo, r.cam_mean, r.cam_pct_above_050,
            r.tem_reflexo_luz,
            r.concordancia, r.ativacao_na_lesao, r.observacao, r.avaliado_em,
        ])

    csv_path = EXPORTS_DIR / "avaliacoes_medicas.csv"
    csv_path.write_text(buf.getvalue(), encoding="utf-8")


@app.post("/api/avaliacoes/{av_id}", response_model=AvaliacaoItem)
async def salvar_avaliacao(
    av_id: int,
    payload: AvaliacaoSubmit,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Avaliacao, av_id)
    if not row:
        raise HTTPException(404, "Avaliação não encontrada")

    row.concordancia      = payload.concordancia
    row.ativacao_na_lesao = payload.ativacao_na_lesao
    row.observacao        = payload.observacao
    row.avaliado          = True
    row.avaliado_em       = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    # Regera CSV automaticamente — sem depender da médica
    await _regenerar_csv(db)

    item = AvaliacaoItem.model_validate(row)
    slug = row.rotulo.replace("Ó","O").replace("Ú","U").replace("Ã","A").replace("É","E")
    stem = Path(row.image_name).stem
    item.overlay_path = f"/api/imagem/{stem}_{slug}_overlay.png"
    return item


@app.get("/api/progresso", response_model=Progresso)
async def progresso(db: AsyncSession = Depends(get_db)):
    total    = await db.scalar(select(func.count()).select_from(Avaliacao))
    avaliados = await db.scalar(
        select(func.count()).select_from(Avaliacao).where(Avaliacao.avaliado == True)
    )
    total    = total or 0
    avaliados = avaliados or 0

    # Por classe
    result = await db.execute(
        select(
            Avaliacao.rotulo,
            func.count().label("total"),
            func.sum(case((Avaliacao.avaliado == True, 1), else_=0)).label("avaliados"),
            func.avg(case((Avaliacao.avaliado == True, Avaliacao.concordancia), else_=None)).label("media_concordancia"),
        ).group_by(Avaliacao.rotulo)
    )
    por_classe = {}
    for row in result:
        por_classe[row.rotulo] = {
            "total":              row.total,
            "avaliados":          int(row.avaliados or 0),
            "media_concordancia": round(float(row.media_concordancia), 2) if row.media_concordancia else None,
        }

    return Progresso(
        total=total,
        avaliados=avaliados,
        pendentes=total - avaliados,
        pct_completo=round(avaliados / total * 100, 1) if total else 0.0,
        por_classe=por_classe,
    )


@app.get("/api/imagem/{filename}")
async def servir_imagem(filename: str):
    path = IMAGES_DIR / filename
    if not path.exists():
        raise HTTPException(404, f"Imagem não encontrada: {filename}")
    return FileResponse(path)


@app.get("/api/exportar")
async def exportar_csv(db: AsyncSession = Depends(get_db)):
    """Serve o CSV gerado automaticamente pelo servidor.
    Sempre atualizado — regera do banco se o arquivo não existir ainda."""
    csv_path = EXPORTS_DIR / "avaliacoes_medicas.csv"
    if not csv_path.exists():
        await _regenerar_csv(db)
    return FileResponse(
        csv_path,
        media_type="text/csv; charset=utf-8",
        filename="avaliacoes_medicas.csv",
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Servir frontend estático (produção) ───────────────────────────────────────
# Montado depois das rotas /api para não interceptá-las
_static_dir = Path(__file__).parent.parent / "static"
if _static_dir.exists():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Catch-all para o React Router — sempre devolve index.html."""
        return FileResponse(_static_dir / "index.html")
