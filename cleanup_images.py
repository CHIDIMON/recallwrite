import os
import re
from app.db import models, database

# ใส่ชื่อโฟลเดอร์ที่คุณใช้เก็บรูปภาพจริงๆ (เช่น "uploads" หรือ "static/images")
UPLOAD_DIR = "uploads" 

def cleanup_orphaned_images():
    print("🔍 Scanning for orphaned images...")
    
    # 1. ดึงโน้ตทั้งหมดมาหา URL รูปภาพที่กำลังถูกใช้งานอยู่
    db = database.SessionLocal()
    notes = db.query(models.Note).all()
    
    used_images = set()
    for note in notes:
        urls = re.findall(r'<img[^>]+src="([^">]+)"', note.content or "")
        for url in urls:
            filename = url.split("/")[-1] # เอาแค่ชื่อไฟล์
            used_images.add(filename)
            
    db.close()

    # 2. กวาดหาไฟล์รูปในโฟลเดอร์ แล้วลบไฟล์ที่ไม่มีใน Database
    if not os.path.exists(UPLOAD_DIR):
        return
        
    actual_files = set(os.listdir(UPLOAD_DIR))
    orphans = actual_files - used_images
    
    for orphan in orphans:
        file_path = os.path.join(UPLOAD_DIR, orphan)
        try:
            os.remove(file_path)
            print(f"🗑️ Deleted: {file_path}")
        except:
            pass
            
    print(f"✅ Cleanup complete. Freed up {len(orphans)} orphaned files.")

if __name__ == "__main__":
    cleanup_orphaned_images()