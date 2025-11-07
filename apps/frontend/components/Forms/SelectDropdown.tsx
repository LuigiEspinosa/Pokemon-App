"use client";

import { MouseEvent, SetStateAction, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SelectDropdown() {
	const dropdownRef = useRef<HTMLDivElement | null>(null);
	const router = useRouter();
	const params = useSearchParams();

	const currentSort = (params.get("sort") ?? "id") as "id" | "name";
	const [sortBy, setSortBy] = useState<"id" | "name">(currentSort);
	const [isOpen, setIsOpen] = useState<boolean>(false);

	const handleChange = (event: { target: { value: SetStateAction<string> } }) => {
		const next = (event.target.value as "id" | "name") || "id";
		setSortBy(next);

		// Build new URL preserving q, resetting page
		const nextParams = new URLSearchParams(params.toString());
		nextParams.set("sort", next);
		nextParams.set("page", "1");
		router.push(`/?${nextParams.toString()}`, { scroll: false });

		setIsOpen(false);
	};

	const toggleDropdown = (e: MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		setIsOpen((o) => !o);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside as unknown as EventListener);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside as unknown as EventListener);
		};
	}, []);

	return (
		<div
			ref={dropdownRef}
			className="relative w-8 h-8 rounded-2xl p-4 border-none shadow-inner-2 bg-background"
		>
			<button
				type="button"
				onClick={(e) => toggleDropdown(e)}
				className="absolute top-0 right-0 w-8 h-8 rounded-2xl"
				aria-haspopup="true"
				aria-expanded={isOpen}
				aria-label="Open sort menu"
			>
				#
			</button>

			{isOpen && (
				<div className="absolute mt-10 bg-primary rounded-xl w-36 p-2 -right-2 top-0 z-20">
					<h3 className="text-xs font-bold font-poppins text-white py-4 text-center">Sort by:</h3>
					<div className="bg-background rounded-xl w-full py-4 px-6">
						<div className="flex items-center mb-2">
							<input
								type="radio"
								id="id"
								name="sort-radio"
								value="id"
								checked={sortBy === "id"}
								onChange={handleChange}
								className="w-3 h-3"
							/>
							<label htmlFor="id" className="ml-2 font-poppins text-[12px] text-dark-gray">
								Number
							</label>
						</div>
						<div className="flex items-center">
							<input
								type="radio"
								id="name"
								name="sort-radio"
								value="name"
								checked={sortBy === "name"}
								onChange={handleChange}
								className="w-3 h-3"
							/>
							<label htmlFor="name" className="ml-2 font-poppins text-[12px] text-dark-gray">
								Name
							</label>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
