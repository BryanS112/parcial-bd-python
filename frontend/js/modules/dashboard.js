import { API_OPERACIONES } from '../config.js';
import { apiFetch } from '../api.js';
import { escapeHtml, formatCurrency, formatDate, refreshIcons, renderEmptyState, showToast } from '../ui.js';

let loadedOnce = false;

function stockBadge(estado) {
    if (estado === 'AGOTADO') {
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num bg-[#FEF2F2] text-[#DC2626] border border-red-200"><span class="w-1.5 h-1.5 rounded-full bg-[#DC2626]"></span>AGOTADO</span>';
    }
    if (estado === 'STOCK_BAJO') {
        return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num bg-[#FFFBEB] text-[#B45309] border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>STOCK_BAJO</span>';
    }
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num bg-[#ECFDF5] text-[#047857] border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>DISPONIBLE</span>';
}

function renderScaffold(container) {
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-xl font-bold text-[#09090B]">Resumen Ejecutivo y Reportes SQL</h2>
                    <p class="text-[13px] text-[#52525B] mt-0.5">
                        Métricas calculadas en PostgreSQL mediante <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">fn_promedio_ponderado</code>, <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">fn_reporte_ventas</code> y vistas con <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">JOIN</code>.
                    </p>
                </div>
                <button id="dash-refresh-btn" type="button"
                        class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-2">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-[#52525B]"></i>
                    <span>Actualizar datos</span>
                </button>
            </div>

            <!-- KPIs -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="surface-card p-5">
                    <div class="flex items-center justify-between">
                        <span class="table-th">Ingresos Totales</span>
                        <span class="w-7 h-7 rounded-lg bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center text-[#52525B]">
                            <i data-lucide="banknote" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                    <p id="kpi-ingresos" class="font-mono-num text-2xl font-semibold text-[#09090B] mt-3 tracking-tight">—</p>
                    <p class="text-[11px] text-[#71717A] mt-1.5 font-mono-num">vw_ventas_por_producto</p>
                </div>

                <div class="surface-card p-5">
                    <div class="flex items-center justify-between">
                        <span class="table-th">Pedidos Activos</span>
                        <span class="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-blue-200 flex items-center justify-center text-[#1D4ED8]">
                            <i data-lucide="shopping-bag" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                    <p id="kpi-pedidos" class="font-mono-num text-2xl font-semibold text-[#1D4ED8] mt-3 tracking-tight">—</p>
                    <p class="text-[11px] text-[#71717A] mt-1.5 font-mono-num">vw_resumen_pedidos</p>
                </div>

                <div class="surface-card p-5">
                    <div class="flex items-center justify-between">
                        <span class="table-th">Alerta de Stock</span>
                        <span class="w-7 h-7 rounded-lg bg-[#FFFBEB] border border-amber-200 flex items-center justify-center text-[#B45309]">
                            <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                    <p id="kpi-stock-bajo" class="font-mono-num text-2xl font-semibold text-[#B45309] mt-3 tracking-tight">—</p>
                    <p class="text-[11px] text-[#71717A] mt-1.5">Productos con &le; 10 unidades</p>
                </div>

                <div class="surface-card p-5">
                    <div class="flex items-center justify-between">
                        <span class="table-th">Promedio Ponderado</span>
                        <span class="w-7 h-7 rounded-lg bg-[#ECFDF5] border border-emerald-200 flex items-center justify-center text-[#047857]">
                            <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
                        </span>
                    </div>
                    <p id="kpi-ponderado" class="font-mono-num text-2xl font-semibold text-[#047857] mt-3 tracking-tight">—</p>
                    <p id="kpi-unidades" class="text-[11px] text-[#71717A] mt-1.5 font-mono-num">fn_promedio_ponderado</p>
                </div>
            </div>

            <!-- Vista vw_ventas_por_producto -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Ventas y Estado de Inventario por Producto</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">GET /api/v1/reportes/vistas/productos &rarr; vw_ventas_por_producto</p>
                    </div>
                    <div class="w-full sm:w-56">
                        <select id="dash-filter-stock" class="input-editorial text-xs py-1.5">
                            <option value="">Todos los estados de stock</option>
                            <option value="DISPONIBLE">DISPONIBLE</option>
                            <option value="STOCK_BAJO">STOCK_BAJO</option>
                            <option value="AGOTADO">AGOTADO</option>
                        </select>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Código</th>
                                <th class="table-th px-5 py-3">Producto</th>
                                <th class="table-th px-5 py-3">Categoría</th>
                                <th class="table-th px-5 py-3 text-right">Precio Unit.</th>
                                <th class="table-th px-5 py-3 text-right">Stock</th>
                                <th class="table-th px-5 py-3">Estado</th>
                                <th class="table-th px-5 py-3 text-right">Vendidas</th>
                                <th class="table-th px-5 py-3 text-right">Ingresos</th>
                            </tr>
                        </thead>
                        <tbody id="dash-tabla-productos" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>

            <!-- Vista vw_resumen_por_usuario -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7]">
                    <h3 class="font-display text-[15px] font-bold text-[#09090B]">Productividad y Ventas por Usuario</h3>
                    <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">GET /api/v1/reportes/vistas/usuarios &rarr; vw_resumen_por_usuario</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Usuario</th>
                                <th class="table-th px-5 py-3">Email</th>
                                <th class="table-th px-5 py-3">Rol</th>
                                <th class="table-th px-5 py-3 text-right">Operaciones</th>
                                <th class="table-th px-5 py-3 text-right">Activos</th>
                                <th class="table-th px-5 py-3 text-right">Cancelados</th>
                                <th class="table-th px-5 py-3 text-right">Importe Acumulado</th>
                            </tr>
                        </thead>
                        <tbody id="dash-tabla-usuarios" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>

            <!-- Filtro de ventas por fechas (fn_reporte_ventas) -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Reporte Detallado de Ventas por Fechas</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">GET /api/v1/reportes/ventas &rarr; fn_reporte_ventas</p>
                    </div>
                    <form id="dash-fechas-form" class="flex flex-wrap items-end gap-2">
                        <div>
                            <label class="block text-[11px] font-medium text-[#52525B] mb-1">Desde</label>
                            <input id="dash-fecha-inicio" type="datetime-local" class="input-editorial text-xs py-1.5 w-auto" />
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-[#52525B] mb-1">Hasta</label>
                            <input id="dash-fecha-fin" type="datetime-local" class="input-editorial text-xs py-1.5 w-auto" />
                        </div>
                        <button type="submit" class="btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5">
                            <i data-lucide="filter" class="w-3.5 h-3.5"></i>
                            <span>Filtrar</span>
                        </button>
                        <button id="dash-limpiar-fechas" type="button" class="btn-secondary px-3 py-1.5 text-xs">
                            Limpiar
                        </button>
                    </form>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Pedido</th>
                                <th class="table-th px-5 py-3">Gestor</th>
                                <th class="table-th px-5 py-3">Producto</th>
                                <th class="table-th px-5 py-3 text-right">Cant.</th>
                                <th class="table-th px-5 py-3 text-right">Descuento</th>
                                <th class="table-th px-5 py-3 text-right">Total</th>
                                <th class="table-th px-5 py-3">Estado</th>
                                <th class="table-th px-5 py-3">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody id="dash-tabla-ventas-fecha" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('dash-refresh-btn').addEventListener('click', () => loadDashboardData());
    document.getElementById('dash-filter-stock').addEventListener('change', () => loadProductosVista());
    document.getElementById('dash-fechas-form').addEventListener('submit', (e) => {
        e.preventDefault();
        loadVentasPorFecha();
    });
    document.getElementById('dash-limpiar-fechas').addEventListener('click', () => {
        document.getElementById('dash-fecha-inicio').value = '';
        document.getElementById('dash-fecha-fin').value = '';
        loadVentasPorFecha();
    });
}

async function loadProductosVista() {
    const filtro = document.getElementById('dash-filter-stock')?.value || '';
    const query = filtro ? `?estado_stock=${encodeURIComponent(filtro)}` : '';
    const productos = await apiFetch(API_OPERACIONES, `/api/v1/reportes/vistas/productos${query}`);

    const tbody = document.getElementById('dash-tabla-productos');
    if (!productos.length) {
        tbody.innerHTML = renderEmptyState(8, 'package-search', 'Sin productos en este estado', 'Ajusta el filtro de stock o registra nuevos artículos en Inventario.');
        refreshIcons();
        return;
    }

    tbody.innerHTML = productos
        .map(
            (p) => `
        <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
            <td class="px-5 py-3 font-mono-num text-xs font-semibold text-[#09090B]">${escapeHtml(p.codigo)}</td>
            <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(p.producto_nombre)}</td>
            <td class="px-5 py-3 text-[#52525B]">${escapeHtml(p.categoria_nombre)}</td>
            <td class="px-5 py-3 text-right font-mono-num text-[#52525B]">${formatCurrency(p.precio_unitario)}</td>
            <td class="px-5 py-3 text-right font-mono-num font-semibold text-[#09090B]">${p.stock_actual}</td>
            <td class="px-5 py-3">${stockBadge(p.estado_stock)}</td>
            <td class="px-5 py-3 text-right font-mono-num text-[#52525B]">${p.unidades_vendidas}</td>
            <td class="px-5 py-3 text-right font-mono-num font-semibold text-[#09090B]">${formatCurrency(p.ingresos_totales)}</td>
        </tr>`
        )
        .join('');
    refreshIcons();
    return productos;
}

async function loadVentasPorFecha() {
    const ini = document.getElementById('dash-fecha-inicio')?.value;
    const fin = document.getElementById('dash-fecha-fin')?.value;
    const params = new URLSearchParams();
    if (ini) params.set('fecha_inicio', `${ini}:00`);
    if (fin) params.set('fecha_fin', `${fin}:59`);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const ventas = await apiFetch(API_OPERACIONES, `/api/v1/reportes/ventas${qs}`);
    const tbody = document.getElementById('dash-tabla-ventas-fecha');

    if (!ventas.length) {
        tbody.innerHTML = renderEmptyState(8, 'calendar-x', 'Sin ventas en el rango seleccionado', 'Prueba ampliando el filtro de fechas o registra un pedido.');
        refreshIcons();
        return;
    }

    tbody.innerHTML = ventas
        .map(
            (v) => `
        <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
            <td class="px-5 py-3 font-mono-num font-semibold text-[#1D4ED8]">#${v.pedido_id}</td>
            <td class="px-5 py-3 text-[#09090B]">${escapeHtml(v.cliente_nombre)}</td>
            <td class="px-5 py-3">
                <span class="font-mono-num text-xs text-[#71717A] mr-1.5">${escapeHtml(v.producto_codigo)}</span>
                <span class="font-medium text-[#09090B]">${escapeHtml(v.producto_nombre)}</span>
            </td>
            <td class="px-5 py-3 text-right font-mono-num">${v.cantidad}</td>
            <td class="px-5 py-3 text-right font-mono-num text-[#047857]">${formatCurrency(v.descuento)}</td>
            <td class="px-5 py-3 text-right font-mono-num font-semibold text-[#09090B]">${formatCurrency(v.total)}</td>
            <td class="px-5 py-3">
                <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${
                    v.estado === 'CANCELADO'
                        ? 'bg-[#FEF2F2] text-[#DC2626] border-red-200'
                        : 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                }">${escapeHtml(v.estado)}</span>
            </td>
            <td class="px-5 py-3 font-mono-num text-xs text-[#71717A]">${formatDate(v.fecha_pedido)}</td>
        </tr>`
        )
        .join('');
    refreshIcons();
}

async function loadDashboardData() {
    try {
        const [ponderado, todosProductos, usuariosVista, pedidosVista] = await Promise.all([
            apiFetch(API_OPERACIONES, '/api/v1/reportes/promedio-ponderado'),
            apiFetch(API_OPERACIONES, '/api/v1/reportes/vistas/productos'),
            apiFetch(API_OPERACIONES, '/api/v1/reportes/vistas/usuarios'),
            apiFetch(API_OPERACIONES, '/api/v1/reportes/vistas/pedidos'),
        ]);

        const ingresosTotales = todosProductos.reduce(
            (acc, p) => acc + Number(p.ingresos_totales || 0),
            0
        );
        const stockBajo = todosProductos.filter(
            (p) => p.estado_stock === 'STOCK_BAJO' || p.estado_stock === 'AGOTADO'
        ).length;
        const pedidosActivos = pedidosVista.filter((p) => p.estado !== 'CANCELADO').length;

        document.getElementById('kpi-ingresos').textContent = formatCurrency(ingresosTotales);
        document.getElementById('kpi-pedidos').textContent = `${pedidosActivos} / ${pedidosVista.length}`;
        document.getElementById('kpi-stock-bajo').textContent = `${stockBajo} prod.`;
        document.getElementById('kpi-ponderado').textContent = formatCurrency(
            ponderado.promedio_ponderado_inventario
        );
        document.getElementById('kpi-unidades').textContent = `${ponderado.unidades_totales_stock} unidades totales`;

        const tbodyUsr = document.getElementById('dash-tabla-usuarios');
        tbodyUsr.innerHTML = usuariosVista.length
            ? usuariosVista
                  .map(
                      (u) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(u.usuario_nombre)}</td>
                <td class="px-5 py-3 text-[#52525B]">${escapeHtml(u.email)}</td>
                <td class="px-5 py-3"><span class="font-mono-num text-xs px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E4E4E7] text-[#09090B]">${escapeHtml(u.rol)}</span></td>
                <td class="px-5 py-3 text-right font-mono-num">${u.total_operaciones}</td>
                <td class="px-5 py-3 text-right font-mono-num text-[#047857] font-semibold">${u.pedidos_activos}</td>
                <td class="px-5 py-3 text-right font-mono-num text-[#DC2626]">${u.pedidos_cancelados}</td>
                <td class="px-5 py-3 text-right font-mono-num font-semibold text-[#09090B]">${formatCurrency(u.importe_acumulado)}</td>
            </tr>`
                  )
                  .join('')
            : renderEmptyState(7, 'users', 'Sin actividad de usuarios');

        await Promise.all([loadProductosVista(), loadVentasPorFecha()]);
    } catch (err) {
        if (!err.isDclForbidden) {
            showToast(`Error cargando dashboard: ${err.message}`, 'error');
        }
    }
}

export async function renderDashboard(container) {
    if (!loadedOnce) {
        renderScaffold(container);
        loadedOnce = true;
        refreshIcons();
    }
    await loadDashboardData();
}
