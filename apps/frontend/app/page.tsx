import { redirect } from "next/navigation";

import InputForm from "@/components/Forms/InputForm";
import SelectDropdown from "@/components/Forms/SelectDropdown";
import Pagination from "@/components/Pagination";

import { fetchJSON } from "@/lib/api";
import PokemonGrid from "@/components/Pokemon/PokemonGrid";

export const revalidate = 0; // SSR for freshness & auth

async function getData(page: number, q: string, sort: string) {
	const params = new URLSearchParams({ page: String(page), pageSize: "20", q, sort });
	return fetchJSON(`pokemon?${params.toString()}`);
}

export default async function Home({
	searchParams,
}: {
	searchParams: { page?: string; q?: string; sort?: "id" | "name" };
}) {
	const { page, q, sort } = await searchParams;

	const pageNumber = Number(page || "1");
	const qString = q || "";
	const sortBy = (sort || "id") as "id" | "name";

	const data = await getData(pageNumber, qString, sortBy);
	const { results, count } = data;

	const size = 20;
	const totalPages = Math.max(1, Math.ceil(count / size));

	if (pageNumber < 1) {
		const qs = new URLSearchParams({ q: qString, sort: sortBy, page: "1" });
		redirect(`/?${qs.toString()}`);
	}

	if (pageNumber > totalPages) {
		const qs = new URLSearchParams({
			q: qString,
			sort: sortBy,
			page: String(totalPages),
		});
		redirect(`/?${qs.toString()}`);
	}

	return (
		<>
			<div className="flex gap-6 px-2 pb-8 items-center">
				<InputForm q={qString} sort={sortBy} />
				<SelectDropdown />
			</div>

			<div className="px-4 py-6 bg-background rounded-lg">
				<PokemonGrid results={results} />
				<Pagination page={pageNumber} pageSize={20} total={count} q={qString} sort={sortBy} />
			</div>
		</>
	);
}
