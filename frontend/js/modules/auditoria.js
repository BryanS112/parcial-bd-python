import { API_USUARIOS, setActiveRole } from '../config.js';
import { apiFetch } from '../api.js';
import { escapeHtml, formatDate, refreshIcons, renderEmptyState, showToast } from '../ui.js';

let initialized = false;

function formatDetalleJson(detalleStr) {
    try {
        const parsed = JSON.parse(detalleStr);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return detalleStr;
    }
}

function opBadge(op) {
    const map = {
        INSERT: 'bg-[#ECFDF5] text-[#047857] border-emerald-200',
        UPDATE: 'bg-[#FFFBEB] text-[#B45309] border-amber-200',
        DELETE: 'bg-[#FEF2F2] text-[#DC2626] border-red-200',
        INIT: 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200',
    };
    const cls = map[op] || 'bg-zinc-100 text-[#52525B] border-[#E4E4E7]';
    return `<span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${cls}">${escapeHtml(op)}</span>`;
}

function renderScaffold(container) {
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-xl font-bold text-[#09090B]">Auditoría en Vivo (Triggers PostgreSQL)</h2>
                    <p class="text-[13px] text-[#52525B] mt-0.5">
                        Registro inmutable generado automáticamente por <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">fn_auditar_cambios()</code>. Acceso exclusivo para <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">rol_admin</code>.
                    </p>
                </div>
                <button id="aud-refresh-btn" type="button"
                        class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-2">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-[#52525B]"></i>
                    <span>Consultar Logs</span>
                </button>
            </div>

            <!-- Estado bloqueado cuando es rol_operador -->
            <div id="aud-blocked-panel" class="hidden surface-card border-l-4 border-l-[#DC2626] bg-[#FEF2F2]/60 p-6 space-y-3">
                <div class="flex items-center gap-2.5 text-[#991B1B] font-bold text-sm">
                    <i data-lucide="shield-ban" class="w-5 h-5 text-[#DC2626] shrink-0"></i>
                    <span>Tabla <code class="font-mono-num">auditoria_logs</code> protegida por DCL (<code class="font-mono-num">REVOKE ALL</code>)</span>
                </div>
                <p class="text-[13px] text-[#7F1D1D] leading-relaxed">
                    El rol activo <code class="font-mono-num font-semibold">rol_operador</code> no tiene permiso <code class="font-mono-num">SELECT</code> sobre <code class="font-mono-num">auditoria_logs</code>. Aunque sus ventas quedan registradas en segundo plano por los triggers <code class="font-mono-num">SECURITY DEFINER</code>, no puede leer ni alterar la bitácora.
                </p>
                <button id="aud-switch-admin-btn" type="button"
                        class="btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
                    <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
                    <span>Cambiar a rol_admin para inspeccionar Auditoría</span>
                </button>
            </div>

            <!-- Resumen agrupado -->
            <div id="aud-resumen-grid" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3"></div>

            <!-- Consola / Registro Técnico de Logs -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Bitácora de Eventos PostgreSQL</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">GET /api/v1/auditoria &middot; GET /api/v1/auditoria/resumen</p>
                    </div>
                    <form id="aud-filter-form" class="flex flex-wrap items-end gap-2">
                        <div>
                            <label class="block text-[11px] font-medium text-[#52525B] mb-1">Tabla</label>
                            <select id="aud-filter-tabla" class="input-editorial text-xs py-1.5 w-auto font-mono-num">
                                <option value="">Todas</option>
                                <option value="usuarios">usuarios</option>
                                <option value="productos">productos</option>
                                <option value="pedidos">pedidos</option>
                                <option value="detalle_pedidos">detalle_pedidos</option>
                                <option value="clientes">clientes</option>
                                <option value="categorias">categorias</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-[#52525B] mb-1">Operación</label>
                            <select id="aud-filter-op" class="input-editorial text-xs py-1.5 w-auto font-mono-num">
                                <option value="">Todas</option>
                                <option value="INSERT">INSERT</option>
                                <option value="UPDATE">UPDATE</option>
                                <option value="DELETE">DELETE</option>
                                <option value="INIT">INIT</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-[#52525B] mb-1">Límite</label>
                            <select id="aud-filter-limit" class="input-editorial text-xs py-1.5 w-auto font-mono-num">
                                <option value="25">25</option>
                                <option value="50" selected>50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5">
                            <i data-lucide="filter" class="w-3.5 h-3.5"></i>
                            <span>Aplicar filtros</span>
                        </button>
                    </form>
                </div>

                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Evento</th>
                                <th class="table-th px-5 py-3">Tabla</th>
                                <th class="table-th px-5 py-3">Operación</th>
                                <th class="table-th px-5 py-3">Rol / Sesión</th>
                                <th class="table-th px-5 py-3">Payload JSON (OLD / NEW)</th>
                                <th class="table-th px-5 py-3">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody id="aud-tbody" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('aud-refresh-btn').addEventListener('click', () => loadAuditoriaData());
    document.getElementById('aud-filter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        loadAuditoriaData();
    });
    document.getElementById('aud-switch-admin-btn').addEventListener('click', () => {
        setActiveRole('rol_admin');
    });
}

async function loadAuditoriaData() {
    const blockedPanel = document.getElementById('aud-blocked-panel');
    const resumenGrid = document.getElementById('aud-resumen-grid');
    const tbody = document.getElementById('aud-tbody');

    const params = new URLSearchParams();
    const tabla = document.getElementById('aud-filter-tabla')?.value;
    const op = document.getElementById('aud-filter-op')?.value;
    const limite = document.getElementById('aud-filter-limit')?.value || '50';

    if (tabla) params.set('tabla_afectada', tabla);
    if (op) params.set('operacion', op);
    params.set('limite', limite);

    try {
        const [logs, resumen] = await Promise.all([
            apiFetch(API_USUARIOS, `/api/v1/auditoria?${params.toString()}`),
            apiFetch(API_USUARIOS, '/api/v1/auditoria/resumen'),
        ]);

        blockedPanel.classList.add('hidden');

        resumenGrid.innerHTML = resumen
            .map(
                (r) => `
            <div class="surface-card p-3">
                <p class="text-[11px] font-mono-num text-[#71717A] truncate">${escapeHtml(r.tabla_afectada)}</p>
                <div class="flex items-center justify-between mt-1.5">
                    ${opBadge(r.operacion)}
                    <span class="font-mono-num text-base font-bold text-[#09090B]">${r.total_eventos}</span>
                </div>
            </div>`
            )
            .join('');

        if (!logs.length) {
            tbody.innerHTML = renderEmptyState(6, 'terminal', 'Sin eventos para los filtros actuales', 'Ajusta los filtros de tabla u operación.');
            refreshIcons();
            return;
        }

        tbody.innerHTML = logs
            .map(
                (l) => `
            <tr class="hover:bg-[#FAFAFA] align-top transition-colors duration-150">
                <td class="px-5 py-3 font-mono-num text-xs text-[#71717A]">#${l.id}</td>
                <td class="px-5 py-3 font-mono-num text-xs font-semibold text-[#09090B]">${escapeHtml(l.tabla_afectada)}</td>
                <td class="px-5 py-3">${opBadge(l.operacion)}</td>
                <td class="px-5 py-3">
                    <span class="font-mono-num text-[11px] font-medium px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E4E4E7] text-[#09090B]">
                        ${escapeHtml(l.usuario_db)}
                    </span>
                </td>
                <td class="px-5 py-3 max-w-md">
                    <pre class="json-pre text-[11px] font-mono-num bg-[#09090B] text-zinc-100 rounded-lg p-2.5 border border-zinc-800 max-h-40 overflow-y-auto">${escapeHtml(formatDetalleJson(l.detalle))}</pre>
                </td>
                <td class="px-5 py-3 font-mono-num text-xs text-[#71717A] whitespace-nowrap">${formatDate(l.fecha_evento)}</td>
            </tr>`
            )
            .join('');
        refreshIcons();
    } catch (err) {
        if (err.isDclForbidden) {
            blockedPanel.classList.remove('hidden');
            resumenGrid.innerHTML = '';
            tbody.innerHTML = renderEmptyState(
                6,
                'lock',
                'Acceso denegado por PostgreSQL (REVOKE)',
                'Cambia al rol rol_admin en la barra superior para consultar los triggers.'
            );
            refreshIcons();
            return;
        }
        showToast(`Error cargando auditoría: ${err.message}`, 'error');
    }
}

export async function renderAuditoria(container) {
    if (!initialized) {
        renderScaffold(container);
        initialized = true;
        refreshIcons();
    }
    await loadAuditoriaData();
}
