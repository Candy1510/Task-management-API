# Task Management API

A full-featured task management backend built with **TypeScript**, **Express**, **Prisma**, **PostgreSQL**, and **Redis**. Features JWT authentication, role-based access control (RBAC), response caching, Winston logging, interactive Swagger documentation, a Jest test suite, Docker containerization, and a GitHub Actions CI pipeline.

## Features

- **RESTful API** — full CRUD for tasks, type-safe end to end with TypeScript and validated with Zod
- **Authentication & Authorization** — JWT-based register/login with bcrypt password hashing; RBAC with `USER` and `ADMIN` roles (admins can view and manage all tasks; users only their own)
- **Database** — PostgreSQL via Prisma ORM, with versioned migrations for the `User` and `Task` models
- **Caching** — Redis caches each user's task list for 60 seconds; the cache is invalidated automatically on create, update, and delete
- **Logging** — Winston logs every request (method, path, status, duration) and all errors
- **API Docs** — interactive Swagger UI at `/api-docs`
- **Testing** — Jest unit tests (auth middleware) and Supertest integration tests (auth + task endpoints) with Redis mocked
- **Deployment** — Dockerfile + docker-compose spin up the API, PostgreSQL, and Redis with one command; GitHub Actions runs the full test suite on every push

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Framework | Express 4 |
| ORM / DB | Prisma 6, PostgreSQL 16 |
| Cache | Redis 7 (ioredis) |
| Auth | jsonwebtoken, bcryptjs |
| Validation | Zod |
| Logging | Winston |
| Docs | swagger-jsdoc, swagger-ui-express |
| Testing | Jest, ts-jest, Supertest |
| CI/CD | GitHub Actions, Docker, docker-compose |

## Getting Started

### Option A — Docker (recommended)

The only prerequisite is Docker (with docker-compose).

```bash
cd "start/Task Management API"
docker compose up --build
```

This starts PostgreSQL, Redis, and the API, applies database migrations automatically, and serves the API at **http://localhost:3000**. Verify with:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

To stop: `docker compose down` (add `-v` to also delete the database volume).

### Option B — Run locally

**Prerequisites:** Node.js 22+, PostgreSQL, and Redis running locally.

1. **Install dependencies:**

   ```bash
   cd "start/Task Management API"
   npm install
   ```

2. **Create the database and user** (in `psql`):

   ```sql
   CREATE USER taskuser WITH PASSWORD 'taskpass' CREATEDB;
   CREATE DATABASE taskdb OWNER taskuser;
   ```

   (`CREATEDB` is needed for Prisma's shadow database during development migrations.)

3. **Configure environment variables** — copy the example file and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description | Example |
   |---|---|---|
   | `DATABASE_URL` | PostgreSQL connection string | `postgresql://taskuser:taskpass@localhost:5432/taskdb?schema=public` |
   | `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
   | `JWT_SECRET` | Secret for signing tokens (use `openssl rand -hex 32`) | *(long random string)* |
   | `JWT_EXPIRES_IN` | Token lifetime | `1h` |
   | `PORT` | API port | `3000` |

4. **Apply migrations and generate the Prisma client:**

   ```bash
   npx prisma migrate dev
   ```

5. **Start the dev server** (auto-reloads on changes):

   ```bash
   npm run dev
   ```

For a production-style run: `npm run build` then `npm start`.

## API Reference

Interactive documentation with a try-it-out interface is available at **http://localhost:3000/api-docs** while the server is running.

### Auth

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user (`email`, `password`, optional `name`) | — |
| POST | `/api/auth/login` | Log in; returns a JWT | — |

### Tasks

All task endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List tasks (own tasks; admins see all). Cached in Redis for 60s |
| POST | `/api/tasks` | Create a task (`title`, optional `description`, `status`) |
| GET | `/api/tasks/:id` | Get a single task |
| PUT | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task (returns 204) |
| DELETE | `/api/tasks/admin/:id` | Delete any task — **ADMIN only** |

Task `status` is one of `TODO`, `IN_PROGRESS`, `DONE` (defaults to `TODO`).

### Example flow

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"password123","name":"Me"}'

# Log in and capture the token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"password123"}' \
  | grep -oP '"token":"\K[^"]+')

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"My first task"}'

# List tasks
curl http://localhost:3000/api/tasks -H "Authorization: Bearer $TOKEN"
```

## Testing

The test suite lives in `src/__tests__/` and has two layers:

- **Unit tests** (`auth.middleware.test.ts`) — exercise the `authenticate` and `authorize` middleware in isolation with mocked request/response objects: missing headers, invalid tokens, valid tokens, and role enforcement.
- **Integration tests** (`api.integration.test.ts`) — use Supertest against the Express app to run the full auth and task lifecycle (register → login → create → list → update → delete) against a real PostgreSQL database. **Redis is mocked** with an in-memory store, which also lets the tests assert that caching and cache invalidation actually happen.

Run them with PostgreSQL running (Redis is not required — it's mocked):

```bash
npm test
```

Tests run sequentially (`--runInBand`) and clean up their own data afterward.

## Caching Strategy

`GET /api/tasks` uses a cache-aside pattern: the first request hits PostgreSQL and stores the serialized result in Redis under `tasks:<userId>` with a 60-second TTL; subsequent requests within the TTL are served from Redis. Any write (create, update, delete) deletes the owner's cache key so stale data is never served.

## CI/CD

Every push runs the GitHub Actions workflow in `.github/workflows/ci.yml`, which:

1. Spins up PostgreSQL and Redis as service containers (with health checks)
2. Installs dependencies with `npm ci`
3. Generates the Prisma client and applies migrations to a fresh database
4. Type-checks and builds the project
5. Runs the full Jest suite

A green check on a commit means the project installs, builds, migrates, and passes all tests from scratch on a clean machine.

## Project Structure

```
start/Task Management API/
├── prisma/
│   ├── schema.prisma          # User & Task models, Role & TaskStatus enums
│   └── migrations/            # Versioned SQL migrations
├── src/
│   ├── index.ts               # Entry point
│   ├── app.ts                 # Express app factory (routes, middleware, swagger)
│   ├── config/                # prisma, redis, logger, swagger setup
│   ├── controllers/           # auth & task request handlers
│   ├── middleware/            # JWT auth, RBAC, request/error logging
│   ├── routes/                # Route definitions + OpenAPI annotations
│   ├── types/                 # Express Request augmentation (req.user)
│   └── __tests__/             # Jest unit & integration tests
├── Dockerfile
├── docker-compose.yml
└── jest.config.js
```