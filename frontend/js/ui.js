import { setActiveRole } from './config.js';

export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function formatCurrency(value) {
    const num = Number(value ?? 0);
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 2,
    }).format(Number.isNaN(num) ? 0 : num);
}

export function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return escapeHtml(isoString);
    return d.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({
            attrs: {
                'stroke-width': '1.75',
            },
        });
    }
}

export function renderEmptyState(colspan, iconName, title, subtitle = '') {
    return `
        <tr>
            <td colspan="${colspan}" class="px-6 py-10 text-center">
                <div class="inline-flex flex-col items-center gap-1.5 max-w-sm mx-auto">
                    <div class="w-9 h-9 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] flex items-center justify-center text-[#71717A] mb-1">
                        <i data-lucide="${escapeHtml(iconName)}" class="w-4 h-4"></i>
                    </div>
                    <p class="text-[13px] font-semibold text-[#09090B]">${escapeHtml(title)}</p>
                    ${subtitle ? `<p class="text-xs text-[#71717A]">${escapeHtml(subtitle)}</p>` : ''}
                </div>
            </td>
        </tr>
    `;
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const palette = {
        success: {
            border: 'border-l-[#059669]',
            icon: 'check-circle-2',
            iconColor: 'text-[#059669]',
        },
        error: {
            border: 'border-l-[#DC2626]',
            icon: 'alert-circle',
            iconColor: 'text-[#DC2626]',
        },
        warning: {
            border: 'border-l-[#D97706]',
            icon: 'alert-triangle',
            iconColor: 'text-[#D97706]',
        },
        info: {
            border: 'border-l-[#1D4ED8]',
            icon: 'info',
            iconColor: 'text-[#1D4ED8]',
        },
    };

    const cfg = palette[type] || palette.info;
    const toast = document.createElement('div');
    toast.className = `flex items-start gap-2.5 px-3.5 py-3 rounded-[10px] bg-white border border-[#E4E4E7] border-l-4 ${cfg.border} shadow-md text-[13px] font-medium text-[#09090B] max-w-sm transition-all duration-150`;
    toast.innerHTML = `
        <i data-lucide="${cfg.icon}" class="w-4 h-4 ${cfg.iconColor} shrink-0 mt-0.5"></i>
        <span class="flex-1 leading-snug">${escapeHtml(message)}</span>
        <button type="button" class="text-[#71717A] hover:text-[#09090B] p-0.5 rounded transition-colors">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
        if (toast.isConnected) toast.remove();
    }, 5000);
}

export function showDclForbiddenModal({ endpoint, method, role, detail }) {
    const modal = document.getElementById('dcl-forbidden-modal');
    const banner = document.getElementById('dcl-alert-banner');

    if (banner) {
        const bannerDetail = document.getElementById('dcl-banner-detail');
        bannerDetail.textContent = `[${method} ${endpoint}] Rol '${role}' bloqueado: ${detail}`;
        banner.classList.remove('hidden');
    }

    if (!modal) return;
    document.getElementById('dcl-modal-role').textContent = role;
    document.getElementById('dcl-modal-endpoint').textContent = `${method} ${endpoint}`;
    document.getElementById('dcl-modal-detail').textContent = detail || 'permission denied';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    refreshIcons();
}

export function closeDclForbiddenModal() {
    const modal = document.getElementById('dcl-forbidden-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

export function initGlobalModals() {
    const dclClose = document.getElementById('dcl-modal-close');
    const dclSwitch = document.getElementById('dcl-modal-switch-admin');
    const bannerClose = document.getElementById('dcl-banner-close');
    const genericClose = document.getElementById('generic-modal-close');

    if (dclClose) dclClose.addEventListener('click', closeDclForbiddenModal);
    if (dclSwitch) {
        dclSwitch.addEventListener('click', () => {
            setActiveRole('rol_admin');
            closeDclForbiddenModal();
            const banner = document.getElementById('dcl-alert-banner');
            if (banner) banner.classList.add('hidden');
            showToast('Rol cambiado a rol_admin (Acceso Total)', 'success');
        });
    }
    if (bannerClose) {
        bannerClose.addEventListener('click', () => {
            document.getElementById('dcl-alert-banner')?.classList.add('hidden');
        });
    }
    if (genericClose) genericClose.addEventListener('click', closeModal);
}

export function openModal(title, htmlContent) {
    const modal = document.getElementById('generic-modal');
    const titleEl = document.getElementById('generic-modal-title');
    const bodyEl = document.getElementById('generic-modal-body');
    if (!modal || !titleEl || !bodyEl) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = htmlContent;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    refreshIcons();
}

export function closeModal() {
    const modal = document.getElementById('generic-modal');
    const bodyEl = document.getElementById('generic-modal-body');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (bodyEl) bodyEl.innerHTML = '';
}

const CONTROL_KEYS = new Set([
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
]);

export function enforceIntegerInput(inputEl, { min = 0 } = {}) {
    if (!inputEl) return;
    inputEl.type = 'number';
    inputEl.min = String(min);
    inputEl.step = '1';
    inputEl.inputMode = 'numeric';

    inputEl.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || CONTROL_KEYS.has(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    inputEl.addEventListener('paste', (e) => {
        const text = (e.clipboardData?.getData('text') || '').trim();
        if (!/^\d+$/.test(text)) e.preventDefault();
    });
    inputEl.addEventListener('input', () => {
        const clean = inputEl.value.replace(/\D/g, '');
        if (inputEl.value !== clean) inputEl.value = clean;
    });
}

export function enforceDecimalInput(inputEl, { min = 0.01, step = 0.01 } = {}) {
    if (!inputEl) return;
    inputEl.type = 'number';
    inputEl.min = String(min);
    inputEl.step = String(step);
    inputEl.inputMode = 'decimal';

    inputEl.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || CONTROL_KEYS.has(e.key)) return;
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
            return;
        }
        if (e.key === '.' && inputEl.value.includes('.')) {
            e.preventDefault();
            return;
        }
        if (!/^[\d.]$/.test(e.key)) e.preventDefault();
    });
    inputEl.addEventListener('paste', (e) => {
        const text = (e.clipboardData?.getData('text') || '').trim();
        if (!/^\d+(\.\d{0,2})?$/.test(text)) e.preventDefault();
    });
    inputEl.addEventListener('input', () => {
        let clean = inputEl.value.replace(/[^\d.]/g, '');
        const parts = clean.split('.');
        if (parts.length > 2) clean = `${parts[0]}.${parts.slice(1).join('')}`;
        if (inputEl.value !== clean) inputEl.value = clean;
    });
}

export function enforceDigitsOnlyInput(inputEl, { minLength = 6, maxLength = 15 } = {}) {
    if (!inputEl) return;
    inputEl.setAttribute('inputmode', 'numeric');
    inputEl.setAttribute('pattern', '[0-9]*');
    inputEl.setAttribute('minlength', String(minLength));
    inputEl.setAttribute('maxlength', String(maxLength));

    inputEl.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || CONTROL_KEYS.has(e.key)) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });
    inputEl.addEventListener('paste', (e) => {
        const text = (e.clipboardData?.getData('text') || '').trim();
        if (!/^\d+$/.test(text)) e.preventDefault();
    });
    inputEl.addEventListener('input', () => {
        const clean = inputEl.value.replace(/\D/g, '').slice(0, maxLength);
        if (inputEl.value !== clean) inputEl.value = clean;
    });
}

export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function isValidDigits(value, min = 6, max = 15) {
    return new RegExp(`^\\d{${min},${max}}$`).test(String(value || '').trim());
}
