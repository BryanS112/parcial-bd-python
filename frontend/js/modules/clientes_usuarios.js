import { API_OPERACIONES, API_USUARIOS } from '../config.js';
import { apiFetch } from '../api.js';
import { closeModal, enforceDigitsOnlyInput, escapeHtml, isValidDigits, isValidEmail, openModal, refreshIcons, renderEmptyState, showToast } from '../ui.js';

let initialized = false;
let clientesCache = [];
let usuariosCache = [];

function renderScaffold(container) {
    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-xl font-bold text-[#09090B]">Clientes y Usuarios del Sistema</h2>
                    <p class="text-[13px] text-[#52525B] mt-0.5">
                        Especializaciones disjuntas del MERE: <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">NATURAL / JURIDICA</code> en clientes y <code class="text-xs bg-zinc-100 px-1.5 py-0.5 rounded border border-[#E4E4E7]">rol_admin / rol_operador</code> en usuarios.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="cu-test-login-btn" type="button"
                            class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
                        <i data-lucide="key-round" class="w-3.5 h-3.5 text-[#52525B]"></i>
                        <span>Probar Login</span>
                    </button>
                    <button id="cu-refresh-btn" type="button"
                            class="btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-[#52525B]"></i>
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            <!-- SECCIÓN CLIENTES -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7]">
                    <h3 class="font-display text-[15px] font-bold text-[#09090B]">Directorio de Clientes</h3>
                    <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">MS-8002 &rarr; /api/v1/clientes (DELETE bloqueado para rol_operador)</p>
                </div>

                <details open class="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <summary class="px-5 py-3 cursor-pointer flex items-center justify-between text-xs font-semibold text-[#09090B] hover:bg-zinc-100/70 transition-colors duration-150">
                        <span class="inline-flex items-center gap-2">
                            <i data-lucide="user-plus" class="w-4 h-4 text-[#1D4ED8]"></i>
                            <span>Registrar Nuevo Cliente</span>
                        </span>
                        <span class="text-[11px] font-normal text-[#71717A]">Mostrar / Ocultar formulario</span>
                    </summary>
                    <form id="cu-cli-form" class="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Tipo (MERE)</label>
                            <select id="cu-cli-tipo" class="input-editorial text-xs">
                                <option value="NATURAL">NATURAL</option>
                                <option value="JURIDICA">JURIDICA</option>
                            </select>
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Documento / NIT</label>
                            <input id="cu-cli-doc" type="text" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="15" required placeholder="1045000111"
                                   class="input-editorial text-xs font-mono-num" />
                        </div>
                        <div class="lg:col-span-3">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre o Razón Social</label>
                            <input id="cu-cli-nombre" type="text" required placeholder="Nombre completo o empresa"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Email</label>
                            <input id="cu-cli-email" type="email" placeholder="cliente@correo.co"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-1">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Teléfono</label>
                            <input id="cu-cli-tel" type="text" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="15" placeholder="3001234567"
                                   class="input-editorial text-xs font-mono-num" />
                        </div>
                        <div class="lg:col-span-2">
                            <button type="submit" class="btn-primary w-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                <span>Crear Cliente</span>
                            </button>
                        </div>
                    </form>
                </details>

                <div class="overflow-x-auto">
                    <table class="min-w-full text-[13px] text-left">
                        <thead class="bg-[#FAFAFA] border-b border-[#E4E4E7]">
                            <tr>
                                <th class="table-th px-5 py-3">Tipo</th>
                                <th class="table-th px-5 py-3">Documento</th>
                                <th class="table-th px-5 py-3">Nombre / Razón Social</th>
                                <th class="table-th px-5 py-3">Contacto</th>
                                <th class="table-th px-5 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="cu-cli-tbody" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>

            <!-- SECCIÓN USUARIOS -->
            <div class="surface-card overflow-hidden">
                <div class="px-5 py-4 border-b border-[#E4E4E7]">
                    <h3 class="font-display text-[15px] font-bold text-[#09090B]">Usuarios y Roles del Sistema</h3>
                    <p class="text-xs text-[#71717A] mt-0.5 font-mono-num">MS-8001 &rarr; /api/v1/usuarios (Creación, edición y borrado requieren rol_admin)</p>
                </div>

                <details class="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <summary class="px-5 py-3 cursor-pointer flex items-center justify-between text-xs font-semibold text-[#09090B] hover:bg-zinc-100/70 transition-colors duration-150">
                        <span class="inline-flex items-center gap-2">
                            <i data-lucide="shield-plus" class="w-4 h-4 text-[#1D4ED8]"></i>
                            <span>Registrar Nuevo Usuario (Requiere rol_admin)</span>
                        </span>
                        <span class="text-[11px] font-normal text-[#71717A]">Desplegar formulario</span>
                    </summary>
                    <form id="cu-usr-form" class="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                        <div class="lg:col-span-3">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre completo</label>
                            <input id="cu-usr-nombre" type="text" required placeholder="Laura Gómez"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-3">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Correo electrónico</label>
                            <input id="cu-usr-email" type="email" required placeholder="laura@empresa.edu"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Contraseña</label>
                            <input id="cu-usr-pass" type="password" required minlength="6" placeholder="Mín. 6 chars"
                                   class="input-editorial text-xs" />
                        </div>
                        <div class="lg:col-span-2">
                            <label class="block text-xs font-semibold text-[#52525B] mb-1">Rol asignado</label>
                            <select id="cu-usr-rol" class="input-editorial text-xs font-mono-num">
                                <option value="rol_operador">rol_operador</option>
                                <option value="rol_admin">rol_admin</option>
                            </select>
                        </div>
                        <div class="lg:col-span-2">
                            <button type="submit" class="btn-primary w-full px-3 py-2 text-xs inline-flex items-center justify-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                <span>Registrar Usuario</span>
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
                                <th class="table-th px-5 py-3">Email</th>
                                <th class="table-th px-5 py-3">Rol</th>
                                <th class="table-th px-5 py-3">Estado</th>
                                <th class="table-th px-5 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="cu-usr-tbody" class="divide-y divide-[#E4E4E7]"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('cu-refresh-btn').addEventListener('click', () => loadClientesUsuariosData());
    document.getElementById('cu-cli-form').addEventListener('submit', handleCrearCliente);
    document.getElementById('cu-usr-form').addEventListener('submit', handleCrearUsuario);
    document.getElementById('cu-test-login-btn').addEventListener('click', openLoginModal);
    enforceDigitsOnlyInput(document.getElementById('cu-cli-doc'), { minLength: 6, maxLength: 15 });
    enforceDigitsOnlyInput(document.getElementById('cu-cli-tel'), { minLength: 6, maxLength: 15 });
}

async function handleCrearCliente(e) {
    e.preventDefault();
    const documento = document.getElementById('cu-cli-doc').value.trim();
    const nombre_razon_social = document.getElementById('cu-cli-nombre').value.trim();
    const email = document.getElementById('cu-cli-email').value.trim();
    const telefono = document.getElementById('cu-cli-tel').value.trim();

    if (!isValidDigits(documento, 6, 15)) {
        showToast('El documento debe tener entre 6 y 15 dígitos numéricos.', 'warning');
        return;
    }
    if (nombre_razon_social.length < 2) {
        showToast('El nombre o razón social debe tener al menos 2 caracteres válidos.', 'warning');
        return;
    }
    if (email && !isValidEmail(email)) {
        showToast('Ingresa un correo electrónico válido.', 'warning');
        return;
    }
    if (telefono && !isValidDigits(telefono, 6, 15)) {
        showToast('El teléfono debe tener entre 6 y 15 dígitos numéricos.', 'warning');
        return;
    }

    try {
        await apiFetch(API_OPERACIONES, '/api/v1/clientes', {
            method: 'POST',
            body: {
                tipo_cliente: document.getElementById('cu-cli-tipo').value,
                documento,
                nombre_razon_social,
                email: email || null,
                telefono: telefono || null,
            },
        });
        showToast('Cliente registrado correctamente.', 'success');
        e.target.reset();
        await loadClientesUsuariosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function openEditarClienteModal(cli) {
    openModal(
        `Editar Cliente ${cli.documento}`,
        `
        <form id="modal-edit-cli-form" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Tipo</label>
                    <select id="edit-cli-tipo" class="input-editorial">
                        <option value="NATURAL" ${cli.tipo_cliente === 'NATURAL' ? 'selected' : ''}>NATURAL</option>
                        <option value="JURIDICA" ${cli.tipo_cliente === 'JURIDICA' ? 'selected' : ''}>JURIDICA</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Documento</label>
                    <input id="edit-cli-doc" type="text" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="15" required value="${escapeHtml(cli.documento)}"
                           class="input-editorial font-mono-num" />
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre / Razón Social</label>
                <input id="edit-cli-nombre" type="text" required value="${escapeHtml(cli.nombre_razon_social)}"
                       class="input-editorial" />
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Email</label>
                    <input id="edit-cli-email" type="email" value="${escapeHtml(cli.email || '')}"
                           class="input-editorial" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-[#52525B] mb-1">Teléfono</label>
                    <input id="edit-cli-tel" type="text" inputmode="numeric" pattern="[0-9]*" minlength="6" maxlength="15" value="${escapeHtml(cli.telefono || '')}"
                           class="input-editorial font-mono-num" />
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="edit-cli-cancel" class="btn-secondary px-4 py-2 text-xs">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 text-xs">Guardar</button>
            </div>
        </form>
        `
    );

    enforceDigitsOnlyInput(document.getElementById('edit-cli-doc'), { minLength: 6, maxLength: 15 });
    enforceDigitsOnlyInput(document.getElementById('edit-cli-tel'), { minLength: 6, maxLength: 15 });
    document.getElementById('edit-cli-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-edit-cli-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const documento = document.getElementById('edit-cli-doc').value.trim();
        const nombre_razon_social = document.getElementById('edit-cli-nombre').value.trim();
        const email = document.getElementById('edit-cli-email').value.trim();
        const telefono = document.getElementById('edit-cli-tel').value.trim();

        if (!isValidDigits(documento, 6, 15)) {
            showToast('El documento debe tener entre 6 y 15 dígitos numéricos.', 'warning');
            return;
        }
        if (nombre_razon_social.length < 2) {
            showToast('El nombre o razón social debe tener al menos 2 caracteres válidos.', 'warning');
            return;
        }
        if (email && !isValidEmail(email)) {
            showToast('Ingresa un correo electrónico válido.', 'warning');
            return;
        }
        if (telefono && !isValidDigits(telefono, 6, 15)) {
            showToast('El teléfono debe tener entre 6 y 15 dígitos numéricos.', 'warning');
            return;
        }

        try {
            await apiFetch(API_OPERACIONES, `/api/v1/clientes/${cli.id}`, {
                method: 'PUT',
                body: {
                    tipo_cliente: document.getElementById('edit-cli-tipo').value,
                    documento,
                    nombre_razon_social,
                    email: email || null,
                    telefono: telefono || null,
                },
            });
            closeModal();
            showToast('Cliente actualizado.', 'success');
            await loadClientesUsuariosData();
        } catch (err) {
            if (!err.isDclForbidden) showToast(err.message, 'error');
        }
    });
}

async function handleEliminarCliente(cliId) {
    try {
        const res = await apiFetch(API_OPERACIONES, `/api/v1/clientes/${cliId}`, { method: 'DELETE' });
        showToast(res.mensaje, 'success');
        await loadClientesUsuariosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

async function handleCrearUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById('cu-usr-nombre').value.trim();
    const email = document.getElementById('cu-usr-email').value.trim();
    const password = document.getElementById('cu-usr-pass').value;

    if (nombre.length < 2) {
        showToast('El nombre debe tener al menos 2 caracteres válidos.', 'warning');
        return;
    }
    if (!isValidEmail(email)) {
        showToast('Ingresa un correo electrónico válido.', 'warning');
        return;
    }
    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.', 'warning');
        return;
    }

    try {
        await apiFetch(API_USUARIOS, '/api/v1/usuarios', {
            method: 'POST',
            body: {
                nombre,
                email,
                password,
                rol: document.getElementById('cu-usr-rol').value,
            },
        });
        showToast('Usuario creado correctamente.', 'success');
        e.target.reset();
        await loadClientesUsuariosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function openEditarUsuarioModal(usr) {
    openModal(
        `Editar Usuario #${usr.id}`,
        `
        <form id="modal-edit-usr-form" class="space-y-4">
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Nombre</label>
                <input id="edit-usr-nombre" type="text" required value="${escapeHtml(usr.nombre)}"
                       class="input-editorial" />
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Rol</label>
                <select id="edit-usr-rol" class="input-editorial font-mono-num">
                    <option value="rol_operador" ${usr.rol === 'rol_operador' ? 'selected' : ''}>rol_operador</option>
                    <option value="rol_admin" ${usr.rol === 'rol_admin' ? 'selected' : ''}>rol_admin</option>
                </select>
            </div>
            <label class="inline-flex items-center gap-2 text-xs font-semibold text-[#09090B]">
                <input id="edit-usr-activo" type="checkbox" ${usr.activo ? 'checked' : ''} class="rounded border-[#D4D4D8]" />
                Usuario activo
            </label>
            <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="edit-usr-cancel" class="btn-secondary px-4 py-2 text-xs">Cancelar</button>
                <button type="submit" class="btn-primary px-4 py-2 text-xs">Guardar</button>
            </div>
        </form>
        `
    );

    document.getElementById('edit-usr-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-edit-usr-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
            await apiFetch(API_USUARIOS, `/api/v1/usuarios/${usr.id}`, {
                method: 'PUT',
                body: {
                    nombre: document.getElementById('edit-usr-nombre').value.trim(),
                    rol: document.getElementById('edit-usr-rol').value,
                    activo: document.getElementById('edit-usr-activo').checked,
                },
            });
            closeModal();
            showToast('Usuario actualizado.', 'success');
            await loadClientesUsuariosData();
        } catch (err) {
            if (!err.isDclForbidden) showToast(err.message, 'error');
        }
    });
}

async function handleEliminarUsuario(usrId) {
    try {
        const res = await apiFetch(API_USUARIOS, `/api/v1/usuarios/${usrId}`, { method: 'DELETE' });
        showToast(res.mensaje, 'success');
        await loadClientesUsuariosData();
    } catch (err) {
        if (!err.isDclForbidden) showToast(err.message, 'error');
    }
}

function openLoginModal() {
    openModal(
        'Probar Autenticación (POST /api/v1/auth/login)',
        `
        <form id="modal-login-form" class="space-y-4">
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Email</label>
                <input id="login-email" type="email" required value="admin@empresa.edu"
                       class="input-editorial" />
            </div>
            <div>
                <label class="block text-xs font-semibold text-[#52525B] mb-1">Contraseña</label>
                <input id="login-pass" type="password" required value="admin123"
                       class="input-editorial" />
            </div>
            <div id="login-result" class="hidden rounded-lg p-3 text-xs font-mono-num"></div>
            <div class="flex justify-end gap-2">
                <button type="button" id="login-cancel" class="btn-secondary px-4 py-2 text-xs">Cerrar</button>
                <button type="submit" class="btn-primary px-4 py-2 text-xs">Autenticar</button>
            </div>
        </form>
        `
    );

    document.getElementById('login-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-login-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const box = document.getElementById('login-result');
        try {
            const res = await apiFetch(API_USUARIOS, '/api/v1/auth/login', {
                method: 'POST',
                body: {
                    email: document.getElementById('login-email').value.trim(),
                    password: document.getElementById('login-pass').value,
                },
            });
            box.className = 'rounded-lg p-3 text-xs font-mono-num bg-[#ECFDF5] border border-emerald-200 text-[#047857]';
            box.textContent = JSON.stringify(res, null, 2);
            box.classList.remove('hidden');
        } catch (err) {
            box.className = 'rounded-lg p-3 text-xs font-mono-num bg-[#FEF2F2] border border-red-200 text-[#DC2626]';
            box.textContent = err.message;
            box.classList.remove('hidden');
        }
    });
}

async function loadClientesUsuariosData() {
    try {
        const [clientes, usuarios] = await Promise.all([
            apiFetch(API_OPERACIONES, '/api/v1/clientes'),
            apiFetch(API_USUARIOS, '/api/v1/usuarios'),
        ]);
        clientesCache = clientes;
        usuariosCache = usuarios;

        const cliTbody = document.getElementById('cu-cli-tbody');
        cliTbody.innerHTML = clientes.length
            ? clientes
                  .map(
                      (c) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3">
                    <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${
                        c.tipo_cliente === 'JURIDICA'
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border-blue-200'
                            : 'bg-zinc-100 text-[#09090B] border-[#E4E4E7]'
                    }">${escapeHtml(c.tipo_cliente)}</span>
                </td>
                <td class="px-5 py-3 font-mono-num text-xs font-semibold text-[#09090B]">${escapeHtml(c.documento)}</td>
                <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(c.nombre_razon_social)}</td>
                <td class="px-5 py-3 text-xs text-[#52525B]">
                    <div>${escapeHtml(c.email || '—')}</div>
                    <div class="font-mono-num text-[#71717A]">${escapeHtml(c.telefono || '—')}</div>
                </td>
                <td class="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button type="button" data-edit-cli="${c.id}"
                            class="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                        <span>Editar</span>
                    </button>
                    <button type="button" data-del-cli="${c.id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            </tr>`
                  )
                  .join('')
            : renderEmptyState(5, 'users', 'Sin clientes registrados');

        cliTbody.querySelectorAll('[data-edit-cli]').forEach((b) =>
            b.addEventListener('click', () => {
                const cli = clientesCache.find((x) => x.id === Number(b.dataset.editCli));
                if (cli) openEditarClienteModal(cli);
            })
        );
        cliTbody.querySelectorAll('[data-del-cli]').forEach((b) =>
            b.addEventListener('click', () => handleEliminarCliente(Number(b.dataset.delCli)))
        );

        const usrTbody = document.getElementById('cu-usr-tbody');
        usrTbody.innerHTML = usuarios.length
            ? usuarios
                  .map(
                      (u) => `
            <tr class="hover:bg-[#FAFAFA] transition-colors duration-150">
                <td class="px-5 py-3 font-mono-num text-xs text-[#71717A]">#${u.id}</td>
                <td class="px-5 py-3 font-medium text-[#09090B]">${escapeHtml(u.nombre)}</td>
                <td class="px-5 py-3 text-[#52525B]">${escapeHtml(u.email)}</td>
                <td class="px-5 py-3">
                    <span class="font-mono-num text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E4E4E7] text-[#09090B]">
                        ${escapeHtml(u.rol)}
                    </span>
                </td>
                <td class="px-5 py-3">
                    <span class="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono-num border ${
                        u.activo
                            ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                            : 'bg-[#FEF2F2] text-[#DC2626] border-red-200'
                    }">${u.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                </td>
                <td class="px-5 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button type="button" data-edit-usr="${u.id}"
                            class="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1">
                        <i data-lucide="pencil" class="w-3 h-3"></i>
                        <span>Editar</span>
                    </button>
                    <button type="button" data-del-usr="${u.id}"
                            class="px-2.5 py-1 rounded-lg bg-[#FEF2F2] hover:bg-red-100 border border-red-200 text-[#DC2626] text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-150">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                        <span>Eliminar</span>
                    </button>
                </td>
            </tr>`
                  )
                  .join('')
            : renderEmptyState(6, 'user-x', 'Sin usuarios registrados');

        usrTbody.querySelectorAll('[data-edit-usr]').forEach((b) =>
            b.addEventListener('click', () => {
                const usr = usuariosCache.find((x) => x.id === Number(b.dataset.editUsr));
                if (usr) openEditarUsuarioModal(usr);
            })
        );
        usrTbody.querySelectorAll('[data-del-usr]').forEach((b) =>
            b.addEventListener('click', () => handleEliminarUsuario(Number(b.dataset.delUsr)))
        );
        refreshIcons();
    } catch (err) {
        if (!err.isDclForbidden) showToast(`Error cargando clientes/usuarios: ${err.message}`, 'error');
    }
}

export async function renderClientesUsuarios(container) {
    if (!initialized) {
        renderScaffold(container);
        initialized = true;
        refreshIcons();
    }
    await loadClientesUsuariosData();
}
