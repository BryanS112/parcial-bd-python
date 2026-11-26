import { API_OPERACIONES } from '../config.js';
import { apiFetch } from '../api.js';
import { closeModal, enforceDecimalInput, enforceIntegerInput, escapeHtml, formatCurrency, openModal, refreshIcons, renderEmptyState, showToast } from '../ui.js';

let initialized = false;
let categoriasCache = [];
let productosCache = [];

function renderScaffold(container) {
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-xl font-bold text-[#09090B]">Inventario: Productos y Categorías</h2>
                    <p class="text-[13px] text-[#52525B] mt-0.5">
                        CRUD completo sobre PostgreSQL. Las operaciones <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">DELETE</code> o cambios en categorías bajo <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">rol_operador</code> disparan <code class="text-xs text-[#DC2626]">403 Forbidden</code>.
                    </p>
                </div>
                <button id="inv-refresh-btn" type="button"
                        class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-2">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-[#52525B]"></i>
                    <span>Actualizar inventario</span>
                </button>
            </div>

            <!-- Sección Productos -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Catálogo de Productos</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">GET / POST / PUT / DELETE &rarr; /api/v1/productos</p>
                    </div>
                </div>

                <!-- Panel colapsable para crear producto -->
                <details open class="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <summary class="px-5 py-3 cursor-pointer flex items-center justify-between text-xs font-semibold text-[#09090B] hover:bg-zinc-100/70 transition-colors duration-150">
                        <span class="inline-flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4 text-[#1D4ED8]"></i>
                            <span>Registrar Nuevo Producto</span>
                        </span>
                        <span class="text-[11px] font-normal text-[#71717A]">Mostrar / Ocultar formulario</span>
                    </summary>
                    <form id="inv-prod-form" class="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Código único</label>
                            <input id="inv-prod-codigo" type="text" required placeholder="PROD-005"
                                   class="input-editorial text-xs font-mono-num" />
                        </div>
                        <div class="lg:col-span-3">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre del producto</label>
                            <input id="inv-prod-nombre" type="text" required placeholder="SSD NVMe 1TB"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Precio Unit.</label>
                            <input id="inv-prod-precio" type="number" step="0.01" min="0.01" required placeholder="350.00"
                                   class="input-editorial text-xs font-mono-num" />
                        </div>
                        <div class="lg:col-span-1">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Stock</label>
                            <input id="inv-prod-stock" type="number" min="0" required value="10"
                                   class="input-editorial text-xs font-mono-num" />
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Categoría</label>
                            <select id="inv-prod-cat" class="input-editorial text-xs"></select>
                        </div>
                        <div class="lg:col-span-2">
                            <button type="submit" class="btn-primary w-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                <span>Crear Producto</span>
                            </button>
                        </div>
                    </form>
                </details>

                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Código</th>
                                <th class="table-th px-5 py-3">Nombre</th>
                                <th class="table-th px-5 py-3">Categoría</th>
                                <th class="table-th px-5 py-3 text-right">Precio</th>
                                <th class="table-th px-5 py-3 text-right">Stock</th>
                                <th class="table-th px-5 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="inv-prod-tbody" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>

            <!-- Sección Categorías -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7] flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 class="font-display text-[15px] font-bold text-[#09090B]">Categorías de Hardware</h3>
                        <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">Creación y edición restringidas a rol_admin en PostgreSQL</p>
                    </div>
                </div>

                <details class="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <summary class="px-5 py-3 cursor-pointer flex items-center justify-between text-xs font-semibold text-[#09090B] hover:bg-zinc-100/70 transition-colors duration-150">
                        <span class="inline-flex items-center gap-2">
                            <i data-lucide="folder-plus" class="w-4 h-4 text-[#1D4ED8]"></i>
                            <span>Nueva Categoría (Requiere rol_admin)</span>
                        </span>
                        <span class="text-[11px] font-normal text-[#71717A]">Desplegar formulario</span>
                    </summary>
                    <form id="inv-cat-form" class="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div class="sm:col-span-4">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre</label>
                            <input id="inv-cat-nombre" type="text" required placeholder="Redes y Conectividad"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="sm:col-span-6">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Descripción</label>
                            <input id="inv-cat-desc" type="text" placeholder="Switches, routers y cableado"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="sm:col-span-2">
                            <button type="submit" class="btn-primary w-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                <span>Crear Categoría</span>
                            </button>
                        </div>
                    </form>
                </details>

                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">ID</th>
                                <th class="table-th px-5 py-3">Nombre</th>
                                <th class="table-th px-5 py-3">Descripción</th>
                                <th class="table-th px-5 py-3">Estado</th>
                                <th class="table-th px-5 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="inv-cat-tbody" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('inv-refresh-btn').addEventListener('click', () => loadInventarioData());
    document.getElementById('inv-prod-form').addEventListener('submit', handleCrearProducto);
    document.getElementById('inv-cat-form').addEventListener('submit', handleCrearCategoria);
    enforceDecimalInput(document.getElementById('inv-prod-precio'), { min: 0.01, step: 0.01 });
    enforceIntegerInput(document.getElementById('inv-prod-stock'), { min: 0 });
}

function getCategoryName(catId) {
    if (!catId) return 'Sin categoría';
    const found = categoriasCache.find((c) => c.id === catId);
    return found ? found.nombre : `#${catId}`;
}

async function handleCrearProducto(e) {
    e.preventDefault();
    const codigo = document.getElementById('inv-prod-codigo').value.trim();
    const nombre = document.getElementById('inv-prod-nombre').value.trim();
    const precio = Number(document.getElementById('inv-prod-precio').value);
    const stock = Number(document.getElementById('inv-prod-stock').value);
    const catVal = document.getElementById('inv-prod-cat').value;

    if (codigo.length < 2 || nombre.length < 2) {
        showToast('Código y nombre deben tener al menos 2 caracteres válidos.', 'warning');
        return;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
        showToast('El precio unitario debe ser mayor a 0.', 'warning');
        return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
        showToast('El stock debe ser un número entero mayor o igual a 0.', 'warning');
        return;
    }

    try {
        await apiFetch(API_OPERACIONES, '/api/v1/productos', {
            method: 'POST',
            body: {
                codigo,
                nombre,
                precio_unitario: precio,
                stock,
                categoria_id: catVal ? Number(catVal) : null,
            },
        });
        showToast('Producto creado correctamente.', 'success');
        e.target.reset();
        await loadInventarioData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function openEditarProductoModal(prod) {
    const catOptions = [
        '<option value="">Sin categoría</option>',
        ...categoriasCache.map(
            (c) => `<option value="${c.id}" ${c.id === prod.categoria_id ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`
        ),
    ].join('');

    openModal(
        `Editar Producto ${prod.codigo}`,
        `
        <form id="modal-edit-prod-form" class="space-y-4">
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Código</label>
                <input id="edit-prod-codigo" type="text" required value="${escapeHtml(prod.codigo)}"
                       class="input-editorial font-mono-num" />
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre</label>
                <input id="edit-prod-nombre" type="text" required value="${escapeHtml(prod.nombre)}"
                       class="input-editorial" />
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Precio Unitario</label>
                    <input id="edit-prod-precio" type="number" step="0.01" min="0.01" required value="${prod.precio_unitario}"
                           class="input-editorial font-mono-num" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Stock</label>
                    <input id="edit-prod-stock" type="number" step="1" min="0" required value="${prod.stock}"
                           class="input-editorial font-mono-num" />
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Categoría</label>
                <select id="edit-prod-cat" class="input-editorial">${catOptions}</select>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="edit-prod-cancel" class="btn-secondary px-4 py-2 text-xs">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 text-xs">Guardar cambios</button>
            </div>
        </form>
        `
    );

    enforceDecimalInput(document.getElementById('edit-prod-precio'), { min: 0.01, step: 0.01 });
    enforceIntegerInput(document.getElementById('edit-prod-stock'), { min: 0 });
    document.getElementById('edit-prod-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-edit-prod-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const codigo = document.getElementById('edit-prod-codigo').value.trim();
        const nombre = document.getElementById('edit-prod-nombre').value.trim();
        const precio = Number(document.getElementById('edit-prod-precio').value);
        const stock = Number(document.getElementById('edit-prod-stock').value);
        const catVal = document.getElementById('edit-prod-cat').value;

        if (codigo.length < 2 || nombre.length < 2) {
            showToast('Código y nombre deben tener al menos 2 caracteres válidos.', 'warning');
            return;
        }
        if (!Number.isFinite(precio) || precio <= 0) {
            showToast('El precio unitario debe ser mayor a 0.', 'warning');
            return;
        }
        if (!Number.isInteger(stock) || stock < 0) {
            showToast('El stock debe ser un número entero mayor o igual a 0.', 'warning');
            return;
        }

        try {
            await apiFetch(API_OPERACIONES, `/api/v1/productos/${prod.id}`, {
                method: 'PUT',
                body: {
                    codigo,
                    nombre,
                    precio_unitario: precio,
                    stock,
                    categoria_id: catVal ? Number(catVal) : null,
                },
            });
            closeModal();
            showToast('Producto actualizado.', 'success');
            await loadInventarioData();
        } catch (err) {
            if (!err.isDclForbidden) showToast(err.message, 'error');
        }
    });
}

async function handleEliminarProducto(prodId) {
    try {
        const res = await apiFetch(API_OPERACIONES, `/api/v1/productos/${prodId}`, { method: 'DELETE' });
        showToast(res.mensaje, 'success');
        await loadInventarioData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleCrearCategoria(e) {
    e.preventDefault();
    try {
        await apiFetch(API_OPERACIONES, '/api/v1/categorias', {
            method: 'POST',
            body: {
                nombre: document.getElementById('inv-cat-nombre').value.trim(),
                descripcion: document.getElementById('inv-cat-desc').value.trim() || null,
                activo: true,
            },
        });
        showToast('Categoría creada correctamente.', 'success');
        e.target.reset();
        await loadInventarioData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function openEditarCategoriaModal(cat) {
    openModal(
        `Editar Categoría #${cat.id}`,
        `
        <form id="modal-edit-cat-form" class="space-y-4">
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre</label>
                <input id="edit-cat-nombre" type="text" required value="${escapeHtml(cat.nombre)}"
                       class="input-editorial" />
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Descripción</label>
                <textarea id="edit-cat-desc" rows="2" class="input-editorial">${escapeHtml(cat.descripcion || '')}</textarea>
            </div>
            <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#09090B]">
                <input id="edit-cat-activo" type="checkbox" ${cat.activo ? 'checked' : ''} class="rounded border-[#D4D4D8]" />
                Categoría activa
            </label>
            <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="edit-cat-cancel" class="btn-secondary px-4 py-2 text-xs">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 text-xs">Guardar</button>
            </div>
        </form>
        `
    );

    document.getElementById('edit-cat-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-edit-cat-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
            await apiFetch(API_OPERACIONES, `/api/v1/categorias/${cat.id}`, {
                method: 'PUT',
                body: {
                    nombre: document.getElementById('edit-cat-nombre').value.trim(),
                    descripcion: document.getElementById('edit-cat-desc').value.trim() || null,
                    activo: document.getElementById('edit-cat-activo').checked,
                },
            });
            closeModal();
            showToast('Categoría actualizada.', 'success');
            await loadInventarioData();
        } catch (err) {
            if (!err.isDclForbidden) showToast(err.message, 'error');
        }
    });
}

async function handleEliminarCategoria(catId) {
    try {
        const res = await apiFetch(API_OPERACIONES, `/api/v1/categorias/${catId}`, { method: 'DELETE' });
        showToast(res.mensaje, 'success');
        await loadInventarioData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function loadInventarioData() {
    try {
        const [productos, categorias] = await Promise.all([
            apiFetch(API_OPERACIONES, '/api/v1/productos'),
            apiFetch(API_OPERACIONES, '/api/v1/categorias'),
        ]);
        productosCache = productos;
        categoriasCache = categorias;

        document.getElementById('inv-prod-cat').innerHTML = [
            '<option value="">Sin categoría</option>',
            ...categorias.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`),
        ].join('');

        const prodTbody = document.getElementById('inv-prod-tbody');
        prodTbody.innerHTML = productos.length
            ? productos
                  .map(
                      (p) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3 font-mono-num text-xs font-semibold text-[#09090B]">${escapeHtml(p.codigo)}</td>
                <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(p.nombre)}</td>
                <td class="px-5 py-3 text-[#52525B]">${escapeHtml(getCategoryName(p.categoria_id))}</td>
                <td class="px-5 py-3 text-right font-mono-num text-[#52525B]">${formatCurrency(p.precio_unitario)}</td>
                <td class="px-5 py-3 text-right font-mono-num font-semibold ${p.stock <= 10 ? 'text-[#B45309]' : 'text-[#09090B]'}">${p.stock}</td>
                <td class="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button type="button" data-edit-prod="${p.id}"
                            class="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                        <span>Editar</span>
                    </button>
                    <button type="button" data-del-prod="${p.id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            </tr>`
                  )
                  .join('')
            : renderEmptyState(6, 'package-open', 'No hay productos registrados');

        prodTbody.querySelectorAll('[data-edit-prod]').forEach((b) =>
            b.addEventListener('click', () => {
                const prod = productosCache.find((x) => x.id === Number(b.dataset.editProd));
                if (prod) openEditarProductoModal(prod);
            })
        );
        prodTbody.querySelectorAll('[data-del-prod]').forEach((b) =>
            b.addEventListener('click', () => handleEliminarProducto(Number(b.dataset.delProd)))
        );

        const catTbody = document.getElementById('inv-cat-tbody');
        catTbody.innerHTML = categorias.length
            ? categorias
                  .map(
                      (c) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3 font-mono-num text-xs text-[#71717A]">#${c.id}</td>
                <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(c.nombre)}</td>
                <td class="px-5 py-3 text-[#52525B] text-xs">${escapeHtml(c.descripcion || '—')}</td>
                <td class="px-5 py-3">
                    <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${
                        c.activo
                            ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                            : 'bg-zinc-100 text-[#52525B] border-[#E4E4E7]'
                    }">${c.activo ? 'ACTIVA' : 'INACTIVA'}</span>
                </td>
                <td class="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button type="button" data-edit-cat="${c.id}"
                            class="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                        <span>Editar</span>
                    </button>
                    <button type="button" data-del-cat="${c.id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            </tr>`
                  )
                  .join('')
            : renderEmptyState(5, 'folder', 'No hay categorías registradas');

        catTbody.querySelectorAll('[data-edit-cat]').forEach((b) =>
            b.addEventListener('click', () => {
                const cat = categoriasCache.find((x) => x.id === Number(b.dataset.editCat));
                if (cat) openEditarCategoriaModal(cat);
            })
        );
        catTbody.querySelectorAll('[data-del-cat]').forEach((b) =>
            b.addEventListener('click', () => handleEliminarCategoria(Number(b.dataset.delCat)))
        );
        refreshIcons();
    } catch (err) {
        if (!err.isDclForbidden) showToast(`Error cargando inventario: ${err.message}`, 'error');
    }
}

export async function renderInventario(container) {
    if (!initialized) {
        renderScaffold(container);
        initialized = true;
        refreshIcons();
    }
    await loadInventarioData();
}
