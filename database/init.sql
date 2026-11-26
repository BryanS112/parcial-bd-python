-- Script de inicialización de TechCore Store para PostgreSQL
-- Dominio: TechCore Store - Sistema de Gestión Comercial, Inventario y Ventas

-- 1. TABLAS RELACIONALES BASE + EXTENSIÓN MERE + AUDITORÍA

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'rol_operador'
        CHECK (rol IN ('rol_admin', 'rol_operador')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL CHECK (char_length(trim(codigo)) > 0),
    nombre VARCHAR(150) NOT NULL CHECK (char_length(trim(nombre)) > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario > 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    categoria_id INTEGER REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE SET NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    tipo_cliente VARCHAR(20) NOT NULL
        CHECK (tipo_cliente IN ('NATURAL', 'JURIDICA')),
    documento VARCHAR(40) UNIQUE NOT NULL CHECK (documento ~ '^[0-9]+$'),
    nombre_razon_social VARCHAR(150) NOT NULL CHECK (char_length(trim(nombre_razon_social)) > 0),
    email VARCHAR(150),
    telefono VARCHAR(40) CHECK (telefono IS NULL OR telefono = '' OR telefono ~ '^[0-9]+$'),
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    cliente_id INTEGER REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'CONFIRMADO',
    fecha_pedido TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON UPDATE CASCADE ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario > 0),
    subtotal_linea NUMERIC(12, 2) NOT NULL CHECK (subtotal_linea >= 0)
);

CREATE TABLE IF NOT EXISTS auditoria_logs (
    id SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(60) NOT NULL,
    operacion VARCHAR(30) NOT NULL,
    usuario_db VARCHAR(60) NOT NULL DEFAULT CURRENT_USER,
    detalle TEXT NOT NULL,
    fecha_evento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES SECUNDARIOS PARA LLAVES FORÁNEAS Y CONSULTAS ANALÍTICAS

CREATE INDEX IF NOT EXISTS idx_productos_categoria_id
    ON productos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id
    ON pedidos(usuario_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_producto_id
    ON pedidos(producto_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id
    ON pedidos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_pedido
    ON pedidos(fecha_pedido);

CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_pedido_id
    ON detalle_pedidos(pedido_id);

CREATE INDEX IF NOT EXISTS idx_detalle_pedidos_producto_id
    ON detalle_pedidos(producto_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_logs_tabla_fecha
    ON auditoria_logs(tabla_afectada, fecha_evento);

-- 3. FUNCIONES Y PROCEDIMIENTOS PL/pgSQL

-- 3.1 Función escalar: calcula descuento según cantidad solicitada
CREATE OR REPLACE FUNCTION fn_calcular_descuento(
    p_subtotal NUMERIC,
    p_cantidad INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_porcentaje NUMERIC := 0.00;
BEGIN
    IF p_subtotal IS NULL OR p_subtotal <= 0 OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RETURN 0.00;
    END IF;

    IF p_cantidad >= 10 THEN
        v_porcentaje := 0.10;
    ELSIF p_cantidad >= 5 THEN
        v_porcentaje := 0.05;
    ELSE
        v_porcentaje := 0.00;
    END IF;

    RETURN ROUND(p_subtotal * v_porcentaje, 2);
END;
$$;

-- 3.2 Procedimiento almacenado: registra un pedido, actualiza stock y crea detalle_pedidos
-- La auditoría ahora se registra automáticamente vía triggers (fn_auditar_cambios)
CREATE OR REPLACE PROCEDURE proc_registrar_pedido(
    IN p_usuario_id INTEGER,
    IN p_producto_id INTEGER,
    IN p_cantidad INTEGER,
    INOUT p_pedido_id INTEGER DEFAULT NULL,
    INOUT p_mensaje TEXT DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_precio NUMERIC(12, 2);
    v_stock_actual INTEGER;
    v_usuario_existe BOOLEAN;
    v_subtotal NUMERIC(12, 2);
    v_descuento NUMERIC(12, 2);
    v_total NUMERIC(12, 2);
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad del pedido debe ser mayor a cero.';
    END IF;

    SELECT EXISTS(SELECT 1 FROM usuarios WHERE id = p_usuario_id AND activo = TRUE)
      INTO v_usuario_existe;

    IF NOT v_usuario_existe THEN
        RAISE EXCEPTION 'El usuario % no existe o se encuentra inactivo.', p_usuario_id;
    END IF;

    SELECT precio_unitario, stock
      INTO v_precio, v_stock_actual
      FROM productos
     WHERE id = p_producto_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe.', p_producto_id;
    END IF;

    IF v_stock_actual < p_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto % (disponible: %, solicitado: %).',
            p_producto_id, v_stock_actual, p_cantidad;
    END IF;

    v_subtotal := ROUND(v_precio * p_cantidad, 2);
    v_descuento := fn_calcular_descuento(v_subtotal, p_cantidad);
    v_total := ROUND(v_subtotal - v_descuento, 2);

    UPDATE productos
       SET stock = stock - p_cantidad
     WHERE id = p_producto_id;

    INSERT INTO pedidos (usuario_id, producto_id, cantidad, subtotal, descuento, total, estado)
    VALUES (p_usuario_id, p_producto_id, p_cantidad, v_subtotal, v_descuento, v_total, 'CONFIRMADO')
    RETURNING id INTO p_pedido_id;

    INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal_linea)
    VALUES (p_pedido_id, p_producto_id, p_cantidad, v_precio, v_subtotal);

    p_mensaje := FORMAT('Pedido #%s registrado correctamente. Total: %s (descuento: %s)',
                        p_pedido_id, v_total, v_descuento);
END;
$$;

-- 3.3 Segundo procedimiento almacenado: cancela pedido y devuelve stock al inventario
CREATE OR REPLACE PROCEDURE proc_cancelar_pedido(
    IN p_pedido_id INTEGER,
    INOUT p_mensaje TEXT DEFAULT NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_estado VARCHAR(30);
    v_producto_id INTEGER;
    v_cantidad INTEGER;
    v_total_devuelto INTEGER := 0;
    v_tiene_detalle BOOLEAN := FALSE;
    v_linea RECORD;
BEGIN
    SELECT estado, producto_id, cantidad
      INTO v_estado, v_producto_id, v_cantidad
      FROM pedidos
     WHERE id = p_pedido_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pedido % no existe.', p_pedido_id;
    END IF;

    IF UPPER(v_estado) = 'CANCELADO' THEN
        RAISE EXCEPTION 'El pedido % ya se encuentra cancelado.', p_pedido_id;
    END IF;

    UPDATE pedidos
       SET estado = 'CANCELADO'
     WHERE id = p_pedido_id;

    FOR v_linea IN
        SELECT producto_id, cantidad
          FROM detalle_pedidos
         WHERE pedido_id = p_pedido_id
    LOOP
        v_tiene_detalle := TRUE;
        UPDATE productos
           SET stock = stock + v_linea.cantidad
         WHERE id = v_linea.producto_id;
        v_total_devuelto := v_total_devuelto + v_linea.cantidad;
    END LOOP;

    IF NOT v_tiene_detalle THEN
        UPDATE productos
           SET stock = stock + v_cantidad
         WHERE id = v_producto_id;
        v_total_devuelto := v_cantidad;
    END IF;

    p_mensaje := FORMAT(
        'Pedido #%s cancelado correctamente. Se devolvieron %s unidad(es) al inventario.',
        p_pedido_id,
        v_total_devuelto
    );
END;
$$;

-- 3.4 Función que retorna tabla: reporte consolidado de ventas (compatible con ms-operaciones-reportes)
CREATE OR REPLACE FUNCTION fn_reporte_ventas(
    p_fecha_inicio TIMESTAMP DEFAULT NULL,
    p_fecha_fin TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    pedido_id INTEGER,
    cliente_nombre VARCHAR,
    producto_codigo VARCHAR,
    producto_nombre VARCHAR,
    cantidad INTEGER,
    subtotal NUMERIC,
    descuento NUMERIC,
    total NUMERIC,
    estado VARCHAR,
    fecha_pedido TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pe.id AS pedido_id,
        u.nombre AS cliente_nombre,
        pr.codigo AS producto_codigo,
        pr.nombre AS producto_nombre,
        pe.cantidad,
        pe.subtotal,
        pe.descuento,
        pe.total,
        pe.estado,
        pe.fecha_pedido
    FROM pedidos pe
    INNER JOIN usuarios u ON u.id = pe.usuario_id
    INNER JOIN productos pr ON pr.id = pe.producto_id
    WHERE (p_fecha_inicio IS NULL OR pe.fecha_pedido >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR pe.fecha_pedido <= p_fecha_fin)
    ORDER BY pe.fecha_pedido DESC, pe.id DESC;
END;
$$;

-- 3.5 Función de agregación personalizada: fn_promedio_ponderado(valor, peso)
CREATE OR REPLACE FUNCTION fn_promedio_ponderado_sfunc(
    p_estado NUMERIC[],
    p_valor NUMERIC,
    p_peso NUMERIC
)
RETURNS NUMERIC[]
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_valor IS NULL OR p_peso IS NULL OR p_peso <= 0 THEN
        RETURN p_estado;
    END IF;

    RETURN ARRAY[
        p_estado[1] + (p_valor * p_peso),
        p_estado[2] + p_peso
    ];
END;
$$;

CREATE OR REPLACE FUNCTION fn_promedio_ponderado_ffunc(
    p_estado NUMERIC[]
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_estado IS NULL OR p_estado[2] IS NULL OR p_estado[2] = 0 THEN
        RETURN 0.00;
    END IF;

    RETURN ROUND(p_estado[1] / p_estado[2], 2);
END;
$$;

DROP AGGREGATE IF EXISTS fn_promedio_ponderado(NUMERIC, NUMERIC);
CREATE AGGREGATE fn_promedio_ponderado(NUMERIC, NUMERIC) (
    SFUNC = fn_promedio_ponderado_sfunc,
    STYPE = NUMERIC[],
    FINALFUNC = fn_promedio_ponderado_ffunc,
    INITCOND = '{0,0}'
);

-- 4. TRIGGERS DE AUDITORÍA AUTOMÁTICA

CREATE OR REPLACE FUNCTION fn_auditar_cambios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rol_activo TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_detalle TEXT;
BEGIN
    v_rol_activo := COALESCE(NULLIF(current_setting('role', true), 'none'), CURRENT_USER);

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old := to_jsonb(OLD);
        IF TG_TABLE_NAME = 'usuarios' THEN
            v_old := v_old - 'password_hash';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new := to_jsonb(NEW);
        IF TG_TABLE_NAME = 'usuarios' THEN
            v_new := v_new - 'password_hash';
        END IF;
    END IF;

    v_detalle := jsonb_build_object(
        'old', v_old,
        'new', v_new
    )::TEXT;

    INSERT INTO auditoria_logs (tabla_afectada, operacion, usuario_db, detalle)
    VALUES (TG_TABLE_NAME, TG_OP, v_rol_activo, v_detalle);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_usuarios ON usuarios;
CREATE TRIGGER trg_auditoria_usuarios
    AFTER INSERT OR UPDATE OR DELETE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios();

DROP TRIGGER IF EXISTS trg_auditoria_productos ON productos;
CREATE TRIGGER trg_auditoria_productos
    AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios();

DROP TRIGGER IF EXISTS trg_auditoria_clientes ON clientes;
CREATE TRIGGER trg_auditoria_clientes
    AFTER INSERT OR UPDATE OR DELETE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios();

DROP TRIGGER IF EXISTS trg_auditoria_pedidos ON pedidos;
CREATE TRIGGER trg_auditoria_pedidos
    AFTER INSERT OR UPDATE OR DELETE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios();

DROP TRIGGER IF EXISTS trg_auditoria_detalle_pedidos ON detalle_pedidos;
CREATE TRIGGER trg_auditoria_detalle_pedidos
    AFTER INSERT OR UPDATE OR DELETE ON detalle_pedidos
    FOR EACH ROW EXECUTE FUNCTION fn_auditar_cambios();

-- 5. VISTAS CON JOIN PARA REPORTES

CREATE OR REPLACE VIEW vw_resumen_pedidos AS
SELECT
    pe.id AS pedido_id,
    pe.fecha_pedido,
    pe.estado,
    u.id AS usuario_id,
    u.nombre AS usuario_nombre,
    u.email AS usuario_email,
    cl.id AS cliente_id,
    cl.documento AS cliente_documento,
    COALESCE(cl.nombre_razon_social, 'Cliente General') AS cliente_nombre,
    pr.id AS producto_id,
    pr.codigo AS producto_codigo,
    pr.nombre AS producto_nombre,
    COALESCE(cat.nombre, 'Sin categoría') AS categoria_nombre,
    pe.cantidad,
    pe.subtotal,
    pe.descuento,
    pe.total
FROM pedidos pe
INNER JOIN usuarios u ON u.id = pe.usuario_id
INNER JOIN productos pr ON pr.id = pe.producto_id
LEFT JOIN categorias cat ON cat.id = pr.categoria_id
LEFT JOIN clientes cl ON cl.id = pe.cliente_id;

CREATE OR REPLACE VIEW vw_ventas_por_producto AS
SELECT
    pr.id AS producto_id,
    pr.codigo,
    pr.nombre AS producto_nombre,
    COALESCE(cat.nombre, 'Sin categoría') AS categoria_nombre,
    pr.precio_unitario,
    pr.stock AS stock_actual,
    CASE
        WHEN pr.stock = 0 THEN 'AGOTADO'
        WHEN pr.stock <= 10 THEN 'STOCK_BAJO'
        ELSE 'DISPONIBLE'
    END AS estado_stock,
    COUNT(pe.id)::INTEGER AS total_pedidos,
    COALESCE(SUM(pe.cantidad), 0)::INTEGER AS unidades_vendidas,
    COALESCE(SUM(pe.total), 0.00)::NUMERIC(12, 2) AS ingresos_totales
FROM productos pr
LEFT JOIN categorias cat ON cat.id = pr.categoria_id
LEFT JOIN pedidos pe ON pe.producto_id = pr.id AND UPPER(pe.estado) <> 'CANCELADO'
GROUP BY pr.id, pr.codigo, pr.nombre, cat.nombre, pr.precio_unitario, pr.stock;

CREATE OR REPLACE VIEW vw_resumen_por_usuario AS
SELECT
    u.id AS usuario_id,
    u.nombre AS usuario_nombre,
    u.email,
    u.rol,
    u.activo,
    COUNT(pe.id)::INTEGER AS total_operaciones,
    COUNT(pe.id) FILTER (WHERE UPPER(pe.estado) <> 'CANCELADO')::INTEGER AS pedidos_activos,
    COUNT(pe.id) FILTER (WHERE UPPER(pe.estado) = 'CANCELADO')::INTEGER AS pedidos_cancelados,
    COALESCE(
        SUM(CASE WHEN UPPER(pe.estado) <> 'CANCELADO' THEN pe.total ELSE 0.00 END),
        0.00
    )::NUMERIC(12, 2) AS importe_acumulado
FROM usuarios u
LEFT JOIN pedidos pe ON pe.usuario_id = u.id
GROUP BY u.id, u.nombre, u.email, u.rol, u.activo;

-- 6. Roles NOLOGIN y control de privilegios (DCL)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_admin') THEN
        CREATE ROLE rol_admin NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_operador') THEN
        CREATE ROLE rol_operador NOLOGIN;
    END IF;
END
$$;

-- Asignar ambos roles al usuario principal postgres para habilitar SET ROLE
GRANT rol_admin, rol_operador TO postgres;

-- Acceso al esquema public
GRANT USAGE ON SCHEMA public TO rol_admin, rol_operador;

-- Revocar privilegios implícitos a PUBLIC sobre tablas y vistas
REVOKE ALL PRIVILEGES ON TABLE
    usuarios, categorias, productos, clientes, pedidos, detalle_pedidos, auditoria_logs
    FROM PUBLIC;
REVOKE ALL PRIVILEGES ON
    vw_resumen_pedidos, vw_ventas_por_producto, vw_resumen_por_usuario
    FROM PUBLIC;

-- rol_admin: control total sobre todas las tablas, vistas y secuencias
GRANT ALL PRIVILEGES ON TABLE
    usuarios, categorias, productos, clientes, pedidos, detalle_pedidos, auditoria_logs
    TO rol_admin;
GRANT SELECT ON
    vw_resumen_pedidos, vw_ventas_por_producto, vw_resumen_por_usuario
    TO rol_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO rol_admin;

-- rol_operador:
--   - SELECT en usuarios, categorias y todas las vistas vw_*
--   - SELECT, INSERT, UPDATE en productos, clientes, pedidos y detalle_pedidos (sin DELETE)
--   - Ningún acceso directo a auditoria_logs
REVOKE ALL PRIVILEGES ON TABLE
    usuarios, categorias, productos, clientes, pedidos, detalle_pedidos, auditoria_logs
    FROM rol_operador;
REVOKE ALL PRIVILEGES ON
    vw_resumen_pedidos, vw_ventas_por_producto, vw_resumen_por_usuario
    FROM rol_operador;

GRANT SELECT ON TABLE usuarios, categorias TO rol_operador;
GRANT SELECT ON
    vw_resumen_pedidos, vw_ventas_por_producto, vw_resumen_por_usuario
    TO rol_operador;
GRANT SELECT, INSERT, UPDATE ON TABLE
    productos, clientes, pedidos, detalle_pedidos
    TO rol_operador;
REVOKE DELETE ON TABLE
    usuarios, categorias, productos, clientes, pedidos, detalle_pedidos
    FROM rol_operador;
REVOKE ALL PRIVILEGES ON TABLE auditoria_logs FROM rol_operador;
GRANT USAGE, SELECT ON SEQUENCE
    productos_id_seq, clientes_id_seq, pedidos_id_seq, detalle_pedidos_id_seq
    TO rol_operador;

-- Permisos de ejecución sobre todas las funciones y procedimientos para ambos roles
GRANT EXECUTE ON FUNCTION fn_calcular_descuento(NUMERIC, INTEGER) TO rol_admin, rol_operador;
GRANT EXECUTE ON PROCEDURE proc_registrar_pedido(INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO rol_admin, rol_operador;
GRANT EXECUTE ON PROCEDURE proc_cancelar_pedido(INTEGER, TEXT) TO rol_admin, rol_operador;
GRANT EXECUTE ON FUNCTION fn_reporte_ventas(TIMESTAMP, TIMESTAMP) TO rol_admin, rol_operador;
GRANT EXECUTE ON FUNCTION fn_promedio_ponderado_sfunc(NUMERIC[], NUMERIC, NUMERIC) TO rol_admin, rol_operador;
GRANT EXECUTE ON FUNCTION fn_promedio_ponderado_ffunc(NUMERIC[]) TO rol_admin, rol_operador;
GRANT EXECUTE ON FUNCTION fn_promedio_ponderado(NUMERIC, NUMERIC) TO rol_admin, rol_operador;
GRANT EXECUTE ON FUNCTION fn_auditar_cambios() TO rol_admin, rol_operador;

-- 7. DATOS SEMILLA IDEMPOTENTES (TECHCORE STORE)

INSERT INTO categorias (nombre, descripcion)
VALUES
    ('Computación', 'Equipos portátiles, estaciones de trabajo y hardware empresarial'),
    ('Monitores y Video', 'Pantallas profesionales 4K y soluciones de visualización'),
    ('Periféricos', 'Teclados mecánicos, ratones ergonómicos y accesorios USB-C')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES
    ('Administrador Sistema', 'admin@empresa.edu', encode(sha256('admin123'::bytea), 'hex'), 'rol_admin'),
    ('Operador Inventario', 'operador@empresa.edu', encode(sha256('operador123'::bytea), 'hex'), 'rol_operador')
ON CONFLICT (email) DO NOTHING;

INSERT INTO productos (codigo, nombre, precio_unitario, stock)
VALUES
    ('PROD-001', 'Laptop Empresarial 14"', 3200.00, 15),
    ('PROD-002', 'Monitor IPS 27" 4K', 1450.00, 25),
    ('PROD-003', 'Teclado Mecánico Inalámbrico', 280.00, 50),
    ('PROD-004', 'Mouse Ergonómico USB-C', 150.00, 80)
ON CONFLICT (codigo) DO NOTHING;

-- Asignación idempotente de categorías a los productos semilla existentes
UPDATE productos pr
   SET categoria_id = cat.id
  FROM categorias cat
 WHERE pr.categoria_id IS NULL
   AND (
       (pr.codigo = 'PROD-001' AND cat.nombre = 'Computación')
       OR (pr.codigo = 'PROD-002' AND cat.nombre = 'Monitores y Video')
       OR (pr.codigo IN ('PROD-003', 'PROD-004') AND cat.nombre = 'Periféricos')
   );

INSERT INTO clientes (tipo_cliente, documento, nombre_razon_social, email, telefono)
VALUES
    ('NATURAL', '1045789123', 'Carlos Andrés Mejía', 'carlos.mejia@correo.co', '3005550101'),
    ('NATURAL', '1098456321', 'María Fernanda Rojas', 'maria.rojas@correo.co', '3115550202'),
    ('JURIDICA', '9004567891', 'Soluciones Digitales del Norte S.A.S.', 'compras@solucionesnorte.co', '6053550303'),
    ('JURIDICA', '8009876542', 'Ingeniería y Redes Caribe Ltda.', 'proveedores@redescaribe.co', '6053550404')
ON CONFLICT (documento) DO NOTHING;

INSERT INTO pedidos (usuario_id, producto_id, cliente_id, cantidad, subtotal, descuento, total, estado)
SELECT u.id, pr.id, cl.id, 2, 6400.00, 0.00, 6400.00, 'CONFIRMADO'
  FROM usuarios u
  JOIN productos pr ON pr.codigo = 'PROD-001'
  JOIN clientes cl ON cl.documento = '9004567891'
 WHERE u.email = 'operador@empresa.edu'
   AND NOT EXISTS (SELECT 1 FROM pedidos);

INSERT INTO pedidos (usuario_id, producto_id, cliente_id, cantidad, subtotal, descuento, total, estado)
SELECT u.id, pr.id, cl.id, 10, 2800.00, 280.00, 2520.00, 'CONFIRMADO'
  FROM usuarios u
  JOIN productos pr ON pr.codigo = 'PROD-003'
  JOIN clientes cl ON cl.documento = '1045789123'
 WHERE u.email = 'operador@empresa.edu'
   AND NOT EXISTS (
       SELECT 1 FROM pedidos pe WHERE pe.producto_id = pr.id AND pe.cantidad = 10
   );

-- Vincular cliente_id por defecto a pedidos semilla existentes que no lo tuvieran
UPDATE pedidos pe
   SET cliente_id = cl.id
  FROM clientes cl
 WHERE pe.cliente_id IS NULL
   AND cl.documento = '9004567891';

-- Poblar detalle_pedidos de forma idempotente para los pedidos existentes sin líneas de detalle
INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario, subtotal_linea)
SELECT pe.id, pe.producto_id, pe.cantidad, pr.precio_unitario, pe.subtotal
  FROM pedidos pe
  JOIN productos pr ON pr.id = pe.producto_id
 WHERE NOT EXISTS (
     SELECT 1 FROM detalle_pedidos dp WHERE dp.pedido_id = pe.id
 );

INSERT INTO auditoria_logs (tabla_afectada, operacion, usuario_db, detalle)
SELECT 'sistema', 'INIT', 'postgres', 'Inicialización de esquema TechCore Store en PostgreSQL'
 WHERE NOT EXISTS (
     SELECT 1 FROM auditoria_logs WHERE tabla_afectada = 'sistema' AND operacion = 'INIT'
 );
