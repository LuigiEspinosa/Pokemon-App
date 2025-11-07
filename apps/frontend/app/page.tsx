import Link from "next/link";
import { redirect } from "next/navigation";

import InputForm from "@/components/Forms/InputForm";
import SelectDropdown from "@/components/Forms/SelectDropdown";
import Pagination from "@/components/Pagination";
import SvgLogo from "@/components/Images/SvgLogo";
import ImageWithFallback from "@/components/Images/ImageWithFallback";

import { fetchJSON } from "@/lib/api";
import { PokemonListItem } from "@/types/pokemon.types";

export const revalidate = 0; // SSR for freshness & auth

async function getData(page: number, q: string, sort: string) {
	const params = new URLSearchParams({ page: String(page), pageSize: "20", q, sort });
	return fetchJSON(`/pokemon?${params.toString()}`);
}

const toThreeDigits = (num: number) => {
	return num.toString().padStart(3, "0");
};

const normalizeName = (name: string) => {
	return name.replaceAll("-", " ");
};

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
				<ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
					{results.map((p: PokemonListItem) => (
						<li key={p.id} className="bg-white rounded-xl drop-shadow-sm p-3 relative">
							<span className="absolute bottom-0 left-0 right-0 h-[40%] bg-background rounded-t-2xl rounded-b-xl -z-10" />
							<Link href={`/pokemon/${p.id}`} className="block">
								<div className="-mt-1 text-right text-sm text-gray-500">#{toThreeDigits(p.id)}</div>
								<div className="aspect-square relative max-w-28 mx-auto my-2">
									{p.image ? (
										<ImageWithFallback src={p.image} alt={p.name} />
									) : (
										<SvgLogo width={72} height={72} />
									)}
								</div>
								<div className="text-sm text-center capitalize">{normalizeName(p.name)}</div>
							</Link>
						</li>
					))}
				</ul>

				<Pagination page={pageNumber} pageSize={20} total={count} q={qString} sort={sortBy} />
			</div>
		</>
	);
}
