import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Link from "next/link";

import SvgLogo from "@/components/Images/SvgLogo";

import "./globals.css";

const poppinstSans = Poppins({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	weight: "500",
});

export const metadata: Metadata = {
	title: "Pokémon Browser",
	description: "Search, sort, and explore Pokémon with a secure login.",
	metadataBase: new URL("https://pokemon.cuatro.dev"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className="min-h-screen bg-primary text-white">
				<header className="sticky top-0 z-20 bg-primary">
					<nav className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
						<Link href="/" className="font-bold inline-flex items-center font-poppins text-2xl">
							<SvgLogo fill="#fff" width={24} height={24} className="mr-2" /> Pokédex
						</Link>
						<a className="text-md font-poppins font-bold" href="/login">
							Login
						</a>
					</nav>
				</header>

				<main
					className={`${poppinstSans.className} mt-1 mx-auto max-w-5xl px-4 pb-4 font-poppins text-dark-gray`}
				>
					{children}
				</main>

				<footer className="mt-4 border-t py-8 px-4 text-center text-sm text-gray-500 bg-white flex-wrap">
					Built with Next.js + Express - React Technical Interview Exercise
				</footer>
			</body>
		</html>
	);
}
