import InputForm from "@/components/Forms/InputForm";
import { fetchJSON } from "@/lib/api";
import { PokemonListItem } from "@/types/pokemon.types";
import Link from "next/link";
import Image from "next/image";

async function getData(page: number, q: string, sort: string) {
	const params = new URLSearchParams({ page: String(page), pageSize: "20", q, sort });
	return fetchJSON(`/pokemon?${params.toString()}`);
}

const toThreeDigits = (num: number) => {
	return num.toString().padStart(3, "0");
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
	const { results } = data;
	console.log(data);

	return (
		<>
			<InputForm />

			<div className="px-4 py-6 bg-background rounded-lg">
				<ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
					{results.map((p: PokemonListItem) => (
						<li key={p.id} className="bg-white rounded-xl drop-shadow-sm p-3 relative">
							<span className="absolute bottom-0 left-0 right-0 h-[40%] bg-background rounded-t-2xl rounded-b-xl -z-10" />
							<Link href={`/pokemon/${p.id}`} className="block">
								<div className="-mt-1 text-right text-sm text-gray-500">#{toThreeDigits(p.id)}</div>
								<div className="aspect-square relative">
									<Image
										src={p.image}
										alt={p.name}
										fill
										sizes="(max-width: 768px) 50vw, 25vw"
										className="object-contain"
									/>
								</div>
								<div className="text-sm text-center capitalize">{p.name}</div>
							</Link>
						</li>
					))}
				</ul>

				<div className="mt-4">Pagination Here!</div>
			</div>
		</>
	);
}
