# AI Study Planner

An AI-powered study planning assistant for university students. Generate personalised study plans based on your course, specialisation, and preferences.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router, TypeScript, React 18) |
| **Backend** | Express.js + TypeScript |
| **Database** | PostgreSQL via Prisma ORM |
| **AI** | OpenAI API (GPT-4o / configurable) |
| **Containerisation** | Docker & Docker Compose |

## Project Structure

```
ai-study-planner/
├── frontend/                  # Next.js 14 web app
│   ├── src/
│   │   ├── app/               # Pages (create-plan, validate, my-plans, settings, units, auth)
│   │   ├── components/        # UI components (Sidebar, PlanConfigForm, ValidationSidebar, etc.)
│   │   └── lib/               # API clients and data utilities
│   └── Dockerfile
├── backend/                   # Express API server
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/            # Express route definitions
│   │   ├── services/          # Business logic
│   │   │   ├── aiPlanner/     # AI study plan generation engine
│   │   │   ├── validation/    # Plan validation service
│   │   │   └── parser/        # PDF/Excel course data parsers
│   │   └── config/            # Database and app configuration
│   ├── prisma/                # Database schema and migrations
│   ├── data/                  # Course catalogues (PDF, Excel, JSON)
│   └── Dockerfile
├── docker-compose.yml         # Unified Docker deployment
└── README.md
```

## Quick Start

### Prerequisites

- Node.js >= 18.18.0
- Docker & Docker Compose (for containerised deployment)
- OpenAI API key (for AI plan generation)

### Local Development

**1. Backend**

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and OPENAI_API_KEY
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

The backend runs on `http://localhost:3001`.

**2. Frontend**

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

### Docker Deployment

```bash
# 1. Create .env file with required secrets
cp .env.example .env
# Edit .env to add OPENAI_API_KEY

# 2. Build and start all services
docker compose up --build -d

# 3. Run database migrations
docker compose exec backend npx prisma migrate deploy
```

The app will be available at `http://localhost:3000`.

## AI Study Plan Generation

The AI planner generates personalised study plans using:

- **Course catalogue data** — imported from UWA handbooks (PDF/Excel)
- **Unit sequence data** — recommended order of units per course
- **Specialisation tracking** — ensures all required units for your focus area are included
- **Prerequisite chain analysis** — automatically resolves dependency ordering

### Architecture

The AI engine follows a **generate → validate → refine** pipeline:

1. **Prompt Builder** (`backend/src/services/aiPlanner/promptBuilder.ts`)
   - Constructs a structured system prompt with chain-of-thought reasoning
   - Includes few-shot examples for reliable JSON output
   - Injects course catalogue, specialisation data, and sequence ordering

2. **AI Service** (`backend/src/services/aiPlanner/aiPlannerService.ts`)
   - Calls OpenAI with `response_format: { type: 'json_object' }`
   - Retries on parse failures (up to 2 attempts)
   - Validates output against the study plan schema

3. **Sequence Enricher** (`backend/src/services/aiPlanner/sequenceEnricher.ts`)
   - Computes prerequisite depth for optimal unit ordering
   - Builds recommended semester sequences

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/ai/debug-status` | Check AI planner configuration |
| `POST` | `/api/ai/generate-plan` | Generate a study plan |
| `POST` | `/api/ai/debug-generate-plan` | Debug endpoint (same as generate) |

**POST `/api/ai/generate-plan`**

```json
{
  "userMessage": "Create a 6-semester study plan for Master of IT",
  "programCode": "62510",
  "specialisation": "Applied Computing",
  "completedUnits": [],
  "preferredSemesterCount": 6,
  "unitsPerSemester": 4,
  "preferences": "I prefer a balanced workload with no more than 2 technical units per semester"
}
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "plan": {
      "semesters": [...],
      "summary": { "totalCreditPoints": 96, "totalUnits": 16 }
    },
    "explanation": { "overview": "...", "electiveRationales": [...] },
    "warnings": ["..."],
    "reasoning": {
      "prerequisiteAnalysis": [...],
      "specialisationFulfillment": [...],
      "workloadConsiderations": [...]
    }
  }
}
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for plan generation |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model to use |
| `PORT` | No | `3001` | Backend server port |
| `FRONTEND_ORIGIN` | No | `http://localhost:3000` | CORS origin |
| `JWT_SECRET` | Yes | — | Secret for session tokens |

### Docker (`./.env`)

For Docker deployment, create a `.env` file at the project root:

```bash
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
```

## Contributing

This project is developed by CITS5206 Capstone Group 4.

- **Vincent Wang** — AI engine, backend infrastructure
- **Zoe Jin** — Frontend UI & integration
- **Yosuke Inoue** — CSV export service
- **Tarun** — PDF export service
- **Areeb Amir** — Validation API, project lead
- **Yidan Xu** — Frontend support
