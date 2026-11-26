from datetime import datetime

from fastapi import APIRouter, Header, Query

from app.schemas.operaciones_schemas import (
    CategoriaCreateRequest,
    CategoriaResponse,
    CategoriaUpdateRequest,
    ClienteCreateRequest,
    ClienteResponse,
    ClienteUpdateRequest,
    DescuentoRequest,
    DescuentoResponse,
    EstadoStock,
    PedidoCancelarResponse,
    PedidoCreateRequest,
    PedidoCreateResponse,
    PedidoDetalleResponse,
    PedidoLoteCreateRequest,
    PedidoLoteResponse,
    PedidoResumenResponse,
    ProductoCreateRequest,
    ProductoResponse,
    ProductoUpdateRequest,
    PromedioPonderadoResponse,
    ReporteVentaResponse,
    RolDBHeader,
    VistaResumenPedidoResponse,
    VistaResumenUsuarioResponse,
    VistaVentasProductoResponse,
)
from app.services.operaciones_service import (
    actualizar_categoria_service,
    actualizar_cliente_service,
    actualizar_producto_service,
    calcular_descuento_service,
    cancelar_pedido_service,
    crear_categoria_service,
    crear_cliente_service,
    crear_producto_service,
    eliminar_categoria_service,
    eliminar_cliente_service,
    eliminar_pedido_service,
    eliminar_producto_service,
    listar_categorias_service,
    listar_clientes_service,
    listar_pedidos_service,
    listar_productos_service,
    obtener_categoria_service,
    obtener_cliente_service,
    obtener_pedido_detalle_service,
    obtener_producto_service,
    obtener_promedio_ponderado_service,
    obtener_reporte_ventas_service,
    registrar_pedido_lote_service,
    registrar_pedido_service,
    reporte_vista_pedidos_service,
    reporte_vista_productos_service,
    reporte_vista_usuarios_service,
)

router = APIRouter(prefix="/api/v1")


# PRODUCTOS

@router.get(
    "/productos",
    response_model=list[ProductoResponse],
    tags=["Productos"],
    summary="Listar productos e inventario",
)
def listar_productos(
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Rol de PostgreSQL utilizado para consultar productos.",
    ),
):
    return listar_productos_service(rol_db=x_db_role)


@router.get(
    "/productos/{producto_id}",
    response_model=ProductoResponse,
    tags=["Productos"],
    summary="Obtener producto por ID",
)
def obtener_producto(
    producto_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_producto_service(producto_id=producto_id, rol_db=x_db_role)


@router.post(
    "/productos",
    response_model=ProductoResponse,
    status_code=201,
    tags=["Productos"],
    summary="Crear nuevo producto",
)
def crear_producto(
    payload: ProductoCreateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return crear_producto_service(
        codigo=payload.codigo,
        nombre=payload.nombre,
        precio_unitario=payload.precio_unitario,
        stock=payload.stock,
        categoria_id=payload.categoria_id,
        rol_db=x_db_role,
    )


@router.put(
    "/productos/{producto_id}",
    response_model=ProductoResponse,
    tags=["Productos"],
    summary="Actualizar producto existente",
)
def actualizar_producto(
    producto_id: int,
    payload: ProductoUpdateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return actualizar_producto_service(
        producto_id=producto_id,
        codigo=payload.codigo,
        nombre=payload.nombre,
        precio_unitario=payload.precio_unitario,
        stock=payload.stock,
        categoria_id=payload.categoria_id,
        rol_db=x_db_role,
    )


@router.delete(
    "/productos/{producto_id}",
    tags=["Productos"],
    summary="Eliminar producto por ID (bloqueado para rol_operador)",
)
def eliminar_producto(
    producto_id: int,
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Con 'rol_operador' devuelve 403 Forbidden; con 'rol_admin' permite eliminar.",
    ),
):
    return eliminar_producto_service(producto_id=producto_id, rol_db=x_db_role)


# CATEGORÍAS

@router.get(
    "/categorias",
    response_model=list[CategoriaResponse],
    tags=["Categorías"],
    summary="Listar categorías",
)
def listar_categorias(
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return listar_categorias_service(rol_db=x_db_role)


@router.get(
    "/categorias/{categoria_id}",
    response_model=CategoriaResponse,
    tags=["Categorías"],
    summary="Obtener categoría por ID",
)
def obtener_categoria(
    categoria_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_categoria_service(categoria_id=categoria_id, rol_db=x_db_role)


@router.post(
    "/categorias",
    response_model=CategoriaResponse,
    status_code=201,
    tags=["Categorías"],
    summary="Crear categoría (solo rol_admin)",
)
def crear_categoria(
    payload: CategoriaCreateRequest,
    x_db_role: RolDBHeader = Header(
        default="rol_admin",
        description="Con 'rol_operador' devuelve 403 Forbidden.",
    ),
):
    return crear_categoria_service(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        activo=payload.activo,
        rol_db=x_db_role,
    )


@router.put(
    "/categorias/{categoria_id}",
    response_model=CategoriaResponse,
    tags=["Categorías"],
    summary="Actualizar categoría (solo rol_admin)",
)
def actualizar_categoria(
    categoria_id: int,
    payload: CategoriaUpdateRequest,
    x_db_role: RolDBHeader = Header(default="rol_admin"),
):
    return actualizar_categoria_service(
        categoria_id=categoria_id,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        activo=payload.activo,
        rol_db=x_db_role,
    )


@router.delete(
    "/categorias/{categoria_id}",
    tags=["Categorías"],
    summary="Eliminar categoría por ID (bloqueado para rol_operador)",
)
def eliminar_categoria(
    categoria_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return eliminar_categoria_service(categoria_id=categoria_id, rol_db=x_db_role)


# CLIENTES

@router.get(
    "/clientes",
    response_model=list[ClienteResponse],
    tags=["Clientes"],
    summary="Listar clientes",
)
def listar_clientes(
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return listar_clientes_service(rol_db=x_db_role)


@router.get(
    "/clientes/{cliente_id}",
    response_model=ClienteResponse,
    tags=["Clientes"],
    summary="Obtener cliente por ID",
)
def obtener_cliente(
    cliente_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_cliente_service(cliente_id=cliente_id, rol_db=x_db_role)


@router.post(
    "/clientes",
    response_model=ClienteResponse,
    status_code=201,
    tags=["Clientes"],
    summary="Registrar nuevo cliente (NATURAL o JURIDICA)",
)
def crear_cliente(
    payload: ClienteCreateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return crear_cliente_service(
        tipo_cliente=payload.tipo_cliente,
        documento=payload.documento,
        nombre_razon_social=payload.nombre_razon_social,
        email=payload.email,
        telefono=payload.telefono,
        rol_db=x_db_role,
    )


@router.put(
    "/clientes/{cliente_id}",
    response_model=ClienteResponse,
    tags=["Clientes"],
    summary="Actualizar datos de un cliente",
)
def actualizar_cliente(
    cliente_id: int,
    payload: ClienteUpdateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return actualizar_cliente_service(
        cliente_id=cliente_id,
        tipo_cliente=payload.tipo_cliente,
        documento=payload.documento,
        nombre_razon_social=payload.nombre_razon_social,
        email=payload.email,
        telefono=payload.telefono,
        rol_db=x_db_role,
    )


@router.delete(
    "/clientes/{cliente_id}",
    tags=["Clientes"],
    summary="Eliminar cliente por ID (bloqueado para rol_operador)",
)
def eliminar_cliente(
    cliente_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return eliminar_cliente_service(cliente_id=cliente_id, rol_db=x_db_role)


# PEDIDOS, DESCUENTOS Y TRANSACCIONES

@router.post(
    "/descuentos/calcular",
    response_model=DescuentoResponse,
    tags=["Pedidos y Transacciones"],
    summary="Calcular descuento (fn_calcular_descuento)",
)
def calcular_descuento(
    payload: DescuentoRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return calcular_descuento_service(
        subtotal=payload.subtotal,
        cantidad=payload.cantidad,
        rol_db=x_db_role,
    )


@router.get(
    "/pedidos",
    response_model=list[PedidoResumenResponse],
    tags=["Pedidos y Transacciones"],
    summary="Listar pedidos",
)
def listar_pedidos(
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return listar_pedidos_service(rol_db=x_db_role)


@router.get(
    "/pedidos/{pedido_id}",
    response_model=PedidoDetalleResponse,
    tags=["Pedidos y Transacciones"],
    summary="Obtener pedido con sus líneas de detalle",
)
def obtener_pedido(
    pedido_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_pedido_detalle_service(pedido_id=pedido_id, rol_db=x_db_role)


@router.post(
    "/pedidos",
    response_model=PedidoCreateResponse,
    status_code=201,
    tags=["Pedidos y Transacciones"],
    summary="Registrar pedido simple (CALL proc_registrar_pedido)",
)
def registrar_pedido(
    payload: PedidoCreateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return registrar_pedido_service(
        usuario_id=payload.usuario_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        rol_db=x_db_role,
    )


@router.post(
    "/pedidos/lote",
    response_model=PedidoLoteResponse,
    status_code=201,
    tags=["Pedidos y Transacciones"],
    summary="Registrar pedido multi-producto con transacción explícita (BEGIN/COMMIT/ROLLBACK)",
)
def registrar_pedido_lote(
    payload: PedidoLoteCreateRequest,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return registrar_pedido_lote_service(
        usuario_id=payload.usuario_id,
        cliente_id=payload.cliente_id,
        items=payload.items,
        rol_db=x_db_role,
    )


@router.patch(
    "/pedidos/{pedido_id}/cancelar",
    response_model=PedidoCancelarResponse,
    tags=["Pedidos y Transacciones"],
    summary="Cancelar pedido y reponer stock (CALL proc_cancelar_pedido)",
)
def cancelar_pedido(
    pedido_id: int,
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return cancelar_pedido_service(pedido_id=pedido_id, rol_db=x_db_role)


@router.delete(
    "/pedidos/{pedido_id}",
    tags=["Pedidos y Transacciones"],
    summary="Eliminar pedido por ID (bloqueado para rol_operador)",
)
def eliminar_pedido(
    pedido_id: int,
    x_db_role: RolDBHeader = Header(
        default="rol_operador",
        description="Con 'rol_operador' devuelve 403 Forbidden; con 'rol_admin' permite eliminar.",
    ),
):
    return eliminar_pedido_service(pedido_id=pedido_id, rol_db=x_db_role)


# REPORTES (FUNCIONES PL/pgSQL Y VISTAS)

@router.get(
    "/reportes/ventas",
    response_model=list[ReporteVentaResponse],
    tags=["Reportes"],
    summary="Obtener reporte de ventas (fn_reporte_ventas)",
)
def reporte_ventas(
    fecha_inicio: datetime | None = Query(
        default=None,
        description="Fecha/hora inicial opcional en formato ISO-8601 (ej. 2026-01-01T00:00:00).",
    ),
    fecha_fin: datetime | None = Query(
        default=None,
        description="Fecha/hora final opcional en formato ISO-8601.",
    ),
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_reporte_ventas_service(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        rol_db=x_db_role,
    )


@router.get(
    "/reportes/promedio-ponderado",
    response_model=PromedioPonderadoResponse,
    tags=["Reportes"],
    summary="Obtener promedio ponderado del inventario (fn_promedio_ponderado)",
)
def promedio_ponderado(
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return obtener_promedio_ponderado_service(rol_db=x_db_role)


@router.get(
    "/reportes/vistas/pedidos",
    response_model=list[VistaResumenPedidoResponse],
    tags=["Reportes"],
    summary="Reporte consolidado de pedidos desde vista vw_resumen_pedidos",
)
def reporte_vista_pedidos(
    estado: str | None = Query(
        default=None,
        description="Filtro opcional por estado (CONFIRMADO, CANCELADO).",
    ),
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return reporte_vista_pedidos_service(estado=estado, rol_db=x_db_role)


@router.get(
    "/reportes/vistas/productos",
    response_model=list[VistaVentasProductoResponse],
    tags=["Reportes"],
    summary="Reporte de ventas y alerta de stock desde vista vw_ventas_por_producto",
)
def reporte_vista_productos(
    estado_stock: EstadoStock | None = Query(
        default=None,
        description="Filtro opcional por alerta de stock (AGOTADO, STOCK_BAJO, DISPONIBLE).",
    ),
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return reporte_vista_productos_service(estado_stock=estado_stock, rol_db=x_db_role)


@router.get(
    "/reportes/vistas/usuarios",
    response_model=list[VistaResumenUsuarioResponse],
    tags=["Reportes"],
    summary="Reporte de operaciones por usuario desde vista vw_resumen_por_usuario",
)
def reporte_vista_usuarios(
    x_db_role: RolDBHeader = Header(default="rol_operador"),
):
    return reporte_vista_usuarios_service(rol_db=x_db_role)
