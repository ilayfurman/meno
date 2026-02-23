# Meno Backend (Fastify + Drizzle + Postgres)

## Run locally

1. Install deps:

```bash
cd backend
npm install
```

2. Create env:

```bash
cp .env.example .env
```

3. Generate migrations and run:

```bash
npm run db:generate
npm run db:migrate
```

4. Start API:

```bash
npm run dev
```

API default: `http://localhost:4000`

## Notes

- Auth accepts Clerk bearer token in production.
- In development, if `ALLOW_DEV_AUTH=true`, requests can omit bearer token and will use `x-dev-clerk-user-id` or fallback user id.
- Core endpoints are under `/v1/*`.
