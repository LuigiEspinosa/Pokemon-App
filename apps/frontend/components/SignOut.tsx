"use client";

import { logoutAction } from "@/lib/api";
import { usePathname, redirect } from "next/navigation";

export default function SignOut() {
	const pathname = usePathname();
	const isLoginPage = pathname === "/login";

	async function handleSignOut() {
		const res = await logoutAction();
		if (res.ok) {
			redirect("/login");
		}
	}

	return (
		!isLoginPage && (
			<button
				onClick={handleSignOut}
				className="text-md font-poppins font-bold hover:opacity-80 appearance-none"
			>
				Sign Out
			</button>
		)
	);
}
