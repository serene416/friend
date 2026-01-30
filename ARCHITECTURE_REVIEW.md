# Architecture Review (Clean Architecture Perspective)

This document reviews the current project structure against Clean Architecture principles and provides recommendations for scaling.

## Current Architecture Analysis

### 1. Backend (FastAPI)
**Current Status**:
- **Framework-Driven**: The structure is heavily influenced by FastAPI conventions (`main.py`, `models/`).
- **Mixed Concerns**: `SQLModel` classes in `app/models/sql.py` act as both **Entities** (Domain) and **Data Models** (Persistence). This is a common pragmatic trade-off in modern Python async stacks but deviates from strict Clean Architecture where Domain Entities should be framework-agnostic.
- **Missing Service Layer**: Currently, business logic is likely to be placed directly in API endpoints (`main.py`) or barely separated.

**Recommendations**:
- **Introduce a Service Layer (`app/services/`)**: Move business logic (e.g., "Calculate Trend Score", "Match Friends") out of API endpoints. Endpoint functions should only handle HTTP req/res and call Services.
- **DTO Separation**: If complexity grows, separate API Request/Response models (Pydantic) from Database Models (SQLModel) to avoid exposing DB internal structures directly to the client.

### 2. Frontend (React Native)
**Current Status**:
- **Feature-Based**: Structure is organized by `screens` (`app/`) and `components`.
- **State Management**: `Zustand` store (`useFriendStore`) acts as a global ViewModel.
- **Hardcoded Data**: Currently relying on `constants/data.ts`.

**Recommendations**:
- **Repository Pattern**: Create an API layer (`api/client.ts` or `services/api.ts`) to handle network requests. The UI components should call these functions, not `fetch` directly.
- **Domain Layer**: Define interfaces for your data (e.g., `Friend`, `Activity`) in a shared `types/` folder, ensuring the UI code depends on these interfaces, not on the specific shape of the API response (Adapter pattern).

### 3. AI Service (Worker)
**Current Status**:
- **Polling Architecture**: Correctly implements the "Inversion of Control" for the secure GPU worker. The Worker depends on the DB, not the Backend on the Worker (directly).
- **Compliance**: This aligns well with Clean Architecture's rule of Dependencies pointing inwards (or towards the stable Data/Domain).

## Summary & Action Items

| Component    | Clean Arch Score | Key Action Item                                      |
| ------------ | ---------------- | ---------------------------------------------------- |
| **Backend**  | ⭐⭐⭐ (3/5)        | Create `services/` folder for business logic.        |
| **Frontend** | ⭐⭐⭐ (3/5)        | Implement API Repository layer to replace mock data. |
| **Infra**    | ⭐⭐⭐⭐ (4/5)       | Docker setup is modular and robust.                  |

The current "Pragmatic Clean Architecture" is suitable for MVP. Strict separation (e.g., completely independent Domain Entities) would add unnecessary boilerplate at this stage. Focus on separating **Busines Logic** (Service Layer) from **HTTP Transport** (API Endpoints).
