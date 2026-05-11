FROM python:3.13-slim

# ตั้งค่า Working Directory ใน Container
WORKDIR /app

# ติดตั้ง uv (เนื่องจากโปรเจกต์คุณใช้ uv.lock)
RUN pip install uv

# คัดลอกไฟล์ทั้งหมดลงใน Container
COPY . /app/

# ติดตั้ง dependencies ทั้งหมดผ่าน uv
RUN uv sync --frozen

EXPOSE 8000

# รันเซิร์ฟเวอร์ FastAPI
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]