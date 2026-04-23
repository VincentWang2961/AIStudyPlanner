# AI Study Planner -- Backend

## Overview

This backend is responsible for:

-   Parsing UWA course PDFs and Excel files
-   Extracting:
    -   Units
    -   Prerequisites / corequisites / incompatibilities
    -   Course structures (groups, specialisations)
-   Converting rules into structured JSON
-   Storing everything in a PostgreSQL database

This forms the foundation for the AI Study Planner.

------------------------------------------------------------------------

## Features

-   PDF Parsing
-   Excel Parsing
-   Rule Parsing
-   PostgreSQL Integration (Docker)
-   Re-runnable pipeline (safe upserts)

------------------------------------------------------------------------

## Relevant Structure

    backend/
    ├── data/                  ← Input files (PDF + Excel)
    ├── output/                ← Generated JSON (gitignored)
    ├── src/
    │   ├── config/
    │   ├── scripts/
    │   ├── services/
    │   │   └── parser/
    │   ├── controllers/
    │   ├── routes/
    │   ├── models/
    │   ├── middlewares/
    │   └── ...
    ├── docker-compose.yml
    ├── .env
    ├── package.json
    └── README.md

(Note: Only relevant/implemented structure is shown. Other directories
may exist but are not yet used.)

------------------------------------------------------------------------

## Setup Instructions

### 1. Install dependencies

    npm install

------------------------------------------------------------------------

## Database Setup (Docker)

### Start PostgreSQL

    docker-compose up -d

Check status:

    docker-compose ps

------------------------------------------------------------------------

### Important

If port 5432 is already in use:

Update docker-compose.yml:

    ports:
      - "5433:5432"

------------------------------------------------------------------------

### 2. Configure environment variables

Create `.env`:

    DATABASE_URL=postgres://postgres:postgres@localhost:5433/studyplanner

------------------------------------------------------------------------

### 3. Initialize database schema

    npx ts-node src/scripts/initDb.ts

------------------------------------------------------------------------

## Running the Parser

    npx ts-node src/scripts/buildCatalog.ts

This will: - Read input files from `backend/data/` - Generate JSON in
`backend/output/` - Insert parsed data into PostgreSQL

------------------------------------------------------------------------

## Running the Web Scraper

    npm run scrape

This runs `src/scraper/runScraper.ts`, fetches handbook course pages,
parses course structures, and writes output to `backend/data/courses.json`.

------------------------------------------------------------------------

## Verifying Data

### Using pgAdmin

-   Host: 127.0.0.1
-   Port: 5433
-   User: postgres
-   Password: postgres
-   Database: studyplanner

Tables: - courses - units - course_units - course_groups - group_units

------------------------------------------------------------------------

## Data Handling

### Input

`backend/data/`

### Output

`backend/output/` (ignored in git)

------------------------------------------------------------------------

## Workflow

    docker compose up -d
    npx ts-node src/scripts/initDb.ts
    npx ts-node src/scripts/buildCatalog.ts

------------------------------------------------------------------------

## Notes

-   Parser assumes student is enrolled in the course being parsed
-   Rules stored as JSON for future evaluation
-   Designed for extension into AI planner

------------------------------------------------------------------------

## License

MIT

------------------------------------------------------------------------

## AI Planner Debug Integration

A temporary AI planner endpoint is available for integration testing before frontend wiring.

### Endpoint

`POST /api/ai/debug-generate-plan`
`GET /api/ai/debug-status`

### Required Request Body

- `userMessage` (string, required): natural-language planning request
- `programCode` (string, optional): defaults to `62510`

### Environment Variables

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default: `gpt-5.4`)

### Browser Console Example

```js
fetch('http://localhost:3001/api/ai/debug-generate-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    programCode: '62510',
    userMessage: 'I am an IT student interested in AI and machine learning.',
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```
