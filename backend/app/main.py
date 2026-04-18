from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router
from routers.collection import router as collection_router
from routers.material import router as material_router
from routers.tag import router as tag_router

app = FastAPI(
    title="Pensieve",
    description="Бэкенд для образовательного менеджера знаний",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,                   # для httpOnly cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(collection_router, prefix="/api")
app.include_router(material_router, prefix="/api")
app.include_router(tag_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Hello everyone! Good mood"}


# ДОБАВЛЕНО: для мониторинга / проверки что сервер жив
@app.get("/health")
async def health():
    return {"status": "ok"}