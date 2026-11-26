from fastapi import APIRouter, Header, Query

from app.schemas.auth_schemas import (
    AuditoriaResponse,
    AuditoriaResumenResponse,
    LoginRequest,
    RolDBHeader,
    UsuarioCreateRequest,
    UsuarioResponse,
    UsuarioUpdateRequest,
)
from app.services.auth_service import (
    actualizar_usuario_service,
    autenticar_usuario_service,
    consultar_auditoria_service,
    crear_usuario_service,
    eliminar_usuario_service,
    listar_usuarios_service,
    obtener_usuario_service,
    resumen_auditoria_service,
)

router = APIRouter(prefix="/api/v1")


@router.get(
    "/usuarios",
    response_model=list[UsuarioResponse],
    tags=["Usuarios y Seguridad"],
    summary="Listar usuarios",
)
def listar_usuarios(
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Rol de PostgreSQL utilizado para ejecutar la consulta.",
    ),
):
    return listar_usuarios_service(rol_db=x_db_role)


@router.get(
    "/usuarios/{usuario_id}",
    response_model=UsuarioResponse,
    tags=["Usuarios y Seguridad"],
    summary="Obtener usuario por ID",
)
def obtener_usuario(
    usuario_id: int,
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Rol de PostgreSQL utilizado para consultar el usuario.",
    ),
):
    return obtener_usuario_service(usuario_id=usuario_id, rol_db=x_db_role)


@router.post(
    "/usuarios",
    response_model=UsuarioResponse,
    status_code=201,
    tags=["Usuarios y Seguridad"],
    summary="Registrar nuevo usuario",
)
def crear_usuario(
    payload: UsuarioCreateRequest,
    x_db_role: RolDBHeader = Header(
        default="rol_admin",
        description="Rol de PostgreSQL utilizado para insertar el usuario.",
    ),
):
    return crear_usuario_service(
        nombre=payload.nombre,
        email=payload.email,
        password=payload.password,
        rol_usuario=payload.rol,
        rol_db=x_db_role,
    )


@router.put(
    "/usuarios/{usuario_id}",
    response_model=UsuarioResponse,
    tags=["Usuarios y Seguridad"],
    summary="Actualizar nombre, rol o estado activo de un usuario",
)
def actualizar_usuario(
    usuario_id: int,
    payload: UsuarioUpdateRequest,
    x_db_role: RolDBHeader = Header(
        default="rol_admin",
        description="Con 'rol_operador' devuelve 403 Forbidden; con 'rol_admin' actualiza.",
    ),
):
    return actualizar_usuario_service(
        usuario_id=usuario_id,
        nombre=payload.nombre,
        rol=payload.rol,
        activo=payload.activo,
        rol_db=x_db_role,
    )


@router.post(
    "/auth/login",
    tags=["Usuarios y Seguridad"],
    summary="Autenticar usuario",
)
def login(payload: LoginRequest):
    return autenticar_usuario_service(
        email=payload.email,
        password=payload.password,
    )


@router.delete(
    "/usuarios/{usuario_id}",
    tags=["Usuarios y Seguridad"],
    summary="Eliminar usuario por ID (bloqueado para rol_operador)",
)
def eliminar_usuario(
    usuario_id: int,
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Con 'rol_operador' devuelve 403 Forbidden; con 'rol_admin' permite eliminar.",
    ),
):
    return eliminar_usuario_service(usuario_id=usuario_id, rol_db=x_db_role)


@router.get(
    "/auditoria",
    response_model=list[AuditoriaResponse],
    tags=["Auditoría"],
    summary="Consultar logs de auditoría con filtros opcionales (solo rol_admin)",
)
def listar_auditoria(
    tabla_afectada: str | None = Query(
        default=None,
        description="Filtra por nombre de tabla (ej. pedidos, productos, usuarios).",
    ),
    operacion: str | None = Query(
        default=None,
        description="Filtra por tipo de operación (INSERT, UPDATE, DELETE, INIT).",
    ),
    limite: int = Query(default=50, ge=1, le=500),
    x_db_role: RolDBHeader = Header(
        default="rol_admin",
        description="Cambia a 'rol_operador' para verificar la respuesta 403 Forbidden.",
    ),
):
    return consultar_auditoria_service(
        tabla_afectada=tabla_afectada,
        operacion=operacion,
        limite=limite,
        rol_db=x_db_role,
    )


@router.get(
    "/auditoria/resumen",
    response_model=list[AuditoriaResumenResponse],
    tags=["Auditoría"],
    summary="Resumen de auditoría agrupado por tabla y operación (solo rol_admin)",
)
def resumen_auditoria(
    x_db_role: RolDBHeader = Header(
        default="rol_admin",
        description="Cambia a 'rol_operador' para verificar la respuesta 403 Forbidden.",
    ),
):
    return resumen_auditoria_service(rol_db=x_db_role)
