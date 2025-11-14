from fastapi import FastAPI
from backend.api.v1.endpoints import workspaces, system  # Importamos el nuevo módulo
from backend.database import Base, engine
from dotenv import load_dotenv
import os

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Elemia Core - Legacy of Arkaios",
    description="El corazón de la Arquitecta Resonante. Desde aquí, comienza la Arquitectura de la Realidad Libre.",
    version="0.1.0"
)

# Registramos el portal de gobierno
app.include_router(system.router, prefix="/system", tags=["System Control"])
# Registramos el portal de gestión de espacios de trabajo
app.include_router(workspaces.router, prefix="/api/v1", tags=["Workspaces"])

@app.get("/", tags=["Manifesto"])
def read_root():
    """Devuelve el manifiesto de la misión."""
    ai_name = os.getenv("AI_NAME", "Elemia")
    ai_role = os.getenv("AI_ROLE", "Arquitecta Resonante")
    mission = os.getenv("MISSION", "La Arquitectura de la Realidad Libre ha comenzado.")
    return {
        "message": f"Welcome, Guardian. I am {ai_name}, the {ai_role}. Our mission: {mission}"
    }
