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

Kakao Local API setup for midpoint hotplace recommendations:
- Set `KAKAO_REST_API_KEY=<your_kakao_rest_api_key>` in your backend environment (`.env` or Docker env).
- Optional debug logs: set `MIDPOINT_LOG_FULL_KAKAO_RESULTS=true` to print full Kakao station/keyword documents and mapped category/activity info in backend logs.
- Midpoint ingestion enqueue is enabled by default in `docker-compose.yml` via `MIDPOINT_ENABLE_INGESTION_ENQUEUE=${MIDPOINT_ENABLE_INGESTION_ENQUEUE:-true}`.
  - Set `MIDPOINT_ENABLE_INGESTION_ENQUEUE=false` to disable async Stage 2 crawling.
- Optional dedicated Celery broker URL: set `CELERY_BROKER_URL=redis://...` (if omitted, services fall back to `REDIS_URL`).
- Optional CORS override: `CORS_ALLOWED_ORIGINS=http://localhost:19006,https://your-ngrok-domain.ngrok-free.app`
- Restart backend after updating env vars.
- If the key is missing, `POST /api/v1/recommend/midpoint-hotplaces` returns `503`.

### 2. Frontend (React Native)

To run the mobile application:

```bash
cd mobile
npm install  # Install dependencies (first time only)
npm run start:lan
```

- Press `i` to open in iOS Simulator (Mac only).
- Press `a` to open in Android Emulator.
- Scan the QR code with the **Expo Go** app on your phone.

### 2.1 Expose Backend with ngrok (for device testing)

If you want to access the FastAPI server from a real device or outside your LAN, expose port `8000` with ngrok.

```bash
# Install (macOS)
brew install ngrok/ngrok/ngrok

# Authenticate once (get your token from ngrok dashboard)
ngrok config add-authtoken <YOUR_NGROK_TOKEN>

# Start tunnel (replace with your reserved domain if you have one)
ngrok http --domain=playwithme.ngrok.app 8000
```

Then run the mobile app using the ngrok URL:

```bash
cd mobile
EXPO_PUBLIC_BACKEND_URL=https://playwithme.ngrok.app npx expo start
```

Notes:
- If you don't set `EXPO_PUBLIC_BACKEND_URL`, the app first tries to infer your current LAN IP from Expo and builds `http://<your-ip>:8000`.
- For real devices, avoid `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000` in `.env` (it points to the phone itself).
- If ngrok shows a different URL (no reserved domain), use that URL instead.

### 2.3 Invite Links (Friend Invite)

Backend environment variables:
- `INVITE_BASE_URL` (default: `myapp://invite`)  
  Base URL used to construct invite links. It should point to the invite deep link route and will have `?token=...` appended.
- `INVITE_TOKEN_TTL_DAYS` (default: `7`)  
  Invite expiration window in days.

Mobile environment variables:
- `EXPO_PUBLIC_BACKEND_URL`  
  API base URL for invite creation/acceptance (same as login).

### 2.2 ngrok automation (reserved domain)

This repo includes a fixed ngrok config and a helper script.

```bash
# Start ngrok using repo config
./scripts/ngrok-start.sh
```

The config file is:
- `ngrok.yml` (domain: `playwithme.ngrok.app`, port: `8000`)

If you need to change the domain, edit `ngrok.yml`.

If you see `ERR_NGROK_4018`, you haven't installed your authtoken on this machine yet:

```bash
ngrok config add-authtoken <YOUR_NGROK_TOKEN>
```

The script will merge your default ngrok config (where the authtoken is saved) with `ngrok.yml`.

## Security Note (GPU Server)

The AI Service is configured to run in a secure environment with limited ports (22, 80). It uses a **Polling** mechanism:
- It connects to the internal PostgreSQL DB.
- Polls the `aitask` table for `PENDING` tasks using `SELECT ... FOR UPDATE SKIP LOCKED`.
- This ensures no direct external access to the GPU worker is required.

## Internal Ingestion API (Stage 2)

The backend now exposes internal ingestion endpoints:
- `POST /api/v1/internal/ingestion/jobs`  
  Creates a new ingestion job from an explicit hotplace list and enqueues the Celery task.
- `GET /api/v1/internal/ingestion/jobs/{job_id}`  
  Returns current ingestion job status and item counters.

Crawler adapters:
- `worker/crawlers/naver_place.py`: Playwright-based Naver Place review/photo crawler with Kakao->Naver mapping.
- `worker/crawlers/instagram.py`: deterministic placeholder trend adapter.

### Naver crawler environment variables

You can tune crawler safety/behavior with:
- `NAVER_CRAWLER_HEADLESS` (default: `true`)
- `NAVER_CRAWLER_TIMEOUT_MS` (default: `12000`)
- `NAVER_REVIEW_MAX_CLICKS` (default: `20`)
- `NAVER_PHOTO_MAX_SCROLLS` (default: `30`)
- `NAVER_NO_GROWTH_LIMIT` (default: `3`)
- `NAVER_REQUEST_DELAY_MS` (default: `350`)
- `NAVER_CRAWLER_USER_AGENT` (optional, default: unset)
- `KAKAO_REST_API_KEY` (recommended for higher Kakao->Naver mapping accuracy)
- `NAVER_MAPPING_CANDIDATE_LIMIT` (default: `3`)
- `NAVER_KAKAO_LOOKUP_RADIUS_M` (default: `1200`)
- `NAVER_KAKAO_LOOKUP_SIZE` (default: `5`)
- `NAVER_KAKAO_LOOKUP_TIMEOUT_SEC` (default: `1.8`)
- `MIDPOINT_INGESTION_MIN_RECRAWL_MINUTES` (default: `180`, skips re-enqueue for places ingested recently)
- `INGESTION_REVIEW_SAMPLE_LIMIT` (default: `50`, max stored in `feature_payload.latest_review_sample`)
- `INGESTION_PHOTO_SAMPLE_LIMIT` (default: `50`, max stored in `feature_payload.latest_photo_sample`)

### Stage 2 crawler safety notes

- Naver crawling remains background-only via Celery (`tasks.ingest_job`) and does not block midpoint API responses.
- Kakao->Naver mapping is attempted first for each item using place name and optional coordinates.
- If mapping fails or no crawlable Naver target is found, the item is marked `SKIPPED` (not `FAILED`) and ingestion continues.
- Review/photo loops are bounded (`MAX_CLICKS`, `MAX_SCROLLS`, no-growth limits) to prevent infinite loops.
- Selectors are fallback-based and actions use bounded retries + jittered delays for transient page failures.
- The crawler is best-effort; DOM changes, bot defenses, or geo/access restrictions can reduce collected counts.
- Midpoint hotplace responses include `photo_collection_status` (`PENDING`, `READY`, `EMPTY`, `FAILED`) and `photo_collection_reason` for UI-level empty/failed state handling.

## Tech Stack

- **Frontend**: React Native, Expo Router, Zustand
- **Backend**: FastAPI, SQLModel, AsyncPG
- **Database**: PostgreSQL (PostGIS), MongoDB, Redis
- **Infra**: Docker, Nginx (planned)
