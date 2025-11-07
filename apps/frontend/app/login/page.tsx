"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { loginAction } from "@/lib/api";

const schema = z.object({
	username: z.string().min(1, "Username is required"),
	password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError(null);

		const form = new FormData(e.currentTarget);
		const parse = schema.safeParse({
			username: form.get("username"),
			password: form.get("password"),
		});

		if (!parse.success) {
			setError(parse.error.issues[0].message);
			return;
		}

		setLoading(true);
		const res = await loginAction(form);
		setLoading(false);

		if ("error" in res) setError(res.error);
		else router.replace("/");
	}

	return (
		<div className="mx-auto max-w-sm p-6 bg-white rounded-2xl shadow">
			<h1 className="text-2xl font-bold mb-4">Login</h1>

			<form onSubmit={onSubmit} className="space-y-4">
				<div>
					<label className="block text-sm mb-1">Username</label>
					<input
						name="username"
						className="w-full border rounded px-3 py-2"
						placeholder="Username"
					/>
				</div>
				<div>
					<label className="block text-sm mb-1">Password</label>
					<input
						name="password"
						type="password"
						className="w-full border rounded px-3 py-2"
						placeholder="Password"
					/>
				</div>

				{error && <p className="text-red-600 text-sm">{error}</p>}

				<button disabled={loading} className="w-full bg-black text-white rounded px-3 py-2">
					{loading ? "Signing in…" : "Sign in"}
				</button>
			</form>
		</div>
	);
}
