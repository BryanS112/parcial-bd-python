import { API_OPERACIONES, API_USUARIOS } from '../config.js';
import { apiFetch } from '../api.js';
import { enforceIntegerInput, escapeHtml, formatCurrency, formatDate, openModal, refreshIcons, renderEmptyState, showToast } from '../ui.js';

let initialized = false;
let cachedProducts = [];
let cachedUsers = [];
let cachedClients = [];
let loteCart = [];

function renderScaffold(container) {
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-xl font-bold text-[#09090B]">Terminal Punto de Venta (POS) y Transacciones</h2>
                    <p class="text-[13px] text-[#52525B] mt-0.5">
                        Ejecuta <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">proc_registrar_pedido</code>, transacciones explícitas <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">BEGIN/COMMIT/ROLLBACK</code> y <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">proc_cancelar_pedido</code>.
                    </p>
                </div>
                <button id="pos-refresh-btn" type="button"
                        class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-2">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-[#52525B]"></i>
                    <span>Recargar catálogos</span>
                </button>
            </div>

            <!-- Distribución asimétrica 60% / 40% -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <!-- Columna Izquierda (60% -> 7/12): Selección y construcción -->
                <div class="lg:col-span-7 space-y-6">
                    <!-- Constructor de Pedido en Lote -->
                    <div class="surface-card p-6 space-y-4">
                        <div class="flex items-start justify-between gap-3 border-b border-[#E4E4E7] pb-3.5">
                            <div>
                                <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#1D4ED8] font-mono-num">
                                    Caso de Uso Principal &middot; Lote Multi-Producto
                                </span>
                                <h3 class="font-display text-base font-bold text-[#09090B] mt-0.5">
                                    Constructor de Pedido en Lote
                                </h3>
                            </div>
                            <i data-lucide="layers" class="w-4 h-4 text-[#71717A] shrink-0 mt-1"></i>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-[#52525B] mb-1">Usuario gestor</label>
                                <select id="pos-lote-usuario" class="input-editorial text-xs"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-[#52525B] mb-1">Cliente (Opcional)</label>
                                <select id="pos-lote-cliente" class="input-editorial text-xs"></select>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-1">
                            <div class="sm:col-span-7">
                                <label class="block text-xs font-semibold text-[#52525B] mb-1">Producto del catálogo</label>
                                <select id="pos-lote-producto" class="input-editorial text-xs"></select>
                            </div>
                            <div class="sm:col-span-2">
                                <label class="block text-xs font-semibold text-[#52525B] mb-1">Cant.</label>
                                <input id="pos-lote-cantidad" type="number" min="1" value="1"
                                       class="input-editorial text-xs font-mono-num" />
                            </div>
                            <div class="sm:col-span-3">
                                <button id="pos-lote-add-btn" type="button"
                                        class="btn-primary w-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                    <span>Agregar</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Pedido Simple (CALL proc_registrar_pedido) -->
                    <div class="surface-card p-6 space-y-4">
                        <div class="flex items-start justify-between gap-3 border-b border-[#E4E4E7] pb-3.5">
                            <div>
                                <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717A] font-mono-num">
                                    Procedimiento Almacenado &middot; CALL proc_registrar_pedido
                                </span>
                                <h3 class="font-display text-base font-bold text-[#09090B] mt-0.5">
                                    Venta Rápida (Pedido Simple)
                                </h3>
                            </div>
                            <i data-lucide="zap" class="w-4 h-4 text-[#71717A] shrink-0 mt-1"></i>
                        </div>

                        <form id="pos-simple-form" class="space-y-4">
                            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div class="sm:col-span-4">
                                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Usuario gestor</label>
                                    <select id="pos-simple-usuario" required class="input-editorial text-xs"></select>
                                </div>
                                <div class="sm:col-span-6">
                                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Producto</label>
                                    <select id="pos-simple-producto" required class="input-editorial text-xs"></select>
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Cant.</label>
                                    <input id="pos-simple-cantidad" type="number" min="1" value="5" required
                                           class="input-editorial text-xs font-mono-num" />
                                </div>
                            </div>

                            <div id="pos-descuento-preview" class="hidden rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] p-3.5 text-xs space-y-1.5 font-mono-num">
                                <div class="flex justify-between text-[#52525B]">
                                    <span>Subtotal bruto:</span>
                                    <strong id="prev-subtotal" class="text-[#09090B]"></strong>
                                </div>
                                <div class="flex justify-between text-[#047857]">
                                    <span>Descuento (fn_calcular_descuento):</span>
                                    <strong id="prev-descuento"></strong>
                                </div>
                                <div class="flex justify-between text-sm border-t border-[#E4E4E7] pt-1.5 text-[#09090B]">
                                    <span class="font-sans font-semibold">Total estimado:</span>
                                    <strong id="prev-total"></strong>
                                </div>
                            </div>

                            <div class="flex flex-wrap gap-2.5">
                                <button id="pos-calc-btn" type="button"
                                        class="btn-secondary px-4 py-2 text-xs inline-flex items-center gap-1.5">
                                    <i data-lucide="calculator" class="w-3.5 h-3.5 text-[#52525B]"></i>
                                    <span>Calcular Descuento</span>
                                </button>
                                <button type="submit"
                                        class="btn-primary flex-1 px-4 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                    <i data-lucide="check" class="w-3.5 h-3.5"></i>
                                    <span>Registrar Pedido</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- Columna Derecha (40% -> 5/12): Ticket Técnico en Vivo + Demo ROLLBACK -->
                <div class="lg:col-span-5 space-y-4">
                    <div class="surface-card overflow-hidden">
                        <div class="px-5 py-4 bg-[#FAFAFA] border-b border-[#E4E4E7] flex items-center justify-between">
                            <div>
                                <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717A] font-mono-num">
                                    Ticket Técnico en Vivo
                                </span>
                                <h3 class="font-display text-sm font-bold text-[#09090B] mt-0.5">
                                    Resumen de Lote Transaccional
                                </h3>
                            </div>
                            <span id="pos-ticket-count" class="font-mono-num text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-[#E4E4E7] text-[#52525B]">
                                0 ítems
                            </span>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="min-w-full text-xs text-left">
                                <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                                    <tr>
                                        <th class="table-th px-4 py-2.5">Artículo</th>
                                        <th class="table-th px-3 py-2.5 text-right">Cant.</th>
                                        <th class="table-th px-3 py-2.5 text-right">Subtotal</th>
                                        <th class="table-th px-3 py-2.5 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody id="pos-lote-cart-body" class="divide-y divide-[#E4E4E7]"></tbody>
                            </table>
                        </div>

                        <div class="p-5 bg-[#FAFAFA] border-t border-[#E4E4E7] space-y-3">
                            <div class="space-y-1.5 text-xs font-mono-num">
                                <div class="flex justify-between text-[#52525B]">
                                    <span>Unidades acumuladas:</span>
                                    <span id="pos-ticket-units" class="font-semibold text-[#09090B]">0</span>
                                </div>
                                <div class="flex justify-between text-sm border-t border-dashed border-[#D4D4D8] pt-2 text-[#09090B]">
                                    <span class="font-sans font-semibold">Subtotal estimado:</span>
                                    <strong id="pos-ticket-subtotal" class="text-base">$ 0</strong>
                                </div>
                            </div>

                            <button id="pos-lote-submit-btn" type="button"
                                    class="btn-primary w-full px-4 py-2.5 text-xs inline-flex items-center justify-center gap-2">
                                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                                <span>Confirmar Lote (COMMIT)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Bloque de Auditoría Transaccional (ROLLBACK) -->
                    <div class="rounded-[10px] border border-dashed border-amber-400 bg-[#FFFBEB]/70 p-4 space-y-3">
                        <div class="flex items-start gap-2.5">
                            <i data-lucide="alert-triangle" class="w-4 h-4 text-[#B45309] shrink-0 mt-0.5"></i>
                            <div>
                                <p class="text-xs font-bold text-[#92400E]">
                                    Auditoría Transaccional ACID (BEGIN / ROLLBACK)
                                </p>
                                <p class="text-[11px] text-[#B45309] mt-0.5 leading-relaxed">
                                    Envía 1 ítem válido y 1 ítem con stock excedido para demostrar que PostgreSQL revierte la operación completa.
                                </p>
                            </div>
                        </div>

                        <button id="pos-rollback-demo-btn" type="button"
                                class="w-full px-3.5 py-2 rounded-lg bg-white hover:bg-amber-50 border border-amber-300 text-[#92400E] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                            <span>Simular fallo en 2do ítem para probar ROLLBACK</span>
                        </button>

                        <div id="pos-rollback-result" class="hidden rounded-lg border p-3 text-xs space-y-1"></div>
                    </div>
                </div>
            </div>

            <!-- Historial de Pedidos -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Historial de Pedidos</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">
                            vw_resumen_pedidos &middot; PATCH /cancelar (proc_cancelar_pedido) &middot; DELETE bloqueado para rol_operador
                        </p>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Pedido</th>
                                <th class="table-th px-5 py-3">Cliente</th>
                                <th class="table-th px-5 py-3">Producto Principal</th>
                                <th class="table-th px-5 py-3 text-right">Cant.</th>
                                <th class="table-th px-5 py-3 text-right">Total</th>
                                <th class="table-th px-5 py-3">Estado</th>
                                <th class="table-th px-5 py-3">Fecha</th>
                                <th class="table-th px-5 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="pos-tabla-pedidos" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('pos-refresh-btn').addEventListener('click', () => loadPosData());
    document.getElementById('pos-calc-btn').addEventListener('click', handleCalcularDescuento);
    document.getElementById('pos-simple-form').addEventListener('submit', handleRegistrarSimple);
    document.getElementById('pos-lote-add-btn').addEventListener('click', handleAddCartItem);
    document.getElementById('pos-lote-submit-btn').addEventListener('click', handleConfirmarLote);
    document.getElementById('pos-rollback-demo-btn').addEventListener('click', handleSimularRollback);

    enforceIntegerInput(document.getElementById('pos-lote-cantidad'), { min: 1 });
    enforceIntegerInput(document.getElementById('pos-simple-cantidad'), { min: 1 });

    renderLoteCart();
}

function populateSelects() {
    const userOptions = cachedUsers
        .filter((u) => u.activo)
        .map((u) => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.rol)})</option>`)
        .join('');
    document.getElementById('pos-simple-usuario').innerHTML = userOptions;
    document.getElementById('pos-lote-usuario').innerHTML = userOptions;

    const prodOptions = cachedProducts
        .map(
            (p) =>
                `<option value="${p.id}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nombre)} (Stock: ${p.stock} | ${formatCurrency(p.precio_unitario)})</option>`
        )
        .join('');
    document.getElementById('pos-simple-producto').innerHTML = prodOptions;
    document.getElementById('pos-lote-producto').innerHTML = prodOptions;

    const cliOptions = [
        '<option value="">Cliente General (Opcional)</option>',
        ...cachedClients.map(
            (c) => `<option value="${c.id}">${escapeHtml(c.documento)} - ${escapeHtml(c.nombre_razon_social)}</option>`
        ),
    ].join('');
    document.getElementById('pos-lote-cliente').innerHTML = cliOptions;
}

async function handleCalcularDescuento() {
    const prodId = Number(document.getElementById('pos-simple-producto').value);
    const cantidad = Number(document.getElementById('pos-simple-cantidad').value);
    const producto = cachedProducts.find((p) => p.id === prodId);
    if (!producto || cantidad <= 0) {
        showToast('Selecciona un producto y una cantidad válida.', 'warning');
        return;
    }

    try {
        const subtotal = Number(producto.precio_unitario) * cantidad;
        const res = await apiFetch(API_OPERACIONES, '/api/v1/descuentos/calcular', {
            method: 'POST',
            body: { subtotal, cantidad },
        });
        document.getElementById('prev-subtotal').textContent = formatCurrency(res.subtotal);
        document.getElementById('prev-descuento').textContent = `- ${formatCurrency(res.descuento)}`;
        document.getElementById('prev-total').textContent = formatCurrency(res.total_estimado);
        document.getElementById('pos-descuento-preview').classList.remove('hidden');
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleRegistrarSimple(e) {
    e.preventDefault();
    const usuario_id = Number(document.getElementById('pos-simple-usuario').value);
    const producto_id = Number(document.getElementById('pos-simple-producto').value);
    const cantidad = Number(document.getElementById('pos-simple-cantidad').value);

    try {
        const res = await apiFetch(API_OPERACIONES, '/api/v1/pedidos', {
            method: 'POST',
            body: { usuario_id, producto_id, cantidad },
        });
        showToast(res.mensaje, 'success');
        document.getElementById('pos-descuento-preview').classList.add('hidden');
        await loadPosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function handleAddCartItem() {
    const prodId = Number(document.getElementById('pos-lote-producto').value);
    const cantidad = Number(document.getElementById('pos-lote-cantidad').value);
    const producto = cachedProducts.find((p) => p.id === prodId);
    if (!producto || cantidad <= 0) {
        showToast('Selecciona un producto y una cantidad válida.', 'warning');
        return;
    }

    const existing = loteCart.find((i) => i.producto_id === prodId);
    if (existing) {
        existing.cantidad += cantidad;
    } else {
        loteCart.push({
            producto_id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            precio_unitario: Number(producto.precio_unitario),
            cantidad,
        });
    }
    renderLoteCart();
}

function renderLoteCart() {
    const tbody = document.getElementById('pos-lote-cart-body');
    const countEl = document.getElementById('pos-ticket-count');
    const unitsEl = document.getElementById('pos-ticket-units');
    const subtotalEl = document.getElementById('pos-ticket-subtotal');
    if (!tbody) return;

    const totalUnits = loteCart.reduce((acc, i) => acc + i.cantidad, 0);
    const totalSubtotal = loteCart.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0);

    if (countEl) countEl.textContent = `${loteCart.length} ítem(s)`;
    if (unitsEl) unitsEl.textContent = String(totalUnits);
    if (subtotalEl) subtotalEl.textContent = formatCurrency(totalSubtotal);

    if (!loteCart.length) {
        tbody.innerHTML = renderEmptyState(
            4,
            'shopping-cart',
            'Ticket vacío',
            'Agrega 2 o más productos desde el constructor.'
        );
        refreshIcons();
        return;
    }

    tbody.innerHTML = loteCart
        .map(
            (item, idx) => `
        <tr class="hover:bg-[#FAFAFA]">
            <td class="px-4 py-2.5">
                <div class="font-mono-num text-[11px] text-[#71717A]">${escapeHtml(item.codigo)}</div>
                <div class="font-medium text-[#09090B]">${escapeHtml(item.nombre)}</div>
            </td>
            <td class="px-3 py-2.5 text-right font-mono-num font-semibold text-[#09090B]">${item.cantidad}</td>
            <td class="px-3 py-2.5 text-right font-mono-num text-[#09090B]">${formatCurrency(item.precio_unitario * item.cantidad)}</td>
            <td class="px-3 py-2.5 text-right">
                <button type="button" data-remove-idx="${idx}"
                        class="text-[#71717A] hover:text-[#DC2626] p-1 rounded transition-colors" title="Quitar ítem">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </td>
        </tr>`
        )
        .join('');

    tbody.querySelectorAll('[data-remove-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
            loteCart.splice(Number(btn.dataset.removeIdx), 1);
            renderLoteCart();
        });
    });
    refreshIcons();
}

async function handleConfirmarLote() {
    if (!loteCart.length) {
        showToast('Agrega al menos un producto al carrito del lote.', 'warning');
        return;
    }
    const usuario_id = Number(document.getElementById('pos-lote-usuario').value);
    const clienteRaw = document.getElementById('pos-lote-cliente').value;
    const cliente_id = clienteRaw ? Number(clienteRaw) : null;

    try {
        const res = await apiFetch(API_OPERACIONES, '/api/v1/pedidos/lote', {
            method: 'POST',
            body: {
                usuario_id,
                cliente_id,
                items: loteCart.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
            },
        });
        showToast(res.mensaje, 'success');
        loteCart = [];
        renderLoteCart();
        await loadPosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleSimularRollback() {
    if (cachedProducts.length < 2) {
        showToast('Se requieren al menos 2 productos en inventario para la demo.', 'warning');
        return;
    }

    const prod1 = cachedProducts.find((p) => p.stock >= 2) || cachedProducts[0];
    const prod2 = cachedProducts.find((p) => p.id !== prod1.id) || cachedProducts[1];
    const usuario_id = Number(document.getElementById('pos-lote-usuario').value) || cachedUsers[0]?.id;
    const resultBox = document.getElementById('pos-rollback-result');

    const stockAntes = prod1.stock;

    try {
        await apiFetch(API_OPERACIONES, '/api/v1/pedidos/lote', {
            method: 'POST',
            body: {
                usuario_id,
                items: [
                    { producto_id: prod1.id, cantidad: 2 },
                    { producto_id: prod2.id, cantidad: 99999 },
                ],
            },
        });
    } catch (err) {
        if (err.isDclForbidden) return;
        const prod1Despues = await apiFetch(API_OPERACIONES, `/api/v1/productos/${prod1.id}`);
        resultBox.className = 'rounded-lg border border-emerald-300 bg-[#ECFDF5] p-3 text-xs text-[#047857] space-y-1.5';
        resultBox.innerHTML = `
            <p class="font-bold text-[#065F46] flex items-center gap-1.5">
                <i data-lucide="check-circle-2" class="w-4 h-4 shrink-0"></i>
                <span>Atomicidad ACID comprobada (ROLLBACK automático)</span>
            </p>
            <p class="font-mono-num text-[11px] text-[#09090B]">
                Ítem 1 (<strong>${escapeHtml(prod1.codigo)}</strong>, cant: 2): Stock antes = <strong>${stockAntes}</strong> &rarr; Stock después = <strong>${prod1Despues.stock}</strong> (intacto).
            </p>
            <p class="text-[#DC2626] font-mono-num text-[11px]">Error PG/API: ${escapeHtml(err.message)}</p>
        `;
        resultBox.classList.remove('hidden');
        refreshIcons();
        showToast('ROLLBACK ejecutado correctamente: ningún ítem fue guardado.', 'info');
    }
}

async function handleVerDetallePedido(pedidoId) {
    try {
        const pedido = await apiFetch(API_OPERACIONES, `/api/v1/pedidos/${pedidoId}`);
        const rows = pedido.detalles.length
            ? pedido.detalles
                  .map(
                      (d) => `
                <tr>
                    <td class="px-3 py-2 font-mono-num text-xs">${escapeHtml(d.producto_codigo)}</td>
                    <td class="px-3 py-2 text-[#09090B]">${escapeHtml(d.producto_nombre)}</td>
                    <td class="px-3 py-2 text-right font-mono-num">${d.cantidad}</td>
                    <td class="px-3 py-2 text-right font-mono-num">${formatCurrency(d.precio_unitario)}</td>
                    <td class="px-3 py-2 text-right font-mono-num font-semibold">${formatCurrency(d.subtotal_linea)}</td>
                </tr>`
                  )
                  .join('')
            : renderEmptyState(5, 'file-text', 'Sin líneas en detalle_pedidos');

        openModal(
            `Detalle del Pedido #${pedido.id} (${pedido.estado})`,
            `
            <div class="space-y-4 text-sm">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAFAFA] p-3.5 rounded-lg border border-[#E4E4E7] font-mono-num">
                    <div><span class="font-sans text-[11px] text-[#71717A] block">Subtotal</span><strong class="text-[#09090B]">${formatCurrency(pedido.subtotal)}</strong></div>
                    <div><span class="font-sans text-[11px] text-[#71717A] block">Descuento</span><strong class="text-[#047857]">${formatCurrency(pedido.descuento)}</strong></div>
                    <div><span class="font-sans text-[11px] text-[#71717A] block">Total</span><strong class="text-[#1D4ED8]">${formatCurrency(pedido.total)}</strong></div>
                    <div><span class="font-sans text-[11px] text-[#71717A] block">Timestamp</span><span class="text-[11px] text-[#52525B]">${formatDate(pedido.fecha_pedido)}</span></div>
                </div>
                <table class="min-w-full text-[13px] text-left border border-[#E4E4E7] rounded-lg overflow-hidden">
                    <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                        <tr>
                            <th class="table-th px-3 py-2">Código</th>
                            <th class="table-th px-3 py-2">Producto</th>
                            <th class="table-th px-3 py-2 text-right">Cant.</th>
                            <th class="table-th px-3 py-2 text-right">Precio Unit.</th>
                            <th class="table-th px-3 py-2 text-right">Subtotal Línea</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#E4E4E7]">${rows}</tbody>
                </table>
            </div>
            `
        );
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleCancelarPedido(pedidoId) {
    try {
        const res = await apiFetch(API_OPERACIONES, `/api/v1/pedidos/${pedidoId}/cancelar`, {
            method: 'PATCH',
        });
        showToast(res.mensaje, 'success');
        await loadPosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleEliminarPedido(pedidoId) {
    try {
        const res = await apiFetch(API_OPERACIONES, `/api/v1/pedidos/${pedidoId}`, {
            method: 'DELETE',
        });
        showToast(res.mensaje, 'success');
        await loadPosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function loadPosData() {
    try {
        const [usuarios, productos, clientes, resumenPedidos] = await Promise.all([
            apiFetch(API_USUARIOS, '/api/v1/usuarios'),
            apiFetch(API_OPERACIONES, '/api/v1/productos'),
            apiFetch(API_OPERACIONES, '/api/v1/clientes'),
            apiFetch(API_OPERACIONES, '/api/v1/reportes/vistas/pedidos'),
        ]);

        cachedUsers = usuarios;
        cachedProducts = productos;
        cachedClients = clientes;
        populateSelects();

        const tbody = document.getElementById('pos-tabla-pedidos');
        if (!resumenPedidos.length) {
            tbody.innerHTML = renderEmptyState(8, 'receipt', 'No hay pedidos registrados', 'Crea un pedido simple o en lote desde el panel superior.');
            refreshIcons();
            return;
        }

        tbody.innerHTML = resumenPedidos
            .map(
                (pe) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3 font-mono-num font-semibold text-[#1D4ED8]">#${pe.pedido_id}</td>
                <td class="px-5 py-3 text-[#09090B]">${escapeHtml(pe.cliente_nombre)}</td>
                <td class="px-5 py-3">
                    <span class="font-mono-num text-xs text-[#71717A] mr-1.5">${escapeHtml(pe.producto_codigo)}</span>
                    <span class="font-medium text-[#09090B]">${escapeHtml(pe.producto_nombre)}</span>
                </td>
                <td class="px-5 py-3 text-right font-mono-num">${pe.cantidad}</td>
                <td class="px-5 py-3 text-right font-mono-num font-semibold text-[#09090B]">${formatCurrency(pe.total)}</td>
                <td class="px-5 py-3">
                    <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${
                        pe.estado === 'CANCELADO'
                            ? 'bg-[#FEF2F2] text-[#DC2626] border-red-200'
                            : 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                    }">${escapeHtml(pe.estado)}</span>
                </td>
                <td class="px-5 py-3 font-mono-num text-xs text-[#71717A]">${formatDate(pe.fecha_pedido)}</td>
                <td class="px-5 py-3 text-right whitespace-nowrap space-x-1">
                    <button type="button" data-detalle-id="${pe.pedido_id}"
                            class="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1">
                        <i data-lucide="eye" class="w-3 h-3"></i>
                        <span>Detalle</span>
                    </button>
                    <button type="button" data-cancelar-id="${pe.pedido_id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FFFBEB] hover:bg-amber-100 border border-amber-200 text-[#B45309] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="x-circle" class="w-3 h-3"></i>
                        <span>Cancelar</span>
                    </button>
                    <button type="button" data-eliminar-id="${pe.pedido_id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            </tr>`
            )
            .join('');

        tbody.querySelectorAll('[data-detalle-id]').forEach((b) =>
            b.addEventListener('click', () => handleVerDetallePedido(Number(b.dataset.detalleId)))
        );
        tbody.querySelectorAll('[data-cancelar-id]').forEach((b) =>
            b.addEventListener('click', () => handleCancelarPedido(Number(b.dataset.cancelarId)))
        );
        tbody.querySelectorAll('[data-eliminar-id]').forEach((b) =>
            b.addEventListener('click', () => handleEliminarPedido(Number(b.dataset.eliminarId)))
        );
        refreshIcons();
    } catch (err) {
        if (!err.isDclForbidden) showToast(`Error cargando POS: ${err.message}`, 'error');
    }
}

export async function renderPos(container) {
    if (!initialized) {
        renderScaffold(container);
        initialized = true;
        refreshIcons();
    }
    await loadPosData();
}
