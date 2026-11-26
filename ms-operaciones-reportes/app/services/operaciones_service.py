from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterator

import psycopg
from fastapi import HTTPException, status

from app.core.database import get_db_connection
from app.schemas.operaciones_schemas import PedidoLoteItemRequest


def _traducir_error_pg(exc: Exception, rol_db: str) -> HTTPException:
    """Traduce excepciones de PostgreSQL y de negocio a HTTPException consistentes."""
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    if isinstance(exc, psycopg.errors.InsufficientPrivilege):
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permiso denegado en PostgreSQL para el rol '{rol_db}': {exc}",
        )
    if isinstance(exc, psycopg.errors.UniqueViolation):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un registro con el mismo valor único.",
        )
    if isinstance(exc, psycopg.errors.ForeignKeyViolation):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Violación de integridad referencial: referencia inexistente o registro en uso.",
        )
    if isinstance(exc, psycopg.errors.CheckViolation):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El valor enviado incumple una restricción CHECK: {exc}",
        )
    if isinstance(exc, psycopg.errors.DataError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de dato inválido para PostgreSQL: {exc}",
        )
    if isinstance(exc, psycopg.errors.RaiseException):
        mensaje = exc.diag.message_primary or str(exc)
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=mensaje)
    if isinstance(exc, psycopg.OperationalError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No fue posible conectar con PostgreSQL: {exc}",
        )
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Error ejecutando operación en PostgreSQL: {exc}",
    )


@contextmanager
def _db_cursor(rol_db: str) -> Iterator[psycopg.Cursor]:
    """Gestiona conexión, cursor y traducción uniforme de errores de PostgreSQL."""
    try:
        with get_db_connection(rol_db) as conn:
            with conn.cursor() as cur:
                yield cur
    except (ValueError, RuntimeError, psycopg.Error) as exc:
        raise _traducir_error_pg(exc, rol_db) from exc


# CRUD PRODUCTOS

def listar_productos_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Lista el catálogo de productos y su stock actual."""
    query = """
        SELECT id, codigo, nombre, precio_unitario, stock, categoria_id, creado_en
          FROM productos
         ORDER BY id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def obtener_producto_service(producto_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Obtiene un producto por su ID."""
    query = """
        SELECT id, codigo, nombre, precio_unitario, stock, categoria_id, creado_en
          FROM productos
         WHERE id = %s;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (producto_id,))
        producto = cur.fetchone()

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id={producto_id} no encontrado.",
        )
    return producto


def crear_producto_service(
    codigo: str,
    nombre: str,
    precio_unitario: Decimal,
    stock: int,
    categoria_id: int | None,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Crea un nuevo producto en el inventario."""
    query = """
        INSERT INTO productos (codigo, nombre, precio_unitario, stock, categoria_id)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, codigo, nombre, precio_unitario, stock, categoria_id, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (codigo, nombre, precio_unitario, stock, categoria_id))
        return cur.fetchone()


def actualizar_producto_service(
    producto_id: int,
    codigo: str | None,
    nombre: str | None,
    precio_unitario: Decimal | None,
    stock: int | None,
    categoria_id: int | None,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Actualiza datos o stock de un producto existente."""
    if all(v is None for v in (codigo, nombre, precio_unitario, stock, categoria_id)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes enviar al menos un campo para actualizar el producto.",
        )

    query = """
        UPDATE productos
           SET codigo = COALESCE(%s, codigo),
               nombre = COALESCE(%s, nombre),
               precio_unitario = COALESCE(%s, precio_unitario),
               stock = COALESCE(%s, stock),
               categoria_id = COALESCE(%s, categoria_id)
         WHERE id = %s
        RETURNING id, codigo, nombre, precio_unitario, stock, categoria_id, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (codigo, nombre, precio_unitario, stock, categoria_id, producto_id))
        producto = cur.fetchone()

    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id={producto_id} no encontrado.",
        )
    return producto


def eliminar_producto_service(producto_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Elimina un producto por ID (bloqueado con 403 para rol_operador)."""
    query = """
        DELETE FROM productos
         WHERE id = %s
        RETURNING id, codigo;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (producto_id,))
        eliminado = cur.fetchone()

    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con id={producto_id} no encontrado.",
        )
    return {
        "mensaje": f"Producto {eliminado['codigo']} eliminado correctamente.",
        "id": eliminado["id"],
    }


# CRUD CATEGORÍAS

def listar_categorias_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Lista las categorías de productos."""
    query = """
        SELECT id, nombre, descripcion, activo, creado_en
          FROM categorias
         ORDER BY id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def obtener_categoria_service(categoria_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Obtiene una categoría por su ID."""
    query = """
        SELECT id, nombre, descripcion, activo, creado_en
          FROM categorias
         WHERE id = %s;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (categoria_id,))
        categoria = cur.fetchone()

    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoría con id={categoria_id} no encontrada.",
        )
    return categoria


def crear_categoria_service(
    nombre: str,
    descripcion: str | None,
    activo: bool,
    rol_db: str = "rol_admin",
) -> dict[str, Any]:
    """Crea una nueva categoría (requiere rol_admin)."""
    query = """
        INSERT INTO categorias (nombre, descripcion, activo)
        VALUES (%s, %s, %s)
        RETURNING id, nombre, descripcion, activo, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (nombre, descripcion, activo))
        return cur.fetchone()


def actualizar_categoria_service(
    categoria_id: int,
    nombre: str | None,
    descripcion: str | None,
    activo: bool | None,
    rol_db: str = "rol_admin",
) -> dict[str, Any]:
    """Actualiza una categoría existente (requiere rol_admin)."""
    if all(v is None for v in (nombre, descripcion, activo)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes enviar al menos un campo para actualizar la categoría.",
        )

    query = """
        UPDATE categorias
           SET nombre = COALESCE(%s, nombre),
               descripcion = COALESCE(%s, descripcion),
               activo = COALESCE(%s, activo)
         WHERE id = %s
        RETURNING id, nombre, descripcion, activo, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (nombre, descripcion, activo, categoria_id))
        categoria = cur.fetchone()

    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoría con id={categoria_id} no encontrada.",
        )
    return categoria


def eliminar_categoria_service(categoria_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Elimina una categoría por ID (bloqueado con 403 para rol_operador)."""
    query = """
        DELETE FROM categorias
         WHERE id = %s
        RETURNING id, nombre;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (categoria_id,))
        eliminado = cur.fetchone()

    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoría con id={categoria_id} no encontrada.",
        )
    return {
        "mensaje": f"Categoría '{eliminado['nombre']}' eliminada correctamente.",
        "id": eliminado["id"],
    }


# CRUD CLIENTES

def listar_clientes_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Lista los clientes registrados."""
    query = """
        SELECT id, tipo_cliente, documento, nombre_razon_social, email, telefono, creado_en
          FROM clientes
         ORDER BY id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def obtener_cliente_service(cliente_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Obtiene un cliente por su ID."""
    query = """
        SELECT id, tipo_cliente, documento, nombre_razon_social, email, telefono, creado_en
          FROM clientes
         WHERE id = %s;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (cliente_id,))
        cliente = cur.fetchone()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente con id={cliente_id} no encontrado.",
        )
    return cliente


def crear_cliente_service(
    tipo_cliente: str,
    documento: str,
    nombre_razon_social: str,
    email: str | None,
    telefono: str | None,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Registra un nuevo cliente (NATURAL o JURIDICA)."""
    query = """
        INSERT INTO clientes (tipo_cliente, documento, nombre_razon_social, email, telefono)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, tipo_cliente, documento, nombre_razon_social, email, telefono, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (tipo_cliente, documento, nombre_razon_social, email, telefono))
        return cur.fetchone()


def actualizar_cliente_service(
    cliente_id: int,
    tipo_cliente: str | None,
    documento: str | None,
    nombre_razon_social: str | None,
    email: str | None,
    telefono: str | None,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Actualiza los datos de un cliente existente."""
    if all(v is None for v in (tipo_cliente, documento, nombre_razon_social, email, telefono)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes enviar al menos un campo para actualizar el cliente.",
        )

    query = """
        UPDATE clientes
           SET tipo_cliente = COALESCE(%s, tipo_cliente),
               documento = COALESCE(%s, documento),
               nombre_razon_social = COALESCE(%s, nombre_razon_social),
               email = COALESCE(%s, email),
               telefono = COALESCE(%s, telefono)
         WHERE id = %s
        RETURNING id, tipo_cliente, documento, nombre_razon_social, email, telefono, creado_en;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(
            query,
            (tipo_cliente, documento, nombre_razon_social, email, telefono, cliente_id),
        )
        cliente = cur.fetchone()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente con id={cliente_id} no encontrado.",
        )
    return cliente


def eliminar_cliente_service(cliente_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Elimina un cliente por ID (bloqueado con 403 para rol_operador)."""
    query = """
        DELETE FROM clientes
         WHERE id = %s
        RETURNING id, documento;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (cliente_id,))
        eliminado = cur.fetchone()

    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cliente con id={cliente_id} no encontrado.",
        )
    return {
        "mensaje": f"Cliente {eliminado['documento']} eliminado correctamente.",
        "id": eliminado["id"],
    }


# PEDIDOS, PROCEDIMIENTOS Y TRANSACCIÓN EXPLÍCITA

def calcular_descuento_service(
    subtotal: Decimal,
    cantidad: int,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Invoca la función escalar PL/pgSQL fn_calcular_descuento."""
    query = "SELECT fn_calcular_descuento(%s, %s) AS descuento;"
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (subtotal, cantidad))
        fila = cur.fetchone()

    descuento = fila["descuento"] if fila and fila["descuento"] is not None else Decimal("0.00")
    return {
        "subtotal": subtotal,
        "cantidad": cantidad,
        "descuento": descuento,
        "total_estimado": subtotal - descuento,
    }


def listar_pedidos_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Lista los pedidos registrados en orden descendente."""
    query = """
        SELECT id, usuario_id, producto_id, cliente_id, cantidad,
               subtotal, descuento, total, estado, fecha_pedido
          FROM pedidos
         ORDER BY id DESC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()


def obtener_pedido_detalle_service(pedido_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Obtiene la cabecera de un pedido junto con sus líneas en detalle_pedidos."""
    query_cabecera = """
        SELECT id, usuario_id, producto_id, cliente_id, cantidad,
               subtotal, descuento, total, estado, fecha_pedido
          FROM pedidos
         WHERE id = %s;
    """
    query_detalles = """
        SELECT dp.id,
               dp.producto_id,
               pr.codigo AS producto_codigo,
               pr.nombre AS producto_nombre,
               dp.cantidad,
               dp.precio_unitario,
               dp.subtotal_linea
          FROM detalle_pedidos dp
          INNER JOIN productos pr ON pr.id = dp.producto_id
         WHERE dp.pedido_id = %s
         ORDER BY dp.id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query_cabecera, (pedido_id,))
        pedido = cur.fetchone()
        if not pedido:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pedido con id={pedido_id} no encontrado.",
            )
        cur.execute(query_detalles, (pedido_id,))
        detalles = cur.fetchall()

    pedido["detalles"] = detalles
    return pedido


def registrar_pedido_service(
    usuario_id: int,
    producto_id: int,
    cantidad: int,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Invoca el procedimiento almacenado PL/pgSQL proc_registrar_pedido."""
    query = "CALL proc_registrar_pedido(%s, %s, %s, NULL, NULL);"
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (usuario_id, producto_id, cantidad))
        resultado = cur.fetchone()

    return {
        "pedido_id": resultado["p_pedido_id"] if resultado else None,
        "mensaje": resultado["p_mensaje"] if resultado else "Pedido procesado.",
    }


def registrar_pedido_lote_service(
    usuario_id: int,
    cliente_id: int | None,
    items: list[PedidoLoteItemRequest],
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Registra un pedido multi-producto con control transaccional explícito BEGIN/COMMIT/ROLLBACK."""
    try:
        conn = get_db_connection(rol_db)
    except (ValueError, RuntimeError, psycopg.Error) as exc:
        raise _traducir_error_pg(exc, rol_db) from exc

    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN;")

            usuario = cur.execute(
                "SELECT id FROM usuarios WHERE id = %s AND activo = TRUE;",
                (usuario_id,),
            ).fetchone()
            if not usuario:
                raise ValueError(
                    f"El usuario {usuario_id} no existe o se encuentra inactivo."
                )

            if cliente_id is not None:
                cliente = cur.execute(
                    "SELECT id FROM clientes WHERE id = %s;",
                    (cliente_id,),
                ).fetchone()
                if not cliente:
                    raise ValueError(f"El cliente {cliente_id} no existe.")

            primer_producto = cur.execute(
                "SELECT id FROM productos WHERE id = %s;",
                (items[0].producto_id,),
            ).fetchone()
            if not primer_producto:
                raise ValueError(f"El producto {items[0].producto_id} no existe.")

            cabecera = cur.execute(
                """
                INSERT INTO pedidos (
                    usuario_id, producto_id, cliente_id, cantidad,
                    subtotal, descuento, total, estado
                )
                VALUES (%s, %s, %s, 1, 0.00, 0.00, 0.00, 'CONFIRMADO')
                RETURNING id, fecha_pedido, estado;
                """,
                (usuario_id, items[0].producto_id, cliente_id),
            ).fetchone()
            pedido_id = cabecera["id"]

            cantidad_total = 0
            subtotal_total = Decimal("0.00")

            for item in items:
                producto = cur.execute(
                    """
                    SELECT id, codigo, precio_unitario, stock
                      FROM productos
                     WHERE id = %s
                       FOR UPDATE;
                    """,
                    (item.producto_id,),
                ).fetchone()
                if not producto:
                    raise ValueError(f"El producto {item.producto_id} no existe.")

                if producto["stock"] < item.cantidad:
                    raise ValueError(
                        f"Stock insuficiente para producto {producto['codigo']} "
                        f"(disponible: {producto['stock']}, solicitado: {item.cantidad}). "
                        "Se ejecutó ROLLBACK completo de la transacción."
                    )

                cur.execute(
                    "UPDATE productos SET stock = stock - %s WHERE id = %s;",
                    (item.cantidad, item.producto_id),
                )

                subtotal_linea = (producto["precio_unitario"] * item.cantidad).quantize(
                    Decimal("0.01")
                )
                cur.execute(
                    """
                    INSERT INTO detalle_pedidos (
                        pedido_id, producto_id, cantidad, precio_unitario, subtotal_linea
                    )
                    VALUES (%s, %s, %s, %s, %s);
                    """,
                    (
                        pedido_id,
                        item.producto_id,
                        item.cantidad,
                        producto["precio_unitario"],
                        subtotal_linea,
                    ),
                )

                cantidad_total += item.cantidad
                subtotal_total += subtotal_linea

            desc_row = cur.execute(
                "SELECT fn_calcular_descuento(%s, %s) AS descuento;",
                (subtotal_total, cantidad_total),
            ).fetchone()
            descuento_total = (
                desc_row["descuento"]
                if desc_row and desc_row["descuento"] is not None
                else Decimal("0.00")
            )
            total_final = (subtotal_total - descuento_total).quantize(Decimal("0.01"))

            cur.execute(
                """
                UPDATE pedidos
                   SET cantidad = %s,
                       subtotal = %s,
                       descuento = %s,
                       total = %s
                 WHERE id = %s;
                """,
                (cantidad_total, subtotal_total, descuento_total, total_final, pedido_id),
            )

            cur.execute("COMMIT;")

        return {
            "pedido_id": pedido_id,
            "usuario_id": usuario_id,
            "cliente_id": cliente_id,
            "cantidad_total": cantidad_total,
            "subtotal": subtotal_total,
            "descuento": descuento_total,
            "total": total_final,
            "estado": cabecera["estado"],
            "fecha_pedido": cabecera["fecha_pedido"],
            "items_procesados": len(items),
            "mensaje": (
                f"Pedido compuesto #{pedido_id} confirmado con COMMIT "
                f"({len(items)} línea(s), total: {total_final})."
            ),
        }
    except (ValueError, RuntimeError, psycopg.Error) as exc:
        try:
            conn.execute("ROLLBACK;")
        except Exception:
            pass
        raise _traducir_error_pg(exc, rol_db) from exc
    finally:
        conn.close()


def cancelar_pedido_service(pedido_id: int, rol_db: str = "rol_operador") -> dict[str, Any]:
    """Invoca proc_cancelar_pedido para anular el pedido y reponer stock."""
    query = "CALL proc_cancelar_pedido(%s, NULL);"
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (pedido_id,))
        resultado = cur.fetchone()

    return {
        "pedido_id": pedido_id,
        "mensaje": resultado["p_mensaje"] if resultado else f"Pedido #{pedido_id} cancelado.",
    }


def eliminar_pedido_service(
    pedido_id: int,
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Elimina un pedido por ID (bloqueado con 403 Forbidden para rol_operador)."""
    query = """
        DELETE FROM pedidos
         WHERE id = %s
        RETURNING id;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (pedido_id,))
        eliminado = cur.fetchone()

    if not eliminado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pedido con id={pedido_id} no encontrado.",
        )

    return {
        "mensaje": f"Pedido #{eliminado['id']} eliminado correctamente.",
        "id": eliminado["id"],
    }


# REPORTES (FUNCIONES PL/pgSQL Y VISTAS CON JOIN)

def obtener_reporte_ventas_service(
    fecha_inicio: datetime | None = None,
    fecha_fin: datetime | None = None,
    rol_db: str = "rol_operador",
) -> list[dict[str, Any]]:
    """Invoca la función tabular PL/pgSQL fn_reporte_ventas."""
    query = "SELECT * FROM fn_reporte_ventas(%s, %s);"
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (fecha_inicio, fecha_fin))
        return cur.fetchall()


def obtener_promedio_ponderado_service(
    rol_db: str = "rol_operador",
) -> dict[str, Any]:
    """Invoca la función de agregación personalizada fn_promedio_ponderado."""
    query = """
        SELECT fn_promedio_ponderado(precio_unitario, stock::NUMERIC) AS promedio_ponderado_inventario,
               COALESCE(SUM(stock), 0) AS unidades_totales_stock
          FROM productos;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        resultado = cur.fetchone()

    return resultado or {
        "promedio_ponderado_inventario": Decimal("0.00"),
        "unidades_totales_stock": 0,
    }


def reporte_vista_pedidos_service(
    estado: str | None = None,
    rol_db: str = "rol_operador",
) -> list[dict[str, Any]]:
    """Consulta la vista vw_resumen_pedidos con filtro opcional por estado."""
    estado_filtro = estado.strip().upper() if estado else None
    query = """
        SELECT pedido_id, fecha_pedido, estado, usuario_id, usuario_nombre, usuario_email,
               cliente_id, cliente_documento, cliente_nombre, producto_id,
               producto_codigo, producto_nombre, categoria_nombre,
               cantidad, subtotal, descuento, total
          FROM vw_resumen_pedidos
         WHERE (%s::VARCHAR IS NULL OR UPPER(estado) = %s)
         ORDER BY fecha_pedido DESC, pedido_id DESC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (estado_filtro, estado_filtro))
        return cur.fetchall()


def reporte_vista_productos_service(
    estado_stock: str | None = None,
    rol_db: str = "rol_operador",
) -> list[dict[str, Any]]:
    """Consulta la vista vw_ventas_por_producto con filtro opcional por estado_stock."""
    filtro = estado_stock.strip().upper() if estado_stock else None
    query = """
        SELECT producto_id, codigo, producto_nombre, categoria_nombre,
               precio_unitario, stock_actual, estado_stock,
               total_pedidos, unidades_vendidas, ingresos_totales
          FROM vw_ventas_por_producto
         WHERE (%s::VARCHAR IS NULL OR estado_stock = %s)
         ORDER BY ingresos_totales DESC, producto_id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query, (filtro, filtro))
        return cur.fetchall()


def reporte_vista_usuarios_service(rol_db: str = "rol_operador") -> list[dict[str, Any]]:
    """Consulta la vista vw_resumen_por_usuario."""
    query = """
        SELECT usuario_id, usuario_nombre, email, rol, activo,
               total_operaciones, pedidos_activos, pedidos_cancelados, importe_acumulado
          FROM vw_resumen_por_usuario
         ORDER BY importe_acumulado DESC, usuario_id ASC;
    """
    with _db_cursor(rol_db) as cur:
        cur.execute(query)
        return cur.fetchall()
