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

```prisma
// SQLite in dev; swap provider to "postgresql" for PG.
// Keep field types portable.
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = env("DATABASE_PROVIDER") // "sqlite" or "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    String  @id @db.Uuid
  email String  @unique
  // ...
  tasks Task[]
}

enum TaskStatus {
  todo
  in_progress
  done
}

model Task {
  id          String      @id @default(cuid())
  title       String      @db.VarChar(120)
  description String      @default("") @db.VarChar(2000)
  status      TaskStatus  @default(todo)
  dueDate     DateTime?   // ISO date; nullable
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([userId, status, dueDate])
  @@index([userId, updatedAt])
}
```

```ts
// Replace with your real auth. This mock is scoped per request.
export type CurrentUser = { id: string } | null;

export async function getCurrentUser(req: Request): Promise<CurrentUser> {
	// Example: read cookie/header/JWT; here we mock a user for dev convenience.
	const devUserId = process.env.DEV_USER_ID ?? "11111111-1111-4111-8111-111111111111";
	const emulateNoAuth = req.headers.get("x-no-auth") === "1";
	if (emulateNoAuth) return null;
	return { id: devUserId };
}
```

```ts
import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number | ResponseInit) {
	return NextResponse.json({ data, error: null }, init);
}
export function created<T>(data: T) {
	return NextResponse.json({ data, error: null }, { status: 201 });
}
export function err(status: number, message: string, details?: unknown) {
	return NextResponse.json({ data: null, error: { message, details } }, { status });
}
export function badRequest(message: string, details?: unknown) {
	return err(400, message, details);
}
export function unauthorized() {
	return err(401, "Unauthorized");
}
export function notFound(message = "Not found") {
	return err(404, message);
}
export function conflict(message = "Conflict", details?: unknown) {
	return err(409, message, details);
}
export function serverError(e: unknown) {
	return err(500, "Internal Server Error", normalizeError(e));
}

function normalizeError(e: unknown) {
	if (e instanceof Error)
		return {
			name: e.name,
			message: e.message,
			stack: process.env.NODE_ENV === "development" ? e.stack : undefined,
		};
	return e;
}
```

```ts
import { prisma } from "@/src/lib/prisma";
import { created, ok, badRequest, serverError, unauthorized } from "@/src/lib/http";
import { getCurrentUser } from "@/src/lib/auth";
import { createTaskSchema, listQuerySchema } from "@/src/lib/validators/task";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
	const user = await getCurrentUser(req);
	if (!user) return unauthorized();

	try {
		const json = await req.json();
		const parsed = createTaskSchema.safeParse(json);
		if (!parsed.success) return badRequest("Invalid body", parsed.error.flatten());

		const { title, description, status, dueDate } = parsed.data;

		const task = await prisma.task.create({
			data: {
				title,
				description,
				status,
				dueDate: dueDate ? new Date(dueDate) : null,
				userId: user.id,
			},
		});

		return created(task);
	} catch (e) {
		return serverError(e);
	}
}

export async function GET(req: NextRequest) {
	const user = await getCurrentUser(req);
	if (!user) return unauthorized();

	try {
		const url = new URL(req.url);
		const params = Object.fromEntries(url.searchParams.entries());
		const parsed = listQuerySchema.safeParse(params);
		if (!parsed.success) return badRequest("Invalid query", parsed.error.flatten());

		const { page, pageSize, status, q, dueFrom, dueTo } = parsed.data;

		const where = {
			userId: user.id,
			...(status ? { status } : {}),
			...(q
				? {
						OR: [
							{ title: { contains: q, mode: "insensitive" } },
							{ description: { contains: q, mode: "insensitive" } },
						],
				  }
				: {}),
			...(dueFrom || dueTo
				? {
						dueDate: {
							...(dueFrom ? { gte: new Date(dueFrom) } : {}),
							...(dueTo ? { lte: new Date(dueTo) } : {}),
						},
				  }
				: {}),
		};

		const [items, total] = await Promise.all([
			prisma.task.findMany({
				where,
				orderBy: { updatedAt: "desc" },
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.task.count({ where }),
		]);

		return ok({
			items,
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		});
	} catch (e) {
		return serverError(e);
	}
}
```

```ts
import { prisma } from "@/src/lib/prisma";
import { ok, notFound, badRequest, conflict, serverError, unauthorized } from "@/src/lib/http";
import { getCurrentUser } from "@/src/lib/auth";
import { updateTaskSchema } from "@/src/lib/validators/task";
import { NextRequest } from "next/server";

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
	const user = await getCurrentUser(req);
	if (!user) return unauthorized();

	try {
		const task = await prisma.task.findFirst({ where: { id: params.id, userId: user.id } });
		if (!task) return notFound("Task not found");
		return ok(task);
	} catch (e) {
		return serverError(e);
	}
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
	const user = await getCurrentUser(req);
	if (!user) return unauthorized();

	try {
		const json = await req.json();
		const parsed = updateTaskSchema.safeParse(json);
		if (!parsed.success) return badRequest("Invalid body", parsed.error.flatten());

		const { prevUpdatedAt, ...fields } = parsed.data;

		// Whitelist overposting (just to be explicit even after validation)
		const data: Record<string, unknown> = {};
		if ("title" in fields) data.title = fields.title;
		if ("description" in fields) data.description = fields.description;
		if ("status" in fields) data.status = fields.status;
		if ("dueDate" in fields) data.dueDate = fields.dueDate ?? null;

		// Optimistic concurrency: updateMany with precondition on updatedAt.
		const result = await prisma.task.updateMany({
			where: { id: params.id, userId: user.id, updatedAt: new Date(prevUpdatedAt) },
			data,
		});

		if (result.count === 0) {
			// Determine if missing or conflict:
			const exists = await prisma.task.findFirst({ where: { id: params.id, userId: user.id } });
			if (!exists) return notFound("Task not found");
			return conflict("Precondition failed: task was modified by someone else");
		}

		const updated = await prisma.task.findFirst({ where: { id: params.id, userId: user.id } });
		return ok(updated);
	} catch (e) {
		return serverError(e);
	}
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
	const user = await getCurrentUser(req);
	if (!user) return unauthorized();

	try {
		// Scope deletion to owner
		const deleted = await prisma.task.deleteMany({ where: { id: params.id, userId: user.id } });
		if (deleted.count === 0) return notFound("Task not found");
		return ok({ id: params.id });
	} catch (e) {
		return serverError(e);
	}
}
```

```tsx
import TaskTable from "@/components/tasks/TaskTable";

export const dynamic = "force-dynamic";

export default function TasksPage() {
	return (
		<main className="mx-auto max-w-5xl p-6">
			<h1 className="text-2xl font-semibold mb-4">Tasks</h1>
			<TaskTable />
		</main>
	);
}
```

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "@/src/lib/validators/task";

const formSchema = createTaskSchema.extend({
	// For edit we include prevUpdatedAt; for create it's ignored
	prevUpdatedAt: z.string().datetime().optional(),
});

type BaseTask = {
	id: string;
	title: string;
	description: string;
	status: "todo" | "in_progress" | "done";
	dueDate: string | null;
	updatedAt: string;
};

type Props = {
	open: boolean;
	onClose: () => void;
	onSaved: () => void;
	initial?: BaseTask | null; // null => create
};

export default function TaskModal({ open, onClose, onSaved, initial }: Props) {
	const isEdit = !!initial;
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
	const [dueDate, setDueDate] = useState<string | "">("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setError(null);
			if (initial) {
				setTitle(initial.title);
				setDescription(initial.description ?? "");
				setStatus(initial.status);
				setDueDate(initial.dueDate ? initial.dueDate.slice(0, 10) : "");
			} else {
				setTitle("");
				setDescription("");
				setStatus("todo");
				setDueDate("");
			}
		}
	}, [open, initial]);

	const payload = useMemo(() => {
		const base = {
			title,
			description,
			status,
			dueDate: dueDate ? new Date(dueDate).toISOString() : null,
		};
		return isEdit ? { ...base, prevUpdatedAt: initial!.updatedAt } : base;
	}, [title, description, status, dueDate, isEdit, initial]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		// Client validation
		const parsed = (
			isEdit ? updateTaskSchema.partial({ prevUpdatedAt: false }) : formSchema
		).safeParse(payload);
		if (!parsed.success) {
			setError("Please fix validation errors.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch(isEdit ? `/api/tasks/${initial!.id}` : "/api/tasks", {
				method: isEdit ? "PATCH" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const body = await res.json();
			if (!res.ok) {
				if (res.status === 401) setError("You are not signed in.");
				else if (res.status === 400) setError(body?.error?.message ?? "Invalid request.");
				else if (res.status === 409) setError("This task was modified elsewhere. Please reload.");
				else setError("Something went wrong.");
				return;
			}

			onSaved();
			onClose();
		} catch (e) {
			setError("Network error.");
		} finally {
			setSaving(false);
		}
	}

	if (!open) return null;

	return (
		<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
			<div className="bg-white text-black w-full max-w-lg rounded-2xl shadow p-6">
				<h2 className="text-lg font-semibold mb-4">{isEdit ? "Edit Task" : "New Task"}</h2>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium">Title</label>
						<input
							className="mt-1 w-full rounded border p-2"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={120}
							required
						/>
					</div>
					<div>
						<label className="block text-sm font-medium">Description</label>
						<textarea
							className="mt-1 w-full rounded border p-2"
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={2000}
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium">Status</label>
							<select
								className="mt-1 w-full rounded border p-2"
								value={status}
								onChange={(e) => setStatus(e.target.value as any)}
							>
								<option value="todo">Todo</option>
								<option value="in_progress">In Progress</option>
								<option value="done">Done</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium">Due Date</label>
							<input
								type="date"
								className="mt-1 w-full rounded border p-2"
								value={dueDate}
								onChange={(e) => setDueDate(e.target.value)}
							/>
						</div>
					</div>

					{error && <p className="text-sm text-red-600">{error}</p>}

					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							className="px-4 py-2 rounded border"
							onClick={onClose}
							disabled={saving}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-4 py-2 rounded bg-black text-white"
							disabled={saving}
						>
							{saving ? "Saving..." : isEdit ? "Save" : "Create"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
```

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import TaskModal from "./TaskModal";

type Task = {
	id: string;
	title: string;
	description: string;
	status: "todo" | "in_progress" | "done";
	dueDate: string | null;
	createdAt: string;
	updatedAt: string;
};

type ListResponse = {
	items: Task[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
};

function fmtDate(s?: string | null) {
	if (!s) return "—";
	const d = new Date(s);
	return d.toLocaleDateString();
}
function fmtDateTime(s?: string | null) {
	if (!s) return "—";
	const d = new Date(s);
	return d.toLocaleString();
}

export default function TaskTable() {
	const [items, setItems] = useState<Task[]>([]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const [q, setQ] = useState("");
	const [status, setStatus] = useState<"" | "todo" | "in_progress" | "done">("");
	const [dueFrom, setDueFrom] = useState("");
	const [dueTo, setDueTo] = useState("");

	const [modalOpen, setModalOpen] = useState(false);
	const [editTask, setEditTask] = useState<Task | null>(null);

	const query = useMemo(() => {
		const sp = new URLSearchParams();
		sp.set("page", String(page));
		sp.set("pageSize", String(pageSize));
		if (q.trim()) sp.set("q", q.trim());
		if (status) sp.set("status", status);
		if (dueFrom) sp.set("dueFrom", new Date(dueFrom).toISOString());
		if (dueTo) sp.set("dueTo", new Date(dueTo).toISOString());
		return sp.toString();
	}, [page, pageSize, q, status, dueFrom, dueTo]);

	async function load() {
		setLoading(true);
		setErr(null);
		try {
			const res = await fetch(`/api/tasks?${query}`, { method: "GET" });
			const body = await res.json();
			if (!res.ok) {
				if (res.status === 401) setErr("You are not signed in.");
				else setErr(body?.error?.message ?? "Failed to load tasks.");
				return;
			}
			const data = body.data as ListResponse;
			setItems(data.items);
			setPage(data.page);
			setPageSize(data.pageSize);
			setTotalPages(data.totalPages);
		} catch {
			setErr("Network error.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
	}, [query]);

	async function handleDelete(id: string) {
		if (!confirm("Delete this task?")) return;
		const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			alert(body?.error?.message ?? "Delete failed.");
			return;
		}
		load();
	}

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-wrap items-end gap-3">
				<div>
					<label className="block text-sm">Search</label>
					<input
						className="border rounded p-2"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Title or description"
					/>
				</div>
				<div>
					<label className="block text-sm">Status</label>
					<select
						className="border rounded p-2"
						value={status}
						onChange={(e) => setStatus(e.target.value as any)}
					>
						<option value="">All</option>
						<option value="todo">Todo</option>
						<option value="in_progress">In Progress</option>
						<option value="done">Done</option>
					</select>
				</div>
				<div>
					<label className="block text-sm">Due From</label>
					<input
						type="date"
						className="border rounded p-2"
						value={dueFrom}
						onChange={(e) => setDueFrom(e.target.value)}
					/>
				</div>
				<div>
					<label className="block text-sm">Due To</label>
					<input
						type="date"
						className="border rounded p-2"
						value={dueTo}
						onChange={(e) => setDueTo(e.target.value)}
					/>
				</div>
				<div className="ml-auto flex gap-2">
					<button
						className="px-3 py-2 border rounded"
						onClick={() => {
							setPage(1);
							load();
						}}
					>
						Apply
					</button>
					<button
						className="px-3 py-2 border rounded"
						onClick={() => {
							setQ("");
							setStatus("");
							setDueFrom("");
							setDueTo("");
							setPage(1);
						}}
					>
						Reset
					</button>
					<button
						className="px-3 py-2 bg-black text-white rounded"
						onClick={() => {
							setEditTask(null);
							setModalOpen(true);
						}}
					>
						New Task
					</button>
				</div>
			</div>

			{/* Table */}
			<div className="overflow-x-auto rounded border">
				<table className="min-w-full text-sm">
					<thead className="bg-gray-50">
						<tr className="[&>th]:px-3 [&>th]:py-2 text-left">
							<th>Title</th>
							<th>Status</th>
							<th>Due</th>
							<th>Updated</th>
							<th className="w-1">Actions</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr>
								<td className="px-3 py-4 text-center" colSpan={5}>
									Loading…
								</td>
							</tr>
						) : items.length === 0 ? (
							<tr>
								<td className="px-3 py-4 text-center" colSpan={5}>
									No tasks
								</td>
							</tr>
						) : (
							items.map((t) => (
								<tr key={t.id} className="border-t [&>td]:px-3 [&>td]:py-2">
									<td className="font-medium">{t.title}</td>
									<td className="capitalize">{t.status.replace("_", " ")}</td>
									<td>{fmtDate(t.dueDate)}</td>
									<td>{fmtDateTime(t.updatedAt)}</td>
									<td className="text-right">
										<div className="flex gap-2 justify-end">
											<button
												className="px-2 py-1 border rounded"
												onClick={() => {
													setEditTask(t);
													setModalOpen(true);
												}}
											>
												Edit
											</button>
											<button
												className="px-2 py-1 border rounded"
												onClick={() => handleDelete(t.id)}
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<div className="text-sm text-gray-600">
					Page {page} of {totalPages}
				</div>
				<div className="flex items-center gap-2">
					<button
						className="px-3 py-1 border rounded disabled:opacity-50"
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}
					>
						Prev
					</button>
					<button
						className="px-3 py-1 border rounded disabled:opacity-50"
						disabled={page >= totalPages}
						onClick={() => setPage((p) => p + 1)}
					>
						Next
					</button>
					<select
						className="border rounded p-1"
						value={pageSize}
						onChange={(e) => {
							setPageSize(Number(e.target.value));
							setPage(1);
						}}
					>
						{[10, 20, 50, 100].map((n) => (
							<option key={n} value={n}>
								{n}/page
							</option>
						))}
					</select>
				</div>
			</div>

			<TaskModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onSaved={() => load()}
				initial={editTask}
			/>

			{err && <p className="text-sm text-red-600">{err}</p>}
		</div>
	);
}
```

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
- Standard REST with predictable envelopes.
