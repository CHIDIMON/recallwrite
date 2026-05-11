from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ดึง Router ที่เราแยกไว้มาใช้งาน
from app.api import uploads, notes
from cleanup_images import cleanup_orphaned_images

@asynccontextmanager
async def lifespan(app: FastAPI):
    # รันสคริปต์เคลียร์ไฟล์ขยะทุกครั้งตอนเริ่มเซิร์ฟเวอร์
    try:
        cleanup_orphaned_images()
    except Exception as e:
        print(f"Failed to run cleanup on startup: {e}")
    yield

app = FastAPI(title="Local Note App", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# นำเข้า API Routes
app.include_router(uploads.router, prefix="/api", tags=["uploads"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])

# Mount Static Files (เสิร์ฟรูปภาพ และ เสิร์ฟหน้าเว็บ Frontend)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")