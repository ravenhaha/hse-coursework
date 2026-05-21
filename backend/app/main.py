from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.auth import router as auth_router
from routers.graph import router as graph_router

app = FastAPI(title="PenciveExample")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(graph_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Hello everyone! Good mood"}
