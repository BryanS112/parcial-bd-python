import re
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, StrictInt, field_validator

RolDBHeader = Literal["rol_admin", "rol_operador"]
TipoCliente = Literal["NATURAL", "JURIDICA"]
EstadoStock = Literal["AGOTADO", "STOCK_BAJO", "DISPONIBLE"]

_DIGITS_6_15_RE = re.compile(r"^\d{6,15}$")
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _strip_non_empty(v: str | None, min_len: int = 1, label: str = "El campo") -> str | None:
    if v is None:
        return None
    limpio = v.strip()
    if len(limpio) < min_len:
        raise ValueError(f"{label} no puede estar vacío ni tener menos de {min_len} caracteres.")
    return limpio


def _validate_strict_decimal(v: object) -> object:
    if v is None:
        return None
    if isinstance(v, bool):
        raise ValueError("El valor numérico no puede ser booleano.")
    if isinstance(v, str):
        raise ValueError("El valor numérico debe enviarse como número, no como cadena de texto.")
    return v


# --- Categorías ---

class CategoriaCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, examples=["Almacenamiento SSD"])
    descripcion: str | None = Field(
        default=None,
        max_length=500,
        examples=["Unidades de estado sólido NVMe y discos externos"],
    )
    activo: bool = Field(default=True, examples=[True])

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        return _strip_non_empty(v, min_len=2, label="El nombre de la categoría")

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        return limpio or None


class CategoriaUpdateRequest(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=100)
    descripcion: str | None = Field(default=None, max_length=500)
    activo: bool | None = Field(default=None)

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, min_len=2, label="El nombre de la categoría")


class CategoriaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    activo: bool
    creado_en: datetime


# --- Productos ---

class ProductoCreateRequest(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=30, examples=["PROD-005"])
    nombre: str = Field(..., min_length=2, max_length=150, examples=["SSD NVMe 1TB PCIe 4.0"])
    precio_unitario: Decimal = Field(..., gt=0, examples=[390.00])
    stock: StrictInt = Field(default=0, ge=0, examples=[30])
    categoria_id: StrictInt | None = Field(default=None, gt=0, examples=[1])

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        return _strip_non_empty(v, min_len=2, label="El código")

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        return _strip_non_empty(v, min_len=2, label="El nombre")

    @field_validator("precio_unitario", mode="before")
    @classmethod
    def validar_precio(cls, v: object) -> object:
        return _validate_strict_decimal(v)


class ProductoUpdateRequest(BaseModel):
    codigo: str | None = Field(default=None, min_length=2, max_length=30)
    nombre: str | None = Field(default=None, min_length=2, max_length=150)
    precio_unitario: Decimal | None = Field(default=None, gt=0)
    stock: StrictInt | None = Field(default=None, ge=0)
    categoria_id: StrictInt | None = Field(default=None, gt=0)

    @field_validator("codigo")
    @classmethod
    def validar_codigo(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, min_len=2, label="El código")

    @field_validator("nombre")
    @classmethod
    def validar_nombre(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, min_len=2, label="El nombre")

    @field_validator("precio_unitario", mode="before")
    @classmethod
    def validar_precio(cls, v: object) -> object:
        return _validate_strict_decimal(v)


class ProductoResponse(BaseModel):
    id: int
    codigo: str
    nombre: str
    precio_unitario: Decimal
    stock: int
    categoria_id: int | None
    creado_en: datetime


# --- Clientes ---

class ClienteCreateRequest(BaseModel):
    tipo_cliente: TipoCliente = Field(..., examples=["NATURAL"])
    documento: str = Field(..., min_length=6, max_length=15, examples=["1020304050"])
    nombre_razon_social: str = Field(..., min_length=2, max_length=150, examples=["Andrés Felipe Torres"])
    email: str | None = Field(default=None, max_length=150, examples=["andres.torres@correo.co"])
    telefono: str | None = Field(default=None, max_length=15, examples=["3001112233"])

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, v: str) -> str:
        limpio = v.strip()
        if not _DIGITS_6_15_RE.match(limpio):
            raise ValueError("El documento debe contener únicamente entre 6 y 15 dígitos numéricos.")
        return limpio

    @field_validator("nombre_razon_social")
    @classmethod
    def validar_nombre_razon_social(cls, v: str) -> str:
        return _strip_non_empty(v, min_len=2, label="El nombre o razón social")

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        if not limpio:
            return None
        if not _EMAIL_RE.match(limpio):
            raise ValueError("El formato del correo electrónico no es válido.")
        return limpio

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        if not limpio:
            return None
        if not _DIGITS_6_15_RE.match(limpio):
            raise ValueError("El teléfono debe contener únicamente entre 6 y 15 dígitos numéricos.")
        return limpio


class ClienteUpdateRequest(BaseModel):
    tipo_cliente: TipoCliente | None = Field(default=None)
    documento: str | None = Field(default=None, min_length=6, max_length=15)
    nombre_razon_social: str | None = Field(default=None, min_length=2, max_length=150)
    email: str | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, max_length=15)

    @field_validator("documento")
    @classmethod
    def validar_documento(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        if not _DIGITS_6_15_RE.match(limpio):
            raise ValueError("El documento debe contener únicamente entre 6 y 15 dígitos numéricos.")
        return limpio

    @field_validator("nombre_razon_social")
    @classmethod
    def validar_nombre_razon_social(cls, v: str | None) -> str | None:
        return _strip_non_empty(v, min_len=2, label="El nombre o razón social")

    @field_validator("email")
    @classmethod
    def validar_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        if not limpio:
            return None
        if not _EMAIL_RE.match(limpio):
            raise ValueError("El formato del correo electrónico no es válido.")
        return limpio

    @field_validator("telefono")
    @classmethod
    def validar_telefono(cls, v: str | None) -> str | None:
        if v is None:
            return None
        limpio = v.strip()
        if not limpio:
            return None
        if not _DIGITS_6_15_RE.match(limpio):
            raise ValueError("El teléfono debe contener únicamente entre 6 y 15 dígitos numéricos.")
        return limpio


class ClienteResponse(BaseModel):
    id: int
    tipo_cliente: str
    documento: str
    nombre_razon_social: str
    email: str | None
    telefono: str | None
    creado_en: datetime


# --- Pedidos y Descuentos ---

class DescuentoRequest(BaseModel):
    subtotal: Decimal = Field(..., gt=0, examples=[3200.00])
    cantidad: StrictInt = Field(..., ge=1, examples=[10])

    @field_validator("subtotal", mode="before")
    @classmethod
    def validar_subtotal(cls, v: object) -> object:
        return _validate_strict_decimal(v)


class DescuentoResponse(BaseModel):
    subtotal: Decimal
    cantidad: int
    descuento: Decimal
    total_estimado: Decimal


class PedidoCreateRequest(BaseModel):
    usuario_id: StrictInt = Field(..., gt=0, examples=[2])
    producto_id: StrictInt = Field(..., gt=0, examples=[1])
    cantidad: StrictInt = Field(..., ge=1, examples=[2])


class PedidoCreateResponse(BaseModel):
    pedido_id: int | None
    mensaje: str


class PedidoLoteItemRequest(BaseModel):
    producto_id: StrictInt = Field(..., gt=0, examples=[1])
    cantidad: StrictInt = Field(..., ge=1, examples=[2])


class PedidoLoteCreateRequest(BaseModel):
    usuario_id: StrictInt = Field(..., gt=0, examples=[2])
    cliente_id: StrictInt | None = Field(default=None, gt=0, examples=[1])
    items: list[PedidoLoteItemRequest] = Field(..., min_length=1)


class DetallePedidoItemResponse(BaseModel):
    id: int
    producto_id: int
    producto_codigo: str
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal_linea: Decimal


class PedidoResumenResponse(BaseModel):
    id: int
    usuario_id: int
    producto_id: int
    cliente_id: int | None
    cantidad: int
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    estado: str
    fecha_pedido: datetime


class PedidoDetalleResponse(PedidoResumenResponse):
    detalles: list[DetallePedidoItemResponse]


class PedidoLoteResponse(BaseModel):
    pedido_id: int
    usuario_id: int
    cliente_id: int | None
    cantidad_total: int
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    estado: str
    fecha_pedido: datetime
    items_procesados: int
    mensaje: str


class PedidoCancelarResponse(BaseModel):
    pedido_id: int
    mensaje: str


# --- Reportes (Funciones PL/pgSQL y Vistas) ---

class ReporteVentaResponse(BaseModel):
    pedido_id: int
    cliente_nombre: str
    producto_codigo: str
    producto_nombre: str
    cantidad: int
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    estado: str
    fecha_pedido: datetime


class PromedioPonderadoResponse(BaseModel):
    promedio_ponderado_inventario: Decimal
    unidades_totales_stock: int


class VistaResumenPedidoResponse(BaseModel):
    pedido_id: int
    fecha_pedido: datetime
    estado: str
    usuario_id: int
    usuario_nombre: str
    usuario_email: str
    cliente_id: int | None
    cliente_documento: str | None
    cliente_nombre: str
    producto_id: int
    producto_codigo: str
    producto_nombre: str
    categoria_nombre: str
    cantidad: int
    subtotal: Decimal
    descuento: Decimal
    total: Decimal


class VistaVentasProductoResponse(BaseModel):
    producto_id: int
    codigo: str
    producto_nombre: str
    categoria_nombre: str
    precio_unitario: Decimal
    stock_actual: int
    estado_stock: str
    total_pedidos: int
    unidades_vendidas: int
    ingresos_totales: Decimal


class VistaResumenUsuarioResponse(BaseModel):
    usuario_id: int
    usuario_nombre: str
    email: str
    rol: str
    activo: bool
    total_operaciones: int
    pedidos_activos: int
    pedidos_cancelados: int
    importe_acumulado: Decimal
