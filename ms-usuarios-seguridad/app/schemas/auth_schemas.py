from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

RolDBHeader = Literal["rol_admin", "rol_operador"]


def _validar_texto_no_vacio(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = valor.strip()
    if not limpio:
        raise ValueError("El campo no puede estar vacío ni contener solo espacios.")
    return limpio


class UsuarioCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, examples=["Laura Gómez"])
    email: EmailStr = Field(..., examples=["laura.gomez@empresa.edu"])
    password: str = Field(..., min_length=6, max_length=100, examples=["clave123"])
    rol: RolDBHeader = Field(default="rol_operador", examples=["rol_operador"])

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        limpio = _validar_texto_no_vacio(v)
        if len(limpio) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres.")
        return limpio


class UsuarioUpdateRequest(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100, examples=["Laura Gómez Ruiz"])
    rol: RolDBHeader | None = Field(default=None, examples=["rol_admin"])
    activo: bool | None = Field(default=None, examples=[True])

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        limpio = _validar_texto_no_vacio(v)
        if limpio is not None and len(limpio) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres.")
        return limpio


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=["admin@empresa.edu"])
    password: str = Field(..., min_length=4, examples=["admin123"])


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    creado_en: datetime


class AuditoriaResponse(BaseModel):
    id: int
    tabla_afectada: str
    operacion: str
    usuario_db: str
    detalle: str
    fecha_evento: datetime


class AuditoriaResumenResponse(BaseModel):
    tabla_afectada: str
    operacion: str
    total_eventos: int
    ultimo_evento: datetime
