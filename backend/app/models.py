from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Avaliacao(Base):
    __tablename__ = "avaliacoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Identificação da imagem
    image_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rotulo: Mapped[str] = mapped_column(String(32), nullable=False)

    # Dados do modelo (vindos do metadata.json)
    confianca_modelo: Mapped[float] = mapped_column(Float, nullable=False)
    cam_mean: Mapped[float] = mapped_column(Float, nullable=True)
    cam_pct_above_050: Mapped[float] = mapped_column(Float, nullable=True)
    tem_reflexo_luz: Mapped[bool] = mapped_column(Boolean, default=False)
    interpretation: Mapped[str] = mapped_column(Text, nullable=True)

    # Avaliação da médica
    concordancia: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 1 = Região errada, 2 = Parcialmente correta, 3 = Correta

    ativacao_na_lesao: Mapped[str | None] = mapped_column(String(1), nullable=True)
    # "S" ou "N" — preenchido só para EROSÃO com LUZ

    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)

    avaliado: Mapped[bool] = mapped_column(Boolean, default=False)
    avaliado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
