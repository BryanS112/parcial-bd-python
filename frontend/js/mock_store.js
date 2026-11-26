const nowIso = () => new Date().toISOString();

const state = {
    nextIds: {
        categorias: 4,
        usuarios: 3,
        productos: 5,
        clientes: 5,
        pedidos: 3,
        detalle_pedidos: 3,
        auditoria_logs: 2,
    },
    categorias: [
        { id: 1, nombre: 'Computación', descripcion: 'Equipos portátiles, estaciones de trabajo y hardware empresarial', activo: true, creado_en: '2026-01-15T10:00:00Z' },
        { id: 2, nombre: 'Monitores y Video', descripcion: 'Pantallas profesionales 4K y soluciones de visualización', activo: true, creado_en: '2026-01-15T10:00:00Z' },
        { id: 3, nombre: 'Periféricos', descripcion: 'Teclados mecánicos, ratones ergonómicos y accesorios USB-C', activo: true, creado_en: '2026-01-15T10:00:00Z' },
    ],
    usuarios: [
        { id: 1, nombre: 'Administrador Sistema', email: 'admin@empresa.edu', password_plain: 'admin123', rol: 'rol_admin', activo: true, creado_en: '2026-01-15T10:00:00Z' },
        { id: 2, nombre: 'Operador Inventario', email: 'operador@empresa.edu', password_plain: 'operador123', rol: 'rol_operador', activo: true, creado_en: '2026-01-15T10:00:00Z' },
    ],
    productos: [
        { id: 1, codigo: 'PROD-001', nombre: 'Laptop Empresarial 14"', precio_unitario: 3200.00, stock: 15, categoria_id: 1, creado_en: '2026-01-15T10:00:00Z' },
        { id: 2, codigo: 'PROD-002', nombre: 'Monitor IPS 27" 4K', precio_unitario: 1450.00, stock: 25, categoria_id: 2, creado_en: '2026-01-15T10:00:00Z' },
        { id: 3, codigo: 'PROD-003', nombre: 'Teclado Mecánico Inalámbrico', precio_unitario: 280.00, stock: 50, categoria_id: 3, creado_en: '2026-01-15T10:00:00Z' },
        { id: 4, codigo: 'PROD-004', nombre: 'Mouse Ergonómico USB-C', precio_unitario: 150.00, stock: 80, categoria_id: 3, creado_en: '2026-01-15T10:00:00Z' },
    ],
    clientes: [
        { id: 1, tipo_cliente: 'NATURAL', documento: '1045789123', nombre_razon_social: 'Carlos Andrés Mejía', email: 'carlos.mejia@correo.co', telefono: '3005550101', creado_en: '2026-01-15T10:00:00Z' },
        { id: 2, tipo_cliente: 'NATURAL', documento: '1098456321', nombre_razon_social: 'María Fernanda Rojas', email: 'maria.rojas@correo.co', telefono: '3115550202', creado_en: '2026-01-15T10:00:00Z' },
        { id: 3, tipo_cliente: 'JURIDICA', documento: '9004567891', nombre_razon_social: 'Soluciones Digitales del Norte S.A.S.', email: 'compras@solucionesnorte.co', telefono: '6053550303', creado_en: '2026-01-15T10:00:00Z' },
        { id: 4, tipo_cliente: 'JURIDICA', documento: '8009876542', nombre_razon_social: 'Ingeniería y Redes Caribe Ltda.', email: 'proveedores@redescaribe.co', telefono: '6053550404', creado_en: '2026-01-15T10:00:00Z' },
    ],
    pedidos: [
        { id: 1, usuario_id: 2, producto_id: 1, cliente_id: 3, cantidad: 2, subtotal: 6400.00, descuento: 0.00, total: 6400.00, estado: 'CONFIRMADO', fecha_pedido: '2026-02-01T14:30:00Z' },
        { id: 2, usuario_id: 2, producto_id: 3, cliente_id: 1, cantidad: 10, subtotal: 2800.00, descuento: 280.00, total: 2520.00, estado: 'CONFIRMADO', fecha_pedido: '2026-02-02T16:15:00Z' },
    ],
    detalle_pedidos: [
        { id: 1, pedido_id: 1, producto_id: 1, cantidad: 2, precio_unitario: 3200.00, subtotal_linea: 6400.00 },
        { id: 2, pedido_id: 2, producto_id: 3, cantidad: 10, precio_unitario: 280.00, subtotal_linea: 2800.00 },
    ],
    auditoria_logs: [
        { id: 1, tabla_afectada: 'sistema', operacion: 'INIT', usuario_db: 'postgres', detalle: 'Inicialización de esquema TechCore Store (Modo Demo en memoria)', fecha_evento: '2026-01-15T10:00:00Z' },
    ],
};

function round2(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

function calcularDescuento(subtotal, cantidad) {
    if (!subtotal || subtotal <= 0 || !cantidad || cantidad <= 0) return 0;
    let pct = 0;
    if (cantidad >= 10) pct = 0.10;
    else if (cantidad >= 5) pct = 0.05;
    return round2(subtotal * pct);
}

function registrarAuditoria(tabla, operacion, role, oldObj, newObj) {
    state.auditoria_logs.unshift({
        id: state.nextIds.auditoria_logs++,
        tabla_afectada: tabla,
        operacion,
        usuario_db: role,
        detalle: JSON.stringify({ old: oldObj || null, new: newObj || null }),
        fecha_evento: nowIso(),
    });
}

function sanitizeUsuario(u) {
    const { password_plain: _, ...rest } = u;
    return { ...rest };
}

function mockResp(status, data) {
    return { status, ok: status >= 200 && status < 300, data };
}

function dclDenied(role, detalle) {
    return mockResp(403, {
        detail: `Permiso denegado en PostgreSQL para el rol '${role}': ${detalle}`,
    });
}

function buildVwResumenPedidos(estadoFiltro) {
    return state.pedidos
        .filter((pe) => !estadoFiltro || pe.estado.toUpperCase() === estadoFiltro.toUpperCase())
        .map((pe) => {
            const usr = state.usuarios.find((u) => u.id === pe.usuario_id) || {};
            const cli = state.clientes.find((c) => c.id === pe.cliente_id) || null;
            const prod = state.productos.find((p) => p.id === pe.producto_id) || {};
            const cat = state.categorias.find((c) => c.id === prod.categoria_id) || null;
            return {
                pedido_id: pe.id,
                fecha_pedido: pe.fecha_pedido,
                estado: pe.estado,
                usuario_id: pe.usuario_id,
                usuario_nombre: usr.nombre || 'Usuario',
                usuario_email: usr.email || '',
                cliente_id: pe.cliente_id,
                cliente_documento: cli ? cli.documento : null,
                cliente_nombre: cli ? cli.nombre_razon_social : 'Cliente General',
                producto_id: pe.producto_id,
                producto_codigo: prod.codigo || '',
                producto_nombre: prod.nombre || '',
                categoria_nombre: cat ? cat.nombre : 'Sin categoría',
                cantidad: pe.cantidad,
                subtotal: pe.subtotal,
                descuento: pe.descuento,
                total: pe.total,
            };
        })
        .sort((a, b) => b.pedido_id - a.pedido_id);
}

function buildVwVentasPorProducto(estadoStockFiltro) {
    return state.productos
        .map((pr) => {
            const cat = state.categorias.find((c) => c.id === pr.categoria_id);
            const estado_stock = pr.stock === 0 ? 'AGOTADO' : pr.stock <= 10 ? 'STOCK_BAJO' : 'DISPONIBLE';
            const activos = state.pedidos.filter((pe) => pe.producto_id === pr.id && pe.estado.toUpperCase() !== 'CANCELADO');
            const unidades_vendidas = activos.reduce((acc, pe) => acc + pe.cantidad, 0);
            const ingresos_totales = round2(activos.reduce((acc, pe) => acc + Number(pe.total), 0));
            return {
                producto_id: pr.id,
                codigo: pr.codigo,
                producto_nombre: pr.nombre,
                categoria_nombre: cat ? cat.nombre : 'Sin categoría',
                precio_unitario: pr.precio_unitario,
                stock_actual: pr.stock,
                estado_stock,
                total_pedidos: activos.length,
                unidades_vendidas,
                ingresos_totales,
            };
        })
        .filter((row) => !estadoStockFiltro || row.estado_stock === estadoStockFiltro.toUpperCase())
        .sort((a, b) => b.ingresos_totales - a.ingresos_totales || a.producto_id - b.producto_id);
}

function buildVwResumenPorUsuario() {
    return state.usuarios
        .map((u) => {
            const ops = state.pedidos.filter((pe) => pe.usuario_id === u.id);
            const activos = ops.filter((pe) => pe.estado.toUpperCase() !== 'CANCELADO');
            const cancelados = ops.filter((pe) => pe.estado.toUpperCase() === 'CANCELADO');
            const importe = round2(activos.reduce((acc, pe) => acc + Number(pe.total), 0));
            return {
                usuario_id: u.id,
                usuario_nombre: u.nombre,
                email: u.email,
                rol: u.rol,
                activo: u.activo,
                total_operaciones: ops.length,
                pedidos_activos: activos.length,
                pedidos_cancelados: cancelados.length,
                importe_acumulado: importe,
            };
        })
        .sort((a, b) => b.importe_acumulado - a.importe_acumulado || a.usuario_id - b.usuario_id);
}

export function handleMockRequest(rawPath, { method = 'GET', role = 'rol_operador', body = null } = {}) {
    const url = new URL(rawPath, 'http://localhost');
    const pathname = url.pathname;
    const params = url.searchParams;
    const m = method.toUpperCase();

    // Auditoría (solo rol_admin)
    if (pathname === '/api/v1/auditoria' && m === 'GET') {
        if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table auditoria_logs');
        const tabla = params.get('tabla_afectada')?.trim().toLowerCase() || '';
        const op = params.get('operacion')?.trim().toUpperCase() || '';
        const limite = Number(params.get('limite') || 50);
        const rows = state.auditoria_logs
            .filter((l) => (!tabla || l.tabla_afectada.toLowerCase() === tabla) && (!op || l.operacion.toUpperCase() === op))
            .slice(0, limite);
        return mockResp(200, rows);
    }

    if (pathname === '/api/v1/auditoria/resumen' && m === 'GET') {
        if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table auditoria_logs');
        const map = new Map();
        for (const l of state.auditoria_logs) {
            const key = `${l.tabla_afectada}|${l.operacion}`;
            const cur = map.get(key) || {
                tabla_afectada: l.tabla_afectada,
                operacion: l.operacion,
                total_eventos: 0,
                ultimo_evento: l.fecha_evento,
            };
            cur.total_eventos += 1;
            if (l.fecha_evento > cur.ultimo_evento) cur.ultimo_evento = l.fecha_evento;
            map.set(key, cur);
        }
        return mockResp(200, Array.from(map.values()));
    }

    // Auth & Usuarios
    if (pathname === '/api/v1/auth/login' && m === 'POST') {
        const usr = state.usuarios.find((u) => u.email === body?.email && u.password_plain === body?.password);
        if (!usr) return mockResp(401, { detail: 'Credenciales inválidas.' });
        if (!usr.activo) return mockResp(403, { detail: 'El usuario se encuentra inactivo.' });
        return mockResp(200, { mensaje: 'Autenticación exitosa', usuario: sanitizeUsuario(usr) });
    }

    if (pathname === '/api/v1/usuarios' && m === 'GET') {
        return mockResp(200, state.usuarios.map(sanitizeUsuario));
    }
    if (pathname === '/api/v1/usuarios' && m === 'POST') {
        const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        const password = typeof body?.password === 'string' ? body.password : '';
        if (nombre.length < 2) return mockResp(422, { detail: 'El nombre debe tener al menos 2 caracteres.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mockResp(422, { detail: 'El correo electrónico no es válido.' });
        if (password.length < 6) return mockResp(422, { detail: 'La contraseña debe tener al menos 6 caracteres.' });
        if (state.usuarios.some((u) => u.email === email)) {
            return mockResp(409, { detail: 'Ya existe un usuario con el mismo email.' });
        }
        const nuevo = {
            id: state.nextIds.usuarios++,
            nombre,
            email,
            password_plain: password,
            rol: body.rol || 'rol_operador',
            activo: true,
            creado_en: nowIso(),
        };
        state.usuarios.push(nuevo);
        registrarAuditoria('usuarios', 'INSERT', role, null, sanitizeUsuario(nuevo));
        return mockResp(201, sanitizeUsuario(nuevo));
    }
    const usrMatch = pathname.match(/^\/api\/v1\/usuarios\/(\d+)$/);
    if (usrMatch) {
        const id = Number(usrMatch[1]);
        const idx = state.usuarios.findIndex((u) => u.id === id);
        if (m === 'GET') {
            return idx >= 0 ? mockResp(200, sanitizeUsuario(state.usuarios[idx])) : mockResp(404, { detail: `Usuario con id=${id} no encontrado.` });
        }
        if (m === 'PUT') {
            if (idx < 0) return mockResp(404, { detail: `Usuario con id=${id} no encontrado.` });
            const prev = sanitizeUsuario(state.usuarios[idx]);
            if (body?.nombre !== undefined && body?.nombre !== null) {
                const limpio = String(body.nombre).trim();
                if (limpio.length < 2) return mockResp(422, { detail: 'El nombre debe tener al menos 2 caracteres.' });
                state.usuarios[idx].nombre = limpio;
            }
            if (body?.rol !== undefined && body?.rol !== null) state.usuarios[idx].rol = body.rol;
            if (body?.activo !== undefined && body?.activo !== null) state.usuarios[idx].activo = body.activo;
            const curr = sanitizeUsuario(state.usuarios[idx]);
            registrarAuditoria('usuarios', 'UPDATE', role, prev, curr);
            return mockResp(200, curr);
        }
        if (m === 'DELETE') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table usuarios');
            if (idx < 0) return mockResp(404, { detail: `Usuario con id=${id} no encontrado.` });
            if (state.pedidos.some((p) => p.usuario_id === id)) {
                return mockResp(409, { detail: 'No se puede eliminar el usuario porque tiene pedidos asociados.' });
            }
            const [removed] = state.usuarios.splice(idx, 1);
            registrarAuditoria('usuarios', 'DELETE', role, sanitizeUsuario(removed), null);
            return mockResp(200, { mensaje: `Usuario ${removed.email} eliminado correctamente.`, id: removed.id });
        }
    }

    // Productos
    if (pathname === '/api/v1/productos' && m === 'GET') {
        return mockResp(200, state.productos.map((p) => ({ ...p })));
    }
    if (pathname === '/api/v1/productos' && m === 'POST') {
        const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : '';
        const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
        const precio = body?.precio_unitario;
        const stock = body?.stock ?? 0;
        if (codigo.length < 2 || nombre.length < 2) {
            return mockResp(422, { detail: 'Código y nombre deben tener al menos 2 caracteres válidos.' });
        }
        if (typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0) {
            return mockResp(422, { detail: 'El precio_unitario debe ser un número estrictamente mayor a 0.' });
        }
        if (!Number.isInteger(stock) || stock < 0) {
            return mockResp(422, { detail: 'El stock debe ser un entero mayor o igual a 0.' });
        }
        if (state.productos.some((p) => p.codigo === codigo)) {
            return mockResp(409, { detail: 'Ya existe un registro con el mismo valor único.' });
        }
        const nuevo = {
            id: state.nextIds.productos++,
            codigo,
            nombre,
            precio_unitario: round2(precio),
            stock,
            categoria_id: body.categoria_id ?? null,
            creado_en: nowIso(),
        };
        state.productos.push(nuevo);
        registrarAuditoria('productos', 'INSERT', role, null, nuevo);
        return mockResp(201, { ...nuevo });
    }
    const prodMatch = pathname.match(/^\/api\/v1\/productos\/(\d+)$/);
    if (prodMatch) {
        const id = Number(prodMatch[1]);
        const idx = state.productos.findIndex((p) => p.id === id);
        if (m === 'GET') {
            return idx >= 0 ? mockResp(200, { ...state.productos[idx] }) : mockResp(404, { detail: `Producto con id=${id} no encontrado.` });
        }
        if (m === 'PUT') {
            if (idx < 0) return mockResp(404, { detail: `Producto con id=${id} no encontrado.` });
            const prev = { ...state.productos[idx] };
            const p = state.productos[idx];
            if (body?.codigo !== undefined && body?.codigo !== null) p.codigo = body.codigo;
            if (body?.nombre !== undefined && body?.nombre !== null) p.nombre = body.nombre;
            if (body?.precio_unitario !== undefined && body?.precio_unitario !== null) p.precio_unitario = Number(body.precio_unitario);
            if (body?.stock !== undefined && body?.stock !== null) p.stock = Number(body.stock);
            if (body?.categoria_id !== undefined) p.categoria_id = body.categoria_id;
            registrarAuditoria('productos', 'UPDATE', role, prev, { ...p });
            return mockResp(200, { ...p });
        }
        if (m === 'DELETE') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table productos');
            if (idx < 0) return mockResp(404, { detail: `Producto con id=${id} no encontrado.` });
            if (state.pedidos.some((p) => p.producto_id === id) || state.detalle_pedidos.some((d) => d.producto_id === id)) {
                return mockResp(409, { detail: 'Violación de integridad referencial: referencia inexistente o registro en uso.' });
            }
            const [removed] = state.productos.splice(idx, 1);
            registrarAuditoria('productos', 'DELETE', role, removed, null);
            return mockResp(200, { mensaje: `Producto ${removed.codigo} eliminado correctamente.`, id: removed.id });
        }
    }

    // Categorías
    if (pathname === '/api/v1/categorias' && m === 'GET') {
        return mockResp(200, state.categorias.map((c) => ({ ...c })));
    }
    if (pathname === '/api/v1/categorias' && m === 'POST') {
        if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table categorias');
        const nueva = {
            id: state.nextIds.categorias++,
            nombre: body.nombre,
            descripcion: body.descripcion ?? null,
            activo: body.activo ?? true,
            creado_en: nowIso(),
        };
        state.categorias.push(nueva);
        return mockResp(201, { ...nueva });
    }
    const catMatch = pathname.match(/^\/api\/v1\/categorias\/(\d+)$/);
    if (catMatch) {
        const id = Number(catMatch[1]);
        const idx = state.categorias.findIndex((c) => c.id === id);
        if (m === 'PUT') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table categorias');
            if (idx < 0) return mockResp(404, { detail: `Categoría con id=${id} no encontrada.` });
            const c = state.categorias[idx];
            if (body?.nombre !== undefined && body?.nombre !== null) c.nombre = body.nombre;
            if (body?.descripcion !== undefined) c.descripcion = body.descripcion;
            if (body?.activo !== undefined && body?.activo !== null) c.activo = body.activo;
            return mockResp(200, { ...c });
        }
        if (m === 'DELETE') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table categorias');
            if (idx < 0) return mockResp(404, { detail: `Categoría con id=${id} no encontrada.` });
            const [removed] = state.categorias.splice(idx, 1);
            return mockResp(200, { mensaje: `Categoría '${removed.nombre}' eliminada correctamente.`, id: removed.id });
        }
    }

    // Clientes
    if (pathname === '/api/v1/clientes' && m === 'GET') {
        return mockResp(200, state.clientes.map((c) => ({ ...c })));
    }
    if (pathname === '/api/v1/clientes' && m === 'POST') {
        const documento = typeof body?.documento === 'string' ? body.documento.trim() : '';
        const nombre_razon_social = typeof body?.nombre_razon_social === 'string' ? body.nombre_razon_social.trim() : '';
        const email = typeof body?.email === 'string' ? body.email.trim() || null : null;
        const telefono = typeof body?.telefono === 'string' ? body.telefono.trim() || null : null;
        if (!/^\d{6,15}$/.test(documento)) {
            return mockResp(422, { detail: 'El documento debe contener únicamente entre 6 y 15 dígitos numéricos.' });
        }
        if (nombre_razon_social.length < 2) {
            return mockResp(422, { detail: 'El nombre o razón social debe tener al menos 2 caracteres.' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return mockResp(422, { detail: 'El formato del correo electrónico no es válido.' });
        }
        if (telefono && !/^\d{6,15}$/.test(telefono)) {
            return mockResp(422, { detail: 'El teléfono debe contener únicamente entre 6 y 15 dígitos numéricos.' });
        }
        if (state.clientes.some((c) => c.documento === documento)) {
            return mockResp(409, { detail: 'Ya existe un registro con el mismo valor único.' });
        }
        const nuevo = {
            id: state.nextIds.clientes++,
            tipo_cliente: body.tipo_cliente,
            documento,
            nombre_razon_social,
            email,
            telefono,
            creado_en: nowIso(),
        };
        state.clientes.push(nuevo);
        registrarAuditoria('clientes', 'INSERT', role, null, nuevo);
        return mockResp(201, { ...nuevo });
    }
    const cliMatch = pathname.match(/^\/api\/v1\/clientes\/(\d+)$/);
    if (cliMatch) {
        const id = Number(cliMatch[1]);
        const idx = state.clientes.findIndex((c) => c.id === id);
        if (m === 'PUT') {
            if (idx < 0) return mockResp(404, { detail: `Cliente con id=${id} no encontrado.` });
            const prev = { ...state.clientes[idx] };
            const c = state.clientes[idx];
            if (body?.tipo_cliente !== undefined && body?.tipo_cliente !== null) c.tipo_cliente = body.tipo_cliente;
            if (body?.documento !== undefined && body?.documento !== null) c.documento = body.documento;
            if (body?.nombre_razon_social !== undefined && body?.nombre_razon_social !== null) c.nombre_razon_social = body.nombre_razon_social;
            if (body?.email !== undefined) c.email = body.email;
            if (body?.telefono !== undefined) c.telefono = body.telefono;
            registrarAuditoria('clientes', 'UPDATE', role, prev, { ...c });
            return mockResp(200, { ...c });
        }
        if (m === 'DELETE') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table clientes');
            if (idx < 0) return mockResp(404, { detail: `Cliente con id=${id} no encontrado.` });
            const [removed] = state.clientes.splice(idx, 1);
            registrarAuditoria('clientes', 'DELETE', role, removed, null);
            return mockResp(200, { mensaje: `Cliente ${removed.documento} eliminado correctamente.`, id: removed.id });
        }
    }

    // Descuentos y Pedidos (ACID COMMIT / ROLLBACK)
    if (pathname === '/api/v1/descuentos/calcular' && m === 'POST') {
        const subtotal = Number(body.subtotal);
        const cantidad = Number(body.cantidad);
        const descuento = calcularDescuento(subtotal, cantidad);
        return mockResp(200, { subtotal, cantidad, descuento, total_estimado: round2(subtotal - descuento) });
    }

    if (pathname === '/api/v1/pedidos' && m === 'POST') {
        const usr = state.usuarios.find((u) => u.id === Number(body.usuario_id) && u.activo);
        if (!usr) return mockResp(400, { detail: `El usuario ${body.usuario_id} no existe o se encuentra inactivo.` });
        const prod = state.productos.find((p) => p.id === Number(body.producto_id));
        if (!prod) return mockResp(400, { detail: `El producto ${body.producto_id} no existe.` });
        const cant = Number(body.cantidad);
        if (prod.stock < cant) {
            return mockResp(400, { detail: `Stock insuficiente para el producto ${prod.id} (disponible: ${prod.stock}, solicitado: ${cant}).` });
        }
        const subtotal = round2(prod.precio_unitario * cant);
        const descuento = calcularDescuento(subtotal, cant);
        const total = round2(subtotal - descuento);
        const prevProd = { ...prod };
        prod.stock -= cant;
        registrarAuditoria('productos', 'UPDATE', role, prevProd, { ...prod });

        const pedido = {
            id: state.nextIds.pedidos++,
            usuario_id: usr.id,
            producto_id: prod.id,
            cliente_id: null,
            cantidad: cant,
            subtotal,
            descuento,
            total,
            estado: 'CONFIRMADO',
            fecha_pedido: nowIso(),
        };
        state.pedidos.push(pedido);
        registrarAuditoria('pedidos', 'INSERT', role, null, pedido);

        const det = {
            id: state.nextIds.detalle_pedidos++,
            pedido_id: pedido.id,
            producto_id: prod.id,
            cantidad: cant,
            precio_unitario: prod.precio_unitario,
            subtotal_linea: subtotal,
        };
        state.detalle_pedidos.push(det);
        return mockResp(201, {
            pedido_id: pedido.id,
            mensaje: `Pedido #${pedido.id} registrado correctamente. Total: ${total} (descuento: ${descuento})`,
        });
    }

    if (pathname === '/api/v1/pedidos/lote' && m === 'POST') {
        const usr = state.usuarios.find((u) => u.id === Number(body.usuario_id) && u.activo);
        if (!usr) return mockResp(400, { detail: `El usuario ${body.usuario_id} no existe o se encuentra inactivo.` });
        if (body.cliente_id !== null && body.cliente_id !== undefined) {
            if (!state.clientes.some((c) => c.id === Number(body.cliente_id))) {
                return mockResp(400, { detail: `El cliente ${body.cliente_id} no existe.` });
            }
        }
        const items = body.items || [];
        if (items.length === 0) return mockResp(400, { detail: 'Debes enviar al menos un ítem.' });

        // Validar todo el lote antes de mutar el estado (simulación atómica de ROLLBACK)
        const cantidadesPorProd = new Map();
        for (const item of items) {
            const prod = state.productos.find((p) => p.id === Number(item.producto_id));
            if (!prod) return mockResp(400, { detail: `El producto ${item.producto_id} no existe.` });
            const acum = (cantidadesPorProd.get(prod.id) || 0) + Number(item.cantidad);
            if (prod.stock < acum) {
                return mockResp(400, {
                    detail: `Stock insuficiente para producto ${prod.codigo} (disponible: ${prod.stock}, solicitado: ${acum}). Se ejecutó ROLLBACK completo de la transacción.`,
                });
            }
            cantidadesPorProd.set(prod.id, acum);
        }

        // COMMIT en memoria
        let cantidadTotal = 0;
        let subtotalTotal = 0;
        const pedidoId = state.nextIds.pedidos++;
        const fechaPedido = nowIso();

        for (const item of items) {
            const prod = state.productos.find((p) => p.id === Number(item.producto_id));
            const cant = Number(item.cantidad);
            const prevProd = { ...prod };
            prod.stock -= cant;
            registrarAuditoria('productos', 'UPDATE', role, prevProd, { ...prod });

            const subLinea = round2(prod.precio_unitario * cant);
            const det = {
                id: state.nextIds.detalle_pedidos++,
                pedido_id: pedidoId,
                producto_id: prod.id,
                cantidad: cant,
                precio_unitario: prod.precio_unitario,
                subtotal_linea: subLinea,
            };
            state.detalle_pedidos.push(det);
            cantidadTotal += cant;
            subtotalTotal = round2(subtotalTotal + subLinea);
        }

        const descuentoTotal = calcularDescuento(subtotalTotal, cantidadTotal);
        const totalFinal = round2(subtotalTotal - descuentoTotal);
        const pedido = {
            id: pedidoId,
            usuario_id: usr.id,
            producto_id: Number(items[0].producto_id),
            cliente_id: body.cliente_id ? Number(body.cliente_id) : null,
            cantidad: cantidadTotal,
            subtotal: subtotalTotal,
            descuento: descuentoTotal,
            total: totalFinal,
            estado: 'CONFIRMADO',
            fecha_pedido: fechaPedido,
        };
        state.pedidos.push(pedido);
        registrarAuditoria('pedidos', 'INSERT', role, null, pedido);

        return mockResp(201, {
            pedido_id: pedidoId,
            usuario_id: usr.id,
            cliente_id: pedido.cliente_id,
            cantidad_total: cantidadTotal,
            subtotal: subtotalTotal,
            descuento: descuentoTotal,
            total: totalFinal,
            estado: 'CONFIRMADO',
            fecha_pedido: fechaPedido,
            items_procesados: items.length,
            mensaje: `Pedido compuesto #${pedidoId} confirmado con COMMIT (${items.length} línea(s), total: ${totalFinal}).`,
        });
    }

    const pedCancelMatch = pathname.match(/^\/api\/v1\/pedidos\/(\d+)\/cancelar$/);
    if (pedCancelMatch && m === 'PATCH') {
        const id = Number(pedCancelMatch[1]);
        const pedido = state.pedidos.find((p) => p.id === id);
        if (!pedido) return mockResp(400, { detail: `El pedido ${id} no existe.` });
        if (pedido.estado.toUpperCase() === 'CANCELADO') {
            return mockResp(400, { detail: `El pedido ${id} ya se encuentra cancelado.` });
        }
        const prevPed = { ...pedido };
        pedido.estado = 'CANCELADO';
        registrarAuditoria('pedidos', 'UPDATE', role, prevPed, { ...pedido });

        const detalles = state.detalle_pedidos.filter((d) => d.pedido_id === id);
        let devueltas = 0;
        if (detalles.length > 0) {
            for (const d of detalles) {
                const prod = state.productos.find((p) => p.id === d.producto_id);
                if (prod) {
                    const prevP = { ...prod };
                    prod.stock += d.cantidad;
                    registrarAuditoria('productos', 'UPDATE', role, prevP, { ...prod });
                    devueltas += d.cantidad;
                }
            }
        } else {
            const prod = state.productos.find((p) => p.id === pedido.producto_id);
            if (prod) {
                prod.stock += pedido.cantidad;
                devueltas = pedido.cantidad;
            }
        }
        return mockResp(200, {
            pedido_id: id,
            mensaje: `Pedido #${id} cancelado correctamente. Se devolvieron ${devueltas} unidad(es) al inventario.`,
        });
    }

    const pedMatch = pathname.match(/^\/api\/v1\/pedidos\/(\d+)$/);
    if (pedMatch) {
        const id = Number(pedMatch[1]);
        const idx = state.pedidos.findIndex((p) => p.id === id);
        if (m === 'GET') {
            if (idx < 0) return mockResp(404, { detail: `Pedido con id=${id} no encontrado.` });
            const detalles = state.detalle_pedidos
                .filter((d) => d.pedido_id === id)
                .map((d) => {
                    const prod = state.productos.find((p) => p.id === d.producto_id) || {};
                    return { ...d, producto_codigo: prod.codigo || '', producto_nombre: prod.nombre || '' };
                });
            return mockResp(200, { ...state.pedidos[idx], detalles });
        }
        if (m === 'DELETE') {
            if (role !== 'rol_admin') return dclDenied(role, 'permission denied for table pedidos');
            if (idx < 0) return mockResp(404, { detail: `Pedido con id=${id} no encontrado.` });
            const [removed] = state.pedidos.splice(idx, 1);
            state.detalle_pedidos = state.detalle_pedidos.filter((d) => d.pedido_id !== id);
            registrarAuditoria('pedidos', 'DELETE', role, removed, null);
            return mockResp(200, { mensaje: `Pedido #${removed.id} eliminado correctamente.`, id: removed.id });
        }
    }

    // Reportes y Vistas
    if (pathname === '/api/v1/reportes/promedio-ponderado' && m === 'GET') {
        let sumPeso = 0;
        let sumValPeso = 0;
        for (const p of state.productos) {
            sumPeso += p.stock;
            sumValPeso += Number(p.precio_unitario) * p.stock;
        }
        return mockResp(200, {
            promedio_ponderado_inventario: sumPeso > 0 ? round2(sumValPeso / sumPeso) : 0,
            unidades_totales_stock: sumPeso,
        });
    }

    if (pathname === '/api/v1/reportes/ventas' && m === 'GET') {
        const fi = params.get('fecha_inicio') ? new Date(params.get('fecha_inicio')) : null;
        const ff = params.get('fecha_fin') ? new Date(params.get('fecha_fin')) : null;
        const rows = state.pedidos
            .filter((pe) => {
                const fp = new Date(pe.fecha_pedido);
                if (fi && fp < fi) return false;
                if (ff && fp > ff) return false;
                return true;
            })
            .map((pe) => {
                const usr = state.usuarios.find((u) => u.id === pe.usuario_id) || {};
                const prod = state.productos.find((p) => p.id === pe.producto_id) || {};
                return {
                    pedido_id: pe.id,
                    cliente_nombre: usr.nombre || 'Usuario',
                    producto_codigo: prod.codigo || '',
                    producto_nombre: prod.nombre || '',
                    cantidad: pe.cantidad,
                    subtotal: pe.subtotal,
                    descuento: pe.descuento,
                    total: pe.total,
                    estado: pe.estado,
                    fecha_pedido: pe.fecha_pedido,
                };
            })
            .sort((a, b) => b.pedido_id - a.pedido_id);
        return mockResp(200, rows);
    }

    if (pathname === '/api/v1/reportes/vistas/pedidos' && m === 'GET') {
        return mockResp(200, buildVwResumenPedidos(params.get('estado')));
    }
    if (pathname === '/api/v1/reportes/vistas/productos' && m === 'GET') {
        return mockResp(200, buildVwVentasPorProducto(params.get('estado_stock')));
    }
    if (pathname === '/api/v1/reportes/vistas/usuarios' && m === 'GET') {
        return mockResp(200, buildVwResumenPorUsuario());
    }

    return mockResp(404, { detail: `Ruta no soportada en modo demo: ${m} ${pathname}` });
}
