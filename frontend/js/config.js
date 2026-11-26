const API_HOST = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';

export const API_USUARIOS = `http://${API_HOST}:8001`;
export const API_OPERACIONES = `http://${API_HOST}:8002`;

const STORAGE_ROLE_KEY = 'techcore_active_db_role';
const VALID_ROLES = ['rol_admin', 'rol_operador'];

export function getActiveRole() {
    const saved = localStorage.getItem(STORAGE_ROLE_KEY);
    return VALID_ROLES.includes(saved) ? saved : 'rol_operador';
}

export function setActiveRole(role) {
    if (!VALID_ROLES.includes(role)) {
        throw new Error(`Rol no válido: ${role}`);
    }
    localStorage.setItem(STORAGE_ROLE_KEY, role);
    window.dispatchEvent(new CustomEvent('techcore:role-changed', { detail: { role } }));
}
