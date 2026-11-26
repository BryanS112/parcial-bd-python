# TechCore Store

Sistema de gestión comercial, inventario y ventas desarrollado como proyecto universitario de Bases de Datos. Está implementado con una arquitectura de microservicios en **PostgreSQL 16**, **FastAPI** con `psycopg` v3 (SQL directo sin ORM), un frontend SPA en **HTML/JavaScript** y soporte para **Docker Compose**.

## Arquitectura

El sistema separa la lógica de usuarios y auditoría de la lógica comercial y de reportes en dos microservicios independientes conectados a una misma base de datos `techcore_db`:

| Servicio | Tecnología | Puerto | Descripción |
| :--- | :--- | :---: | :--- |
| `frontend` | HTML5, Tailwind CSS, JavaScript (`fetch`) | `3000` | Interfaz web SPA para operar el POS, inventario, clientes y auditoría |
| `ms-usuarios-seguridad` | FastAPI + Uvicorn + `psycopg` v3 | `8001` | Gestión de usuarios, autenticación y consulta de `auditoria_logs` |
| `ms-operaciones-reportes` | FastAPI + Uvicorn + `psycopg` v3 | `8002` | CRUD de productos, categorías, clientes, pedidos transaccionales y reportes |
| `postgres_db` | PostgreSQL 16 | `5432` | Base de datos relacional `techcore_db` |

### Base de datos y seguridad DCL

El esquema completo se define en [`database/init.sql`](database/init.sql) e incluye:

- **Tablas:** `categorias`, `usuarios`, `productos`, `clientes`, `pedidos`, `detalle_pedidos` y `auditoria_logs`.
- **Control transaccional:** `POST /api/v1/pedidos/lote` ejecuta `BEGIN`, bloquea filas con `SELECT ... FOR UPDATE`, descuenta stock, inserta `detalle_pedidos` y confirma con `COMMIT` (o revierte con `ROLLBACK` ante stock insuficiente).
- **Triggers y rutinas PL/pgSQL:** `fn_auditar_cambios()` registra automáticamente `INSERT`, `UPDATE` y `DELETE` en `auditoria_logs`; incluye `proc_registrar_pedido`, `proc_cancelar_pedido`, `fn_calcular_descuento`, `fn_reporte_ventas` y la función de agregación `fn_promedio_ponderado`.
- **Vistas con `JOIN`:** `vw_resumen_pedidos`, `vw_ventas_por_producto` y `vw_resumen_por_usuario`.
- **Roles DCL (`X-DB-Role`):** cada petición aplica `SET ROLE` en PostgreSQL:
  - `rol_admin`: acceso total sobre tablas, vistas, funciones y `auditoria_logs`.
  - `rol_operador`: lectura y escritura en operaciones comerciales, sin permiso `DELETE` ni acceso directo a `auditoria_logs` (`403 Forbidden`).

## Estructura del proyecto

```text
.
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── database/
│   └── init.sql
├── docs/
│   ├── MERE.md
│   ├── Presentacion_TechCore_Store.pptx
│   └── SUSTENTACION_Y_CASO_DE_USO.md
├── frontend/
│   ├── Dockerfile
│   ├── index.html
│   ├── css/styles.css
│   └── js/
├── ms-usuarios-seguridad/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
└── ms-operaciones-reportes/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
```

## Cómo ejecutar el proyecto

### Opción 1: Con Docker Compose

```bash
docker compose up --build
```

Para reiniciar la base de datos desde cero y volver a cargar `database/init.sql`:

```bash
docker compose down -v
docker compose up --build
```

Accesos una vez iniciados los contenedores:
- Frontend: `http://localhost:3000`
- Swagger Usuarios y Seguridad: `http://localhost:8001/docs`
- Swagger Operaciones y Reportes: `http://localhost:8002/docs`

### Opción 2: En local (sin Docker)

1. Crea la base de datos `techcore_db` en tu PostgreSQL local (`localhost:5432`) y ejecuta `database/init.sql`.
2. Copia `.env.example` a `.env` en la raíz (y en cada microservicio si los ejecutas por separado) ajustando tu contraseña:
   ```env
   DATABASE_URL=postgresql://postgres:tu_clave@localhost:5432/techcore_db
   DB_SSLMODE=disable
   ```
3. Crea el entorno virtual e instala las dependencias:
   ```bash
   python -m venv .venv
   # En Windows: .venv\Scripts\pip install -r ms-usuarios-seguridad\requirements.txt -r ms-operaciones-reportes\requirements.txt
   # En Linux/macOS: .venv/bin/pip install -r ms-usuarios-seguridad/requirements.txt -r ms-operaciones-reportes/requirements.txt
   ```
4. Inicia los servicios en terminales separadas:
   ```bash
   uvicorn app.main:app --app-dir ms-usuarios-seguridad --host 127.0.0.1 --port 8001
   uvicorn app.main:app --app-dir ms-operaciones-reportes --host 127.0.0.1 --port 8002
   python -m http.server 3000 --bind 127.0.0.1 --directory frontend
   ```

## Integrantes del grupo

- Integrante 1
- Integrante 2
- Integrante 3
- Integrante 4
- Integrante 5
