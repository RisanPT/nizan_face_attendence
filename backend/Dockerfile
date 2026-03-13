# Use slim Python 3.11 base image
FROM python:3.11-slim

# Install system-level dependencies needed for face_recognition and opencv
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for Docker layer caching
COPY requirements.txt .

# Install dlib 19.24.2 (last version with pre-built wheels for py3.11 linux)
RUN pip install --upgrade pip
RUN pip install dlib==19.24.2
RUN pip install -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Collect static files
RUN python manage.py collectstatic --no-input

# Expose port
EXPOSE 8000

# Start gunicorn
CMD ["gunicorn", "smart_attendance.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1", "--timeout", "120"]
