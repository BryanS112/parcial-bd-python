from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.operaciones_router import router as operaciones_router

app = FastAPI(
    title="TechCore Store — MS Operaciones y Reportes",
    description=(
        "Microservicio comercial para productos, categorías, clientes, pedidos "
        "transaccionales (BEGIN/COMMIT/ROLLBACK), rutinas PL/pgSQL y reportes desde vistas."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://parcial-bd-python.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(operaciones_router)


@app.get("/health", tags=["Estado"])
def health_check():
    return {"status": "ok", "servicio": "ms-operaciones-reportes"}
