import asyncio
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db, init_db
from .models import Avaliacao, ImagemCache
from .schemas import AvaliacaoItem, AvaliacaoSubmit, Progresso

load_dotenv()

IMAGES_DIR    = Path(os.getenv("IMAGES_DIR", "/app/images"))
METADATA_JSON = Path(os.getenv("METADATA_JSON", "/app/data/metadata.json"))
EXPORTS_DIR   = Path(os.getenv("EXPORTS_DIR", "/app/exports"))
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Validação Médica — Grad-CAM EDA", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    await seed_images()


async def _seed_medico(db: AsyncSession, medico_nome: str):
    """Popula as avaliações para um médico específico se ainda não existir nenhuma para ele."""
    if not METADATA_JSON.exists():
        return

    count = await db.scalar(
        select(func.count()).select_from(Avaliacao).where(Avaliacao.medico_nome == medico_nome)
    )
    if count and count > 0:
        return

    with open(METADATA_JSON, encoding="utf-8") as f:
        entries = json.load(f)

    for entry in entries:
        stats = entry.get("cam_stats", {})
        av = Avaliacao(
            image_name        = entry["image_name"],
            rotulo            = entry["label_name"],
            medico_nome       = medico_nome,
            confianca_modelo  = entry["confidence"],
            cam_mean          = stats.get("mean"),
            cam_pct_above_050 = stats.get("pct_above_050"),
            tem_reflexo_luz   = bool(entry.get("has_luz", False)),
            interpretation    = entry.get("interpretation"),
            avaliado          = False,
        )
        db.add(av)
    await db.commit()
    print(f"[seed] {len(entries)} imagens carregadas para '{medico_nome}'")


async def seed_images():
    """Carrega PNGs do filesystem para o banco — executa uma vez só na primeira inicialização."""
    if not IMAGES_DIR.exists():
        return

    from .database import SessionLocal
    async with SessionLocal() as db:
        count = await db.scalar(select(func.count()).select_from(ImagemCache))
        if count and count > 0:
            return

        pngs = list(IMAGES_DIR.glob("*.png"))
        if not pngs:
            return

        for png in pngs:
            db.add(ImagemCache(
                filename=png.name,
                content_type="image/png",
                dados=png.read_bytes(),
            ))
        await db.commit()
        print(f"[seed] {len(pngs)} imagens carregadas no banco")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_medico(medico: str | None) -> str:
    if not medico or not medico.strip():
        raise HTTPException(400, "Parâmetro 'medico' obrigatório")
    return medico.strip().title()


def _build_item(row: Avaliacao) -> AvaliacaoItem:
    item = AvaliacaoItem.model_validate(row)
    slug = row.rotulo.replace("Ó","O").replace("Ú","U").replace("Ã","A").replace("É","E")
    stem = Path(row.image_name).stem
    item.overlay_path  = f"/api/imagem/{stem}_{slug}_overlay.png"
    item.original_path = f"/api/imagem/{stem}_{slug}_original.png"
    return item


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/avaliacoes", response_model=list[AvaliacaoItem])
async def listar_avaliacoes(
    medico: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    nome = _require_medico(medico)
    await _seed_medico(db, nome)
    result = await db.execute(
        select(Avaliacao)
        .where(Avaliacao.medico_nome == nome)
        .order_by(Avaliacao.rotulo, Avaliacao.id)
    )
    return [_build_item(r) for r in result.scalars().all()]


@app.get("/api/avaliacoes/{av_id}", response_model=AvaliacaoItem)
async def get_avaliacao(
    av_id: int,
    medico: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    nome = _require_medico(medico)
    result = await db.execute(
        select(Avaliacao).where(Avaliacao.id == av_id, Avaliacao.medico_nome == nome)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Avaliação não encontrada")
    return _build_item(row)


async def _regenerar_csv(db: AsyncSession):
    """Regenera avaliacoes_medicas.csv no servidor após cada avaliação salva."""
    result = await db.execute(select(Avaliacao).order_by(Avaliacao.medico_nome, Avaliacao.rotulo, Avaliacao.id))
    rows = result.scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "id", "medico_nome", "image_name", "rotulo", "confianca_modelo", "cam_mean",
        "cam_pct_above_050", "tem_reflexo_luz",
        "concordancia", "ativacao_na_lesao", "observacao", "avaliado_em",
    ])
    for r in rows:
        writer.writerow([
            r.id, r.medico_nome, r.image_name, r.rotulo,
            r.confianca_modelo, r.cam_mean, r.cam_pct_above_050,
            r.tem_reflexo_luz,
            r.concordancia, r.ativacao_na_lesao, r.observacao, r.avaliado_em,
        ])

    csv_path = EXPORTS_DIR / "avaliacoes_medicas.csv"
    csv_path.write_text(buf.getvalue(), encoding="utf-8-sig")


@app.post("/api/avaliacoes/{av_id}", response_model=AvaliacaoItem)
async def salvar_avaliacao(
    av_id: int,
    payload: AvaliacaoSubmit,
    background_tasks: BackgroundTasks,
    medico: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    nome = _require_medico(medico)
    result = await db.execute(
        select(Avaliacao).where(Avaliacao.id == av_id, Avaliacao.medico_nome == nome)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Avaliação não encontrada")

    row.concordancia      = payload.concordancia
    row.ativacao_na_lesao = payload.ativacao_na_lesao
    row.observacao        = payload.observacao
    row.avaliado          = True
    row.avaliado_em       = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    background_tasks.add_task(_regenerar_csv, db)
    return _build_item(row)


@app.get("/api/progresso", response_model=Progresso)
async def progresso(
    medico: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    nome = _require_medico(medico)
    await _seed_medico(db, nome)

    total = await db.scalar(
        select(func.count()).select_from(Avaliacao).where(Avaliacao.medico_nome == nome)
    )
    avaliados = await db.scalar(
        select(func.count()).select_from(Avaliacao)
        .where(Avaliacao.medico_nome == nome, Avaliacao.avaliado == True)
    )
    total     = total or 0
    avaliados = avaliados or 0

    result = await db.execute(
        select(
            Avaliacao.rotulo,
            func.count().label("total"),
            func.sum(case((Avaliacao.avaliado == True, 1), else_=0)).label("avaliados"),
            func.avg(case((Avaliacao.avaliado == True, Avaliacao.concordancia), else_=None)).label("media_concordancia"),
        )
        .where(Avaliacao.medico_nome == nome)
        .group_by(Avaliacao.rotulo)
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


@app.get("/api/medicos")
async def listar_medicos(db: AsyncSession = Depends(get_db)):
    """Retorna os nomes de todos os médicos que já avaliaram pelo menos uma imagem."""
    result = await db.execute(
        select(Avaliacao.medico_nome)
        .where(Avaliacao.avaliado == True)
        .distinct()
        .order_by(Avaliacao.medico_nome)
    )
    return {"medicos": [r[0] for r in result.all()]}


@app.get("/api/imagem/{filename}")
async def servir_imagem(filename: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(ImagemCache, filename)
    if row:
        return Response(
            content=row.dados,
            media_type=row.content_type,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    path = IMAGES_DIR / filename
    if path.exists():
        return FileResponse(path, headers={"Cache-Control": "public, max-age=31536000, immutable"})
    raise HTTPException(404, f"Imagem não encontrada: {filename}")


@app.get("/api/exportar")
async def exportar_csv(db: AsyncSession = Depends(get_db)):
    """Serve o CSV gerado automaticamente pelo servidor."""
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
_static_dir = Path(__file__).parent.parent / "static"
if _static_dir.exists():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(_static_dir / "index.html")
