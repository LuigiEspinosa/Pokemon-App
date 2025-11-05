"use client";

import { MouseEvent, SetStateAction, useState, useEffect, useRef } from "react";

const SelectDropdown = () => {
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	const [sortBy, setSortBy] = useState<string>("number");
	const [isOpen, setIsOpen] = useState<boolean>(false);

	const handleChange = (event: { target: { value: SetStateAction<string> } }) => {
		setSortBy(event.target.value);
	};

	const toggleDropdown = (e: MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		setIsOpen(!isOpen);
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
				onClick={(e) => toggleDropdown(e)}
				className="absolute top-0 right-0 w-8 h-8 rounded-2xl"
			>
				#
			</button>

			{isOpen && (
				<div className="absolute mt-10 bg-primary rounded-xl w-28 p-2 -right-2 top-0">
					<h3 className="text-xs font-bold font-poppins text-white py-4 text-center">Sort by:</h3>
					<div className="bg-background rounded-xl w-full py-4 px-6">
						<div className="flex items-center mb-2">
							<input
								type="radio"
								id="number"
								name="sort"
								value="number"
								checked={sortBy === "number"}
								onChange={handleChange}
								className="w-2 h-2"
							/>
							<label htmlFor="number" className="ml-1 font-poppins text-[10px] text-dark">
								Number
							</label>
						</div>

						<div className="flex items-center">
							<input
								type="radio"
								id="name"
								name="sort"
								value="name"
								checked={sortBy === "name"}
								onChange={handleChange}
								className="w-2 h-2"
							/>
							<label htmlFor="name" className="ml-1 font-poppins text-[10px] text-dark">
								Name
							</label>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SelectDropdown;
