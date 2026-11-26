import os
from pathlib import Path
from typing import Literal

import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row

RolDB = Literal["rol_admin", "rol_operador"]
VALID_ROLES: frozenset[str] = frozenset({"rol_admin", "rol_operador"})

ROOT_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(ROOT_ENV_PATH)
load_dotenv()


def get_db_connection(rol: str = "rol_operador") -> psycopg.Connection:
    """Abre una conexión a PostgreSQL con sslmode configurable y aplica SET ROLE."""
    if rol not in VALID_ROLES:
        raise ValueError(f"Rol de base de datos no válido: {rol}")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "La variable de entorno DATABASE_URL no está configurada en .env."
        )

    sslmode = os.getenv("DB_SSLMODE", "require")
    conn = psycopg.connect(
        database_url,
        sslmode=sslmode,
        row_factory=dict_row,
    )
    try:
        conn.execute(sql.SQL("SET ROLE {}").format(sql.Identifier(rol)))
        conn.commit()
    except Exception:
        conn.close()
        raise

    return conn
