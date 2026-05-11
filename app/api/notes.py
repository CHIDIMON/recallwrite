from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import models, database
from app.schemas import note
import re
import os
from urllib.parse import urlparse, unquote

router = APIRouter()

# สร้าง Table อัตโนมัติถ้ายังไม่มี
models.Base.metadata.create_all(bind=database.engine)

@router.post("/", response_model=note.NoteResponse)
def create_note(note_in: note.NoteCreate, db: Session = Depends(database.get_db)):
    db_note = models.Note(**note_in.dict())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.get("/", response_model=list[note.NoteResponse])
def read_notes(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # เรียงจากใหม่ไปเก่า
    notes = db.query(models.Note).order_by(models.Note.id.desc()).offset(skip).limit(limit).all()
    return notes

@router.put("/{note_id}", response_model=note.NoteResponse)
def update_note(note_id: int, note_in: note.NoteCreate, db: Session = Depends(database.get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # 🗑️ ป้องกันไฟล์ขยะ: ค้นหารูปภาพที่เคยมีในเนื้อหาเดิม แต่ไม่มีในเนื้อหาใหม่ (ผู้ใช้กดลบรูปออกไป)
    old_urls = set(re.findall(r'<img[^>]+src="([^">]+)"', db_note.content or ""))
    new_urls = set(re.findall(r'<img[^>]+src="([^">]+)"', note_in.content or ""))
    orphaned_urls = old_urls - new_urls
    
    for url in orphaned_urls:
        if url.startswith("data:"): # ข้ามรูปที่เป็น Base64
            continue
            
        # สกัดเอาเฉพาะ Path จาก URL (แก้ปัญหากรณีเป็น http://localhost:8000/... หรือมีการเว้นวรรค)
        parsed_path = unquote(urlparse(url).path)
        file_path = parsed_path.lstrip("/") # แปลงเป็น Path ไฟล์จริง เช่น "uploads/..."
        
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error deleting image {file_path}: {e}")

    for key, value in note_in.dict().items():
        setattr(db_note, key, value)
        
    db.commit()
    db.refresh(db_note)
    return db_note

@router.delete("/{note_id}")
def delete_note(note_id: int, db: Session = Depends(database.get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # 🗑️ ป้องกันไฟล์ขยะ: ค้นหารูปภาพทั้งหมดในโน้ตที่กำลังจะถูกลบทิ้งถาวร และลบไฟล์จริงทิ้ง
    urls = re.findall(r'<img[^>]+src="([^">]+)"', db_note.content or "")
    for url in urls:
        if url.startswith("data:"):
            continue
            
        parsed_path = unquote(urlparse(url).path)
        file_path = parsed_path.lstrip("/")
        
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error deleting image {file_path}: {e}")

    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted successfully"}