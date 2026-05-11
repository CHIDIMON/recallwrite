from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# สร้างไฟล์ SQLite ชื่อ recall_v2.db ในโฟลเดอร์หลัก (เวอร์ชันล่าสุด)
SQLALCHEMY_DATABASE_URL = "sqlite:///./recall_v2.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency สำหรับใช้เรียก DB Session ใน API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()