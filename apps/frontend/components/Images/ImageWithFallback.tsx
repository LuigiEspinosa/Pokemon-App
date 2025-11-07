"use client";

import { useState } from "react";
import Image, { ImageLoaderProps } from "next/image";

import SvgLogo from "./SvgLogo";

interface IFallbackImage {
	src: string;
	alt: string;
	width?: number;
	height?: number;
}

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

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
					loader={passthroughLoader}
					src={src}
					alt={alt}
					sizes="(max-width: 768px) 50vw, 25vw"
					className="object-contain"
					onError={handleError}
					loading="eager"
					fill
					unoptimized
				/>
			)}
		</>
	);
}
