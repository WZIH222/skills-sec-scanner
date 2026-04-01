# Quick Start Guide

This guide covers how to start the project in **development** and **production (Docker)** environments.

---

## Development Environment

### Prerequisites

- Node.js 20+
- pnpm 9+
- SQLite (no manual setup needed — Prisma creates it automatically)

### Steps

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment variables**

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The default `.env` uses SQLite local database — no extra configuration needed.

**3. Initialize the database**

```bash
npm run db:migrate
npm run db:seed
```

**4. Start the dev server**

```bash
npm run dev
```

Services will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001


---

## Production Environment (Docker)

### Prerequisites

- Docker 24+
- Docker Compose v2+

### Steps

**1. Configure environment variables**

All environment variables are managed in `docker-compose.yml`. No separate `.env` files are needed.

Edit the `api` and `web` service environments in `docker-compose.yml` based on `.env.example`:

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgresql://postgres:654321@db:5432/skills_sec
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-random-secret-here
  web:
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      JWT_SECRET: your-random-secret-here  # Must match api service
```

> **Note**: `JWT_SECRET` must be identical across both `api` and `web` services.

**2. Build and start**

```bash
docker-compose up --build
```

First-time build will:
- Build API and Web Docker images
- Create PostgreSQL database
- Start Redis

**3. Initialize the database (first time only)**

`prisma db push` runs automatically during the Docker build. You only need to run seed manually if your project has one:

```bash
docker-compose exec api npx prisma db seed
```

**4. Access services**

- Frontend: http://localhost:3000
- API: http://localhost:3001

---

## Common Operations

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
```

### Stop services

```bash
docker-compose down
```

### Restart services

```bash
docker-compose restart
```

### Enter containers

```bash
docker-compose exec api sh
docker-compose exec web sh
```

### Database operations

```bash
# Open Prisma Studio
docker-compose exec api npx prisma studio

# Run migrations
docker-compose exec api npx prisma db migrate

# Regenerate Prisma Client
docker-compose exec api npx prisma generate
```

### Rebuild (wipe all data)

```bash
docker-compose down -v     # Delete data volumes
docker-compose up --build # Rebuild from scratch
```

---

## Environment Differences

| Item | Development | Production |
|------|--------------|------------|
| Database | SQLite (local file) | PostgreSQL (Docker) |
| Rule loading | JSON files | JSON files (mounted into container) |
| Rule storage | Database (SQLite) | Database (PostgreSQL) |
| Redis | - | Built into Docker |
| AI analysis | Available | Available (requires API Key config) |

---

## FAQ

**Q: Docker build fails?**
- Make sure `docker-compose up --build` is run from the project root
- Check that environment variables in `docker-compose.yml` are correct

**Q: Database connection fails?**
- Confirm PostgreSQL container is running: `docker-compose ps db`
- Verify `DATABASE_URL` is correct

**Q: Rules not loading?**
- Development: restart `npm run dev`, seeder runs automatically
- Production: trigger seeder by visiting any API route

**Q: AI analysis not working?**
- Check `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set in `docker-compose.yml`
- Scanning must pass `options.aiEnabled = true`
