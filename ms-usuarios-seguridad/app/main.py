from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth_router import router as auth_router

app = FastAPI(
    title="TechCore Store — MS Usuarios y Seguridad",
    description=(
        "Microservicio de autenticación, gestión CRUD de usuarios y trazabilidad "
        "de auditoría conectado directamente a PostgreSQL mediante psycopg v3."
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

app.include_router(auth_router)


@app.get("/health", tags=["Estado"])
def health_check():
    return {"status": "ok", "servicio": "ms-usuarios-seguridad"}
