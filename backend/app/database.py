import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# Converte postgres:// → postgresql+asyncpg:// e remove sslmode da URL
# (asyncpg não aceita sslmode como query param — usa connect_args)
_raw = os.getenv("DATABASE_URL", "")
_url = _raw.replace("postgres://", "postgresql+asyncpg://", 1)

# Extrai sslmode antes de passar para o engine
_ssl = False
if "sslmode=disable" in _url:
    DATABASE_URL = _url.replace("?sslmode=disable", "").replace("&sslmode=disable", "")
    _ssl = False
elif "sslmode=require" in _url:
    DATABASE_URL = _url.replace("?sslmode=require", "").replace("&sslmode=require", "")
    _ssl = True
else:
    DATABASE_URL = _url

# Schema isolado — não polui o schema public do banco compartilhado
DB_SCHEMA = os.getenv("DB_SCHEMA", "validacao_medica")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"ssl": _ssl},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = __import__("sqlalchemy").MetaData(schema=DB_SCHEMA)


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))
        await conn.run_sync(Base.metadata.create_all)
        # Migração: adiciona medico_nome se a tabela já existia sem ela
        await conn.execute(text(
            f'ALTER TABLE "{DB_SCHEMA}".avaliacoes '
            f'ADD COLUMN IF NOT EXISTS medico_nome VARCHAR(128) NOT NULL DEFAULT \'\''
        ))
        await conn.execute(text(
            f'CREATE INDEX IF NOT EXISTS ix_avaliacoes_medico_nome '
            f'ON "{DB_SCHEMA}".avaliacoes (medico_nome)'
        ))
