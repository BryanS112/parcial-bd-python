import { API_OPERACIONES, API_USUARIOS, getActiveRole, setActiveRole } from './config.js';
import { setConnectionMode } from './api.js';
import { initGlobalModals, refreshIcons, showToast } from './ui.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderPos } from './modules/pos.js';
import { renderInventario } from './modules/inventario.js';
import { renderClientesUsuarios } from './modules/clientes_usuarios.js';
import { renderAuditoria } from './modules/auditoria.js';

const TAB_HANDLERS = {
    dashboard: renderDashboard,
    pos: renderPos,
    inventario: renderInventario,
    'clientes-usuarios': renderClientesUsuarios,
    auditoria: renderAuditoria,
};

const TAB_TITLES = {
    dashboard: 'Dashboard y Reportes',
    pos: 'Punto de Venta y Transacciones',
    inventario: 'Inventario y Categorías',
    'clientes-usuarios': 'Clientes y Usuarios',
    auditoria: 'Auditoría en Vivo',
};

let currentTab = 'dashboard';

function updateRoleUI() {
    const role = getActiveRole();
    const selector = document.getElementById('global-role-selector');
    const badge = document.getElementById('role-badge');
    const shell = document.getElementById('workspace-shell');

    if (selector && selector.value !== role) {
        selector.value = role;
    }

    document.querySelectorAll('[data-role-option]').forEach((btn) => {
        const isSelected = btn.dataset.roleOption === role;
        if (isSelected) {
            btn.className =
                'role-pill px-3 py-1 rounded-full text-xs font-semibold font-mono-num bg-white text-[#09090B] shadow-sm border border-[#E4E4E7] transition-all duration-150';
        } else {
            btn.className =
                'role-pill px-3 py-1 rounded-full text-xs font-medium font-mono-num text-[#71717A] hover:text-[#09090B] border border-transparent transition-all duration-150';
        }
    });

    if (badge) {
        if (role === 'rol_admin') {
            badge.className =
                'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-emerald-200 transition-colors duration-150';
            badge.innerHTML =
                '<span class="w-1.5 h-1.5 rounded-full bg-[#059669]"></span><span>Acceso Total &middot; PostgreSQL</span>';
        } else {
            badge.className =
                'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFFBEB] text-[#B45309] border border-amber-200 transition-colors duration-150';
            badge.innerHTML =
                '<span class="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span><span>Acceso Restringido &middot; DCL Activo</span>';
        }
    }

    if (shell) {
        shell.style.borderTop =
            role === 'rol_admin' ? '2px solid #059669' : '2px solid #D97706';
    }
}

function toggleMobileSidebar(forceOpen) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const shouldOpen =
        typeof forceOpen === 'boolean'
            ? forceOpen
            : sidebar.classList.contains('-translate-x-full');

    if (shouldOpen) {
        sidebar.classList.remove('-translate-x-full');
        backdrop.classList.remove('hidden');
    } else {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
    }
}

async function activateTab(tabName) {
    if (!TAB_HANDLERS[tabName]) return;
    currentTab = tabName;

    const topbarTitle = document.getElementById('topbar-module-title');
    if (topbarTitle) {
        topbarTitle.textContent = TAB_TITLES[tabName] || 'TechCore Store';
    }

    document.querySelectorAll('.nav-tab').forEach((btn) => {
        const isActive = btn.dataset.tab === tabName;
        btn.className = isActive
            ? 'nav-tab w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] transition-colors duration-150 text-left'
            : 'nav-tab w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#52525B] hover:text-[#09090B] hover:bg-zinc-100 transition-colors duration-150 text-left';
    });

    Object.keys(TAB_HANDLERS).forEach((key) => {
        const sec = document.getElementById(`tab-${key}`);
        if (!sec) return;
        if (key === tabName) {
            sec.classList.remove('hidden');
        } else {
            sec.classList.add('hidden');
        }
    });

    toggleMobileSidebar(false);

    const target = document.getElementById(`tab-${tabName}`);
    await TAB_HANDLERS[tabName](target);
    refreshIcons();
}

function updateConnectionBadge(mode) {
    const badge = document.getElementById('connection-mode-badge');
    if (!badge) return;

    if (mode === 'live') {
        badge.className =
            'hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#ECFDF5] text-[#047857] border border-emerald-200 transition-colors duration-150';
        badge.innerHTML =
            '<span class="w-1.5 h-1.5 rounded-full bg-[#059669]"></span><span>PostgreSQL Conectado</span>';
    } else if (mode === 'demo') {
        badge.className =
            'hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 transition-colors duration-150';
        badge.innerHTML =
            '<span class="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]"></span><span>Modo Demo (Sin backend local)</span>';
    }
}

async function checkServiceHealth(baseUrl, elementId, label) {
    const el = document.getElementById(elementId);
    if (!el) return false;
    try {
        const res = await fetch(`${baseUrl}/health`);
        if (res.ok) {
            el.innerHTML = `
                <span class="inline-flex items-center gap-1.5 text-[#09090B]">
                    <span class="w-2 h-2 rounded-full bg-[#059669]"></span> ${label}
                </span>
                <span class="text-[10px] font-semibold text-[#047857]">OK</span>
            `;
            return true;
        }
    } catch {
        // Sin conexión al servicio local
    }
    el.innerHTML = `
        <span class="inline-flex items-center gap-1.5 text-[#52525B]">
            <span class="w-2 h-2 rounded-full bg-[#1D4ED8]"></span> ${label}
        </span>
        <span class="text-[10px] font-semibold text-[#1D4ED8]">Demo</span>
    `;
    return false;
}

function initApp() {
    initGlobalModals();
    updateRoleUI();
    refreshIcons();

    window.addEventListener('techcore:connection-mode', (e) => {
        updateConnectionBadge(e.detail?.mode);
    });

    const roleSelect = document.getElementById('global-role-selector');
    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            setActiveRole(e.target.value);
            showToast(`Rol activo cambiado a ${e.target.value}`, 'info');
        });
    }

    document.querySelectorAll('[data-role-option]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextRole = btn.dataset.roleOption;
            if (nextRole !== getActiveRole()) {
                setActiveRole(nextRole);
                showToast(`Rol activo cambiado a ${nextRole}`, 'info');
            }
        });
    });

    window.addEventListener('techcore:role-changed', () => {
        updateRoleUI();
        activateTab(currentTab);
    });

    document.querySelectorAll('.nav-tab').forEach((btn) => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => toggleMobileSidebar());
    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => toggleMobileSidebar(false));

    Promise.all([
        checkServiceHealth(API_USUARIOS, 'status-ms-8001', ':8001 Usuarios'),
        checkServiceHealth(API_OPERACIONES, 'status-ms-8002', ':8002 Operaciones'),
    ]).then(([ok1, ok2]) => {
        setConnectionMode(ok1 && ok2 ? 'live' : 'demo');
    });

    activateTab('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
