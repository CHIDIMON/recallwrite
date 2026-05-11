from fastapi import APIRouter, File, UploadFile
import shutil
import os
import uuid

router = APIRouter()
UPLOAD_DIR = "uploads"

# สร้างโฟลเดอร์อัตโนมัติถ้ายังไม่มี
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/upload-image")
async def upload_image(image: UploadFile = File(...)):
    file_extension = image.filename.split(".")[-1]
    new_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    return {"url": f"/uploads/{new_filename}"}