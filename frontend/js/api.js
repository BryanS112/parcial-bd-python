import { getActiveRole } from './config.js';
import { handleMockRequest } from './mock_store.js';
import { showDclForbiddenModal } from './ui.js';

export class ApiError extends Error {
    constructor(message, status, detail, isDclForbidden = false) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
        this.isDclForbidden = isDclForbidden;
    }
}

let currentConnectionMode = null;

export function setConnectionMode(mode) {
    if (currentConnectionMode === mode) return;
    currentConnectionMode = mode;
    window.dispatchEvent(new CustomEvent('techcore:connection-mode', { detail: { mode } }));
}

export function getConnectionMode() {
    return currentConnectionMode;
}

export async function apiFetch(baseUrl, path, options = {}) {
    const role = options.roleOverride || getActiveRole();
    const method = (options.method || 'GET').toUpperCase();
    const headers = {
        'X-DB-Role': role,
        ...(options.headers || {}),
    };

    const rawBody = options.body;
    let parsedBody = null;
    let body = rawBody;
    if (rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string') {
        parsedBody = rawBody;
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(rawBody);
    } else if (typeof rawBody === 'string') {
        try {
            parsedBody = JSON.parse(rawBody);
        } catch {
            parsedBody = rawBody;
        }
    }

    let status;
    let ok;
    let payload = null;

    try {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            body,
        });
        setConnectionMode('live');
        status = response.status;
        ok = response.ok;

        const text = await response.text();
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { detail: text };
            }
        }
    } catch {
        // Respaldo automático en memoria cuando el microservicio local no está disponible
        setConnectionMode('demo');
        const mock = handleMockRequest(path, { method, role, body: parsedBody });
        status = mock.status;
        ok = mock.ok;
        payload = mock.data;
    }

    if (status === 403) {
        const detail = payload?.detail || 'Permiso denegado por políticas DCL en PostgreSQL.';
        if (!options.silent403) {
            showDclForbiddenModal({
                endpoint: path,
                method,
                role,
                detail,
            });
        }
        throw new ApiError(detail, 403, detail, true);
    }

    if (!ok) {
        const detail =
            typeof payload?.detail === 'string'
                ? payload.detail
                : JSON.stringify(payload?.detail || `Error HTTP ${status}`);
        throw new ApiError(detail, status, detail, false);
    }

    return payload;
}
