# What are we doing today? (우리 오늘 뭐 해?)

Friends' Activity Recommendation App specialized for group gatherings and trending spots.

## Project Structure

- **`mobile/`**: React Native (Expo) Client Application.
- **`backend/`**: FastAPI Backend Server (Gateway & Core Logic).
- **`worker/`**: Celery + Playwright Worker for data gathering.
- **`ai/`**: GPU-accelerated AI Service for trend analysis.
- **`infra/`**: Infrastructure configurations.
- **`docker-compose.yml`**: Infrastructure orchestration (Postgres, Redis, MongoDB, Services).

## Getting Started

### Prerequisites

- **Docker & Docker Compose**: For running backend services and databases.
- **Node.js & npm/yarn**: For running the frontend client.
- **Expo Go App**: To run the mobile app on a physical device.

### 1. Backend & Infrastructure (Docker)

To start the databases, backend, worker, and AI service:

```bash
# Build and start all services
docker-compose up --build
```

- **Backend API**: `http://localhost:8000/docs`
- **PostgreSQL**: `localhost:5440`
- **Redis**: `localhost:6381`
- **MongoDB**: `localhost:27018`

### 2. Frontend (React Native)

To run the mobile application:

```bash
cd mobile
npm install  # Install dependencies (first time only)
npx expo start
```

- Press `i` to open in iOS Simulator (Mac only).
- Press `a` to open in Android Emulator.
- Scan the QR code with the **Expo Go** app on your phone.

## Security Note (GPU Server)

The AI Service is configured to run in a secure environment with limited ports (22, 80). It uses a **Polling** mechanism:
- It connects to the internal PostgreSQL DB.
- Polls the `aitask` table for `PENDING` tasks using `SELECT ... FOR UPDATE SKIP LOCKED`.
- This ensures no direct external access to the GPU worker is required.

## Tech Stack

- **Frontend**: React Native, Expo Router, Zustand
- **Backend**: FastAPI, SQLModel, AsyncPG
- **Database**: PostgreSQL (PostGIS), MongoDB, Redis
- **Infra**: Docker, Nginx (planned)
