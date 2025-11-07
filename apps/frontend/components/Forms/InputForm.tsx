"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import SvgSearch from "../Images/SvgSearch";

interface IInputForm {
	q: string;
	sort: "id" | "name";
}

export default function InputForm({ q, sort }: IInputForm) {
	const id = useId();
	const router = useRouter();
	const params = useSearchParams();
	const [value, setValue] = useState(q);

	useEffect(() => {
		const handler = setTimeout(() => {
			const currentQ = params.get("q") ?? "";
			if (value === currentQ) return;

			const next = new URLSearchParams(params.toString());
			next.set("q", value);
			next.set("sort", sort);
			next.set("page", "1");
			router.push(`/?${next.toString()}`, { scroll: false });
		}, 400);

		return () => clearTimeout(handler);
	}, [value, sort, params, router]);

	return (
		<div className="flex-1 min-w-[220px] h-8 relative bg-background rounded-4xl">
			<SvgSearch
				width={20}
				height={20}
				className="absolute top-1.5 left-4"
				fill="var(--color-primary)"
			/>

			<input
				id={id}
				type="search"
				placeholder="Search"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				className="border-none w-full h-8 rounded-4xl py-2 pr-4 pl-12 shadow-inner-2 font-poppins text-sm text-medium focus:outline-none"
			/>
		</div>
	);
}
