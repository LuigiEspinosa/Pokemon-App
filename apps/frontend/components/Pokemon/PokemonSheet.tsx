"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image, { ImageLoaderProps } from "next/image";
import { gsap } from "gsap";
import { fetchJSON } from "@/lib/api";
import { PokemonData } from "@/types/pokemon.types";
import { normalizeDigits } from "@/utils/useNormalize";

import SvgArrow from "../Images/SvgArrow";
import SvgLogo from "../Images/SvgLogo";
import { formatStatName } from "@/utils/formatStats";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

const TYPE_COLORS: Record<string, string> = {
	bug: "#93C33D",
	dark: "#5A5366",
	dragon: "#0C6CC4",
	electric: "#F4D23C",
	fairy: "#EC8FE6",
	fighting: "#CE416B",
	fire: "#FF9D55",
	flying: "#8FA8DD",
	ghost: "#5269AC",
	grass: "#63BC5A",
	ground: "#D97845",
	ice: "#73CEC0",
	normal: "#919AA2",
	poison: "#B567CE",
	psychic: "#FA7179",
	rock: "#C5B78C",
	steel: "#5A8EA2",
	water: "#5090D6",
};

function useLockBodyScroll(locked: boolean) {
	useEffect(() => {
		if (!locked) return;
		const prev = document.documentElement.style.overflow;
		document.documentElement.style.overflow = "hidden";

		return () => {
			document.documentElement.style.overflow = prev;
		};
	}, [locked]);
}

export default function PokemonSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
	const [data, setData] = useState<PokemonData | null>(null);

	const overlayRef = useRef<HTMLDivElement>(null);
	const sheetRef = useRef<HTMLDivElement>(null);
	const barsRef = useRef<HTMLDivElement[]>([]);

	useLockBodyScroll(!!id);

	useEffect(() => {
		let active = true;

		(async () => {
			if (!id) return setData(null);
			const raw = await fetchJSON(`pokemon/${id}`);
			if (active) setData(raw);
		})();

		return () => {
			active = false;
		};
	}, [id]);

	// open / close animations
	useEffect(() => {
		if (!id) return;

		const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
		const overlay = overlayRef.current!;
		const sheet = sheetRef.current!;

		if (!overlay || !sheet) {
			console.error("overlayRef or sheetRef is not set properly");
			return;
		}

		gsap.set(overlay, { autoAlpha: 0 });
		gsap.set(sheet, { y: "100%" });

		tl.to(overlay, { autoAlpha: 1, duration: 0.24 }).to(sheet, { y: "0%", duration: 0.4 }, "<");

		return () => {
			gsap.to(sheet, { y: "100%", duration: 0.24 });
			gsap.to(overlay, { autoAlpha: 0, duration: 0.24 });
		};
	}, [id]);

	// animate base stats once data arrives
	useEffect(() => {
		if (!data || !barsRef.current.length) return;
		const tl = gsap.timeline({ delay: 0.05 });

		barsRef.current.forEach((el, i) => {
			if (!el) return;

			const to = Number(el.dataset.to || 0);
			gsap.set(el, { width: "0%" });
			tl.to(el, { width: `${Math.min(100, (to / 255) * 100)}%`, duration: 0.6 }, i * 0.06);
		});
	}, [data]);

	// escape / click outside to close
	useEffect(() => {
		if (!id) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [id, onClose]);

	const primary = data?.types?.[0] ? TYPE_COLORS[data.types[0].toLowerCase()] : "#ffffff";

	if (!id) return null;

	return createPortal(
		<div aria-hidden={!id}>
			<div ref={overlayRef} className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

			<div
				ref={sheetRef}
				role="dialog"
				aria-modal
				className="fixed inset-x-0 bottom-0 z-50 h-[98dvh] rounded-t-3xl shadow-2xl overflow-y-auto"
				style={{ backgroundColor: primary }}
			>
				{data ? (
					<div className="relative p-5">
						<SvgLogo
							className="absolute top-6 right-2"
							width={240}
							height={240}
							fill="rgba(255, 255, 255, 0.1)"
						/>

						<section className="flex gap-3">
							<SvgArrow className="-mt-0.4" onClick={onClose} />

							<h1 className="flex justify-between items-center text-2xl font-bold capitalize text-white font-poppins tracking-wider w-full">
								{data.name}{" "}
								<span className="text-white text-xs mt-1.5">#{normalizeDigits(data.id)}</span>
							</h1>
						</section>

						<section className="relative mt-8 mx-auto aspect-4/3 max-w-md">
							<Image
								loader={passthroughLoader}
								src={
									data.sprites.other?.["official-artwork"]?.front_default ||
									data.sprites.front_default ||
									""
								}
								alt={data.name}
								className="object-contain"
								sizes="(max-width: 768px) 100vw, 640px"
								priority
								fill
								unoptimized
							/>
						</section>

						<section className="bg-white text-dark-gray rounded-lg h-11/12 gap-4 p-4 pt-16 -mt-16">
							<div className="flex flex-wrap gap-4 justify-center">
								{data.types.map((t) => (
									<span
										key={t}
										className="rounded-full px-3 py-1 text-xs font-bold text-white capitalize font-poppins tracking-wider"
										style={{ background: TYPE_COLORS[t.toLowerCase()] ?? "#999" }}
									>
										{t}
									</span>
								))}
							</div>

							<h2
								className="font-poppins font-bold text-sm text-center my-6"
								style={{ color: primary ?? "#444" }}
							>
								About
							</h2>

							<dl className="grid grid-cols-3 gap-4 text-sm items-end mx-5 mb-6">
								<div className="text-center">
									<dd className="mb-4 font-medium">{data.weight / 10} kg</dd>
									<dt className="text-gray-500">Weight</dt>
								</div>
								<div className="text-center">
									<dd className="mb-4 font-medium">{data.height / 10} m</dd>
									<dt className="text-gray-500">Height</dt>
								</div>
								<div className="text-center">
									<dd className="capitalize mb-2">{data.abilities.slice(0, 2).join(", ")}</dd>
									<dt className="text-gray-500">Abilities</dt>
								</div>
							</dl>

							<p className="font-poppins text-sm font-normal text-dark-gray px-2 mb-6">
								{data.description.replaceAll("", " ")}
							</p>

							<h2
								className="font-poppins font-bold text-sm text-center my-6"
								style={{ color: primary ?? "#444" }}
							>
								Base Stats
							</h2>

							<ul className="mr-4">
								{(data.stats ?? []).map((s, i) => (
									<li key={i} className="grid grid-cols-[50px_1rem_1fr] items-center gap-3">
										<span
											className="text-xs font-poppins font-bold uppercase text-right tracking-widest"
											style={{ color: primary ?? "#444" }}
										>
											{formatStatName(s.name)}
										</span>

										<span className="text-xs font-medium">{String(s.value).padStart(3, "0")}</span>

										<div className="h-2 rounded-full bg-gray-100 overflow-hidden">
											<div
												ref={(el) => {
													if (el) barsRef.current[i] = el;
												}}
												data-to={s.value}
												className="h-full rounded-full"
												style={{ background: primary }}
											/>
										</div>
									</li>
								))}
							</ul>
						</section>
					</div>
				) : null}
			</div>
		</div>,
		document.body
	);
}
