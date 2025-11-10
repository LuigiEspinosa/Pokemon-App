# Generative AI tools

## Prompt

```md
You are an expert Next.js + TypeScript + Prisma engineer. Generate a small but production-leaning CRUD API and React table UI for a "Task" resource.

## Stack and constraints

- Next.js App Router (v15+), TypeScript.
- Prisma with SQLite (dev) but keep schema portable for Postgres.
- Authentication: assume a basic User exists. Create a getCurrentUser() helper that returns { id: string } (mocked) and scope all queries by userId. If no user, return 401.

- Routes:

  - POST /api/tasks create
  - GET /api/tasks list (pagination, optional filters status, q (title/desc), dueFrom, dueTo)
  - GET /api/tasks/:id read (must belong to user)
  - PATCH /api/tasks/:id update (partial)
  - DELETE /api/tasks/:id delete

- Task fields:

  - id,
  - title (1..120),
  - description (0..2000),
  - status in ["todo","in_progress","done"],
  - dueDate (nullable ISO date),
  - userId,
  - createdAt,
  - updatedAt.

- Add optimistic concurrency via updatedAt precondition on updates.
- Return JSON with consistent shapes { data, error }.
- Prevent overposting (only allow whitelisted fields).

- Add a lightweight React client:

  - Table with columns: Title, Status, Due, Updated, Actions.
  - Create/Edit modal with client validation.
  - Pagination controls.

- Use fetch with proper methods; handle 401/400/409/500.
```

## Output Code

## How I validate AI's outoput

Check suggestions:

- Usually update the syntax or structure to the most recent version of the given frameworks.
- Confirmed API returns the agreed envelope { data, error } and proper status codes: 201 for create, 400 on errors, 401 unauthenticated, 409 on concurrency conflict, 404 when scoping by userId fails to find a record.
- Exercised GET /api/tasks with combinations of status, q, and date ranges; verified total count aligns with items.length over pages.

Some validations:

- `title` length 1..120; `description` ≤ 2000.
- `status` limited to enum values; unknown fields are ignored.
- `dueDate` accepts ISO string → converted to Date; supports null for clearing.
- List filters validate dates and constrain pageSize to [1..100].
- Confirm `req.json()` is wrapped to handle empty/malformed JSON without throwing
