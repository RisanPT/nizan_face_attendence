# Smart Attendance System

A comprehensive Smart Attendance System using Django (Backend) and React
(Frontend). Includes Face Verification, Liveness Detection, Geo-fencing, and
Time Window constraints.

## Prerequisites

- Python 3.8+
- Node.js 16+
- CMake (for `dlib`/`face_recognition`)

## Setup Instructions

### 1. Backend (Django)

Navigate to the `backend` directory:

```bash
cd backend
```

Create a virtual environment (optional but recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run Migrations:

```bash
python manage.py migrate
```

Start the Server:

```bash
python manage.py runserver
```

### 2. Frontend (React)

Navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
npm install react-webcam axios
```

Start the Development Server:

```bash
npm run dev
```

## Features

- **Face Verification**: Matches student face with registered profile using
  `face_recognition`.
- **Liveness Check**: Basic check for face structure/landmarks.
- **Geo-fencing**: validates that the student is within `100m` of the class
  location.
- **Time Window**: Ensures attendance is marked only during valid class hours.

## API Endpoints

- `POST /api/submit-attendance/`: Main endpoint to mark attendance.
  - Payload:
    `{ "roll_number": "...", "image": "base64...", "latitude": 12.34, "longitude": 56.78 }`

## Troubleshooting

- **dlib installation fails**: Ensure `cmake` is installed (`brew install cmake`
  or `apt-get install cmake`).
- **Geolocation permission**: Ensure your browser allows location access for the
  frontend.
