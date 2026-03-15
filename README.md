## AI Study Planner

Minimal starter for the AI Study Planner web app using the latest Long-Term Support (LTS) release of [Next.js 14](https://nextjs.org/) with TypeScript. The project is ready for both local development and containerised deployments.

## Tech Stack

- Next.js 14 (App Router, TypeScript, React 18, ESLint)
- Node.js 20 (Docker base image) / >= 18.18 on host machines
- npm for dependency management

## Local Development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the site. Edit files under `src/app` and the dev server will hot reload the changes.

## Useful Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the Next.js development server |
| `npm run lint` | Runs ESLint using the Next.js config |
| `npm run build` | Creates a production build (`.next` output/standalone server) |
| `npm run start` | Serves the production build (after `npm run build`) |

## Docker Workflow

The repository ships with a multi-stage `Dockerfile` and `docker-compose.yml`:

```bash
# build and run directly
docker build -t ai-study-planner .
docker run --rm -p 3000:3000 ai-study-planner

# or with compose
docker compose up --build
```

The image exposes port `3000` and serves the `.next/standalone` output using `node server.js`.

## Environment Variables

Create an `.env.local` file (ignored from Git) for any runtime secrets. Example:

```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

Restart the dev server after changing env vars.
