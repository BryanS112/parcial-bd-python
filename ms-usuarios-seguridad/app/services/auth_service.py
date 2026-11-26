import hashlib
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from fastapi import HTTPException, status

from app.core.database import get_db_connection


def _hash_password(password: str) -> str:
    """Genera el hash SHA-256 compatible con el formato inicializado en PostgreSQL."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@contextmanager
def _db_cursor(rol_db: str) -> Iterator[psycopg.Cursor]:
    """Gestiona conexión, cursor y traducción uniforme de errores de PostgreSQL."""
    try:
        with get_db_connection(rol_db) as conn:
            with conn.cursor() as cur:
                yield cur
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except psycopg.errors.InsufficientPrivilege as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permiso denegado en PostgreSQL para el rol '{rol_db}': {exc}",
        ) from exc
    except psycopg.errors.UniqueViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con el mismo email.",
        )
    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el usuario porque tiene pedidos asociados.",
        )
    except psycopg.errors.CheckViolation as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El valor enviado incumple una restricción CHECK: {exc}",
        ) from exc
    except psycopg.errors.DataError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de dato inválido para PostgreSQL: {exc}",
        ) from exc
    except psycopg.OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No fue posible conectar con PostgreSQL: {exc}",
        ) from exc
    except psycopg.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error ejecutando consulta en PostgreSQL: {exc}",
        ) from exc


def listar_usuarios_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Lista los usuarios registrados en el sistema."""
    query = """
        SELECT id, nombre, email, rol, activo, creado_en
          FROM usuarios
         ORDER BY id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def obtener_usuario_service(usuario_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Obtiene el detalle de un usuario por su ID."""
    query = """
        SELECT id, nombre, email, rol, activo, creado_en
          FROM usuarios
         WHERE id = %s;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (usuario_id,))
        usuario = cur.fetchone()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id={usuario_id} no encontrado.",
        )
    return usuario


def crear_usuario_service(
    nombre: str,
    email: str,
    password: str,
    rol_usuario: str,
    rol_db: str = "rol_admin",
) -> dict[str, Any]:
    """Registra un nuevo usuario en la tabla usuarios."""
    password_hash = _hash_password(password)
    query = """
        INSERT INTO usuarios (nombre, email, password_hash, rol)
        VALUES (%s, %s, %s, %s)
        RETURNING id, nombre, email, rol, activo, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (nombre, email, password_hash, rol_usuario))
        return cur.fetchone()


def actualizar_usuario_service(
    usuario_id: int,
    nombre: str | None,
    rol: str | None,
    activo: bool | None,
    rol_db: str = "rol_admin",
) -> dict[str, Any]:
    """Actualiza nombre, rol o estado activo de un usuario existente."""
    if nombre is None and rol is None and activo is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes enviar al menos un campo para actualizar (nombre, rol o activo).",
        )

    query = """
        UPDATE usuarios
           SET nombre = COALESCE(%s, nombre),
               rol = COALESCE(%s, rol),
               activo = COALESCE(%s, activo)
         WHERE id = %s
        RETURNING id, nombre, email, rol, activo, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (nombre, rol, activo, usuario_id))
        usuario = cur.fetchone()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id={usuario_id} no encontrado.",
        )
    return usuario


def autenticar_usuario_service(email: str, password: str) -> dict[str, Any]:
    """Valida credenciales de acceso contra la tabla usuarios."""
    password_hash = _hash_password(password)
    query = """
        SELECT id, nombre, email, rol, activo
          FROM usuarios
         WHERE email = %s
           AND password_hash = %s;
    """
    with _db_cursor("rol_operador") as cur:
        cur.execute(query, (email, password_hash))
        usuario = cur.fetchone()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas.",
        )

    if not usuario["activo"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario se encuentra inactivo.",
        )

    return {
        "mensaje": "Autenticación exitosa",
        "usuario": usuario,
    }


def consultar_auditoria_service(
    tabla_afectada: str | None = None,
    operacion: str | None = None,
    limite: int = 50,
    rol_db: str = "rol_admin",
) -> list[dict[str, Any]]:
    """Consulta la tabla auditoria_logs con filtros opcionales (restringida a rol_admin)."""
    tabla_filtro = tabla_afectada.strip().lower() if tabla_afectada else None
    operacion_filtro = operacion.strip().upper() if operacion else None

    query = """
        SELECT id, tabla_afectada, operacion, usuario_db, detalle, fecha_evento
          FROM auditoria_logs
         WHERE (%s::VARCHAR IS NULL OR LOWER(tabla_afectada) = %s)
           AND (%s::VARCHAR IS NULL OR UPPER(operacion) = %s)
         ORDER BY fecha_evento DESC, id DESC
         LIMIT %s;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (tabla_filtro, tabla_filtro, operacion_filtro, operacion_filtro, limite))
        return cur.fetchall()


def resumen_auditoria_service(rol_db: str = "rol_admin") -> list[dict[str, Any]]:
    """Agrupa eventos de auditoria_logs por tabla y tipo de operación."""
    query = """
        SELECT tabla_afectada,
               operacion,
               COUNT(*)::INTEGER AS total_eventos,
               MAX(fecha_evento) AS ultimo_evento
          FROM auditoria_logs
         GROUP BY tabla_afectada, operacion
         ORDER BY tabla_afectada ASC, operacion ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def eliminar_usuario_service(
    usuario_id: int,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Elimina un usuario por ID (rol_operador recibe 403 por REVOKE DELETE)."""
    query = """
        DELETE FROM usuarios
         WHERE id = %s
        RETURNING id, email;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (usuario_id,))
        eliminado = cur.fetchone()

    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id={usuario_id} no encontrado.",
        )

    return {
        "mensaje": f"Usuario {eliminado['email']} eliminado correctamente.",
        "id": eliminado["id"],
    }
