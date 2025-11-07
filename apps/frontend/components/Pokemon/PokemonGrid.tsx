"use client";

import Link from "next/link";
import { useState, MouseEvent } from "react";
import ImageWithFallback from "@/components/Images/ImageWithFallback";
import SvgLogo from "@/components/Images/SvgLogo";
import PokemonSheet from "./PokemonSheet";
import { normalizeDigits, normalizeName } from "@/utils/useNormalize";

type PokemonListItem = { id: number; name: string; image?: string };

export default function PokemonGrid({ results }: { results: PokemonListItem[] }) {
	const [openId, setOpenId] = useState<number | null>(null);

	const handleCardClick = (e: MouseEvent, id: number) => {
		e.preventDefault();
		setOpenId(id);
	};

	return (
		<>
			<ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
				{results.map((p) => (
					<li key={p.id} className="bg-white rounded-xl drop-shadow-sm p-3 relative">
						<span className="absolute bottom-0 left-0 right-0 h-[40%] bg-background rounded-t-2xl rounded-b-xl -z-10" />
						<Link
							href={`/pokemon/${p.id}`}
							className="block"
							onClick={(e) => handleCardClick(e, p.id)}
						>
							<div className="-mt-1 text-right text-sm text-gray-500">#{normalizeDigits(p.id)}</div>
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

			<PokemonSheet id={openId} onClose={() => setOpenId(null)} />
		</>
	);
}
