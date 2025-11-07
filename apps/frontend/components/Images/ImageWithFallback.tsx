"use client";

import { useState } from "react";
import Image from "next/image";

import SvgLogo from "./SvgLogo";

interface IFallbackImage {
	src: string;
	alt: string;
	width?: number;
	height?: number;
}

export default function ImageWithFallback({ src, alt, width, height }: IFallbackImage) {
	const [hasError, setHasError] = useState(false);

	const handleError = () => {
		setHasError(true);
	};

	return (
		<>
			{hasError ? (
				<SvgLogo fill="var(--color-medium)" width={width} height={height} />
			) : (
				<Image
					src={src}
					alt={alt}
					sizes="(max-width: 768px) 50vw, 25vw"
					className="object-contain"
					onError={handleError}
					loading="eager"
					fill
				/>
			)}
		</>
	);
}
