from pydantic import BaseModel, Field
from datetime import datetime


class AvaliacaoItem(BaseModel):
    id: int
    image_name: str
    rotulo: str
    medico_nome: str
    confianca_modelo: float
    cam_mean: float | None
    cam_pct_above_050: float | None
    tem_reflexo_luz: bool
    interpretation: str | None
    concordancia: int | None
    ativacao_na_lesao: str | None
    observacao: str | None
    avaliado: bool
    avaliado_em: datetime | None
    overlay_path: str | None = None
    original_path: str | None = None

    class Config:
        from_attributes = True


class AvaliacaoSubmit(BaseModel):
    concordancia: int = Field(..., ge=1, le=3)
    ativacao_na_lesao: str | None = Field(None, pattern="^[SN]$")
    observacao: str | None = None


class Progresso(BaseModel):
    total: int
    avaliados: int
    pendentes: int
    pct_completo: float
    por_classe: dict[str, dict]
