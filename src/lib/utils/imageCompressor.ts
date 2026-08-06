export const MAX_BYTES_DEFAULT = 200 * 1024;
export const MAX_DIMENSION_DEFAULT = 1280;

export interface CompressOptions {
	maxBytes?: number;
	maxDimension?: number;
	outputMime?: "image/webp" | "image/jpeg";
}

export interface TargetDimensions {
	width: number;
	height: number;
}

export function computeTargetDimensions(
	width: number,
	height: number,
	maxDimension: number = MAX_DIMENSION_DEFAULT,
): TargetDimensions {
	if (width <= maxDimension && height <= maxDimension) {
		return { width: Math.max(1, width), height: Math.max(1, height) };
	}
	const scale = Math.min(1, maxDimension / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

export interface QualityResult {
	quality: number;
	bytes: number;
}

export async function findQualityForSize(
	encode: (quality: number) => Promise<number>,
	maxBytes: number,
	minQuality = 0.3,
	startQuality = 0.8,
): Promise<QualityResult> {
	let pct = Math.round(startQuality * 10);
	const minPct = Math.round(minQuality * 10);
	let best: QualityResult = {
		quality: pct / 10,
		bytes: await encode(pct / 10),
	};
	if (best.bytes <= maxBytes) {
		return best;
	}
	while (pct > minPct) {
		pct -= 1;
		const bytes = await encode(pct / 10);
		best = { quality: pct / 10, bytes };
		if (bytes <= maxBytes) {
			return best;
		}
	}
	return best;
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		return await createImageBitmap(file);
	}
}

const encodeBlob = (
	canvas: HTMLCanvasElement,
	mime: string,
	quality: number,
): Promise<Blob | null> =>
	new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), mime, quality);
	});

const stripExtension = (name: string): string => name.replace(/\.[^.]+$/, "");

export async function compressImage(
	file: File,
	options: CompressOptions = {},
): Promise<File> {
	const maxBytes = options.maxBytes ?? MAX_BYTES_DEFAULT;
	const maxDimension = options.maxDimension ?? MAX_DIMENSION_DEFAULT;
	const outputMime = options.outputMime ?? "image/webp";

	const bitmap = await loadBitmap(file);
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		bitmap.close();
		throw new Error("Canvas 2D tidak tersedia di browser ini");
	}
	const target = computeTargetDimensions(
		bitmap.width,
		bitmap.height,
		maxDimension,
	);
	canvas.width = target.width;
	canvas.height = target.height;
	ctx.drawImage(bitmap, 0, 0, target.width, target.height);
	bitmap.close();

	const { quality } = await findQualityForSize(
		(q) => encodeBlob(canvas, outputMime, q).then((blob) => blob?.size ?? 0),
		maxBytes,
	);

	let blob = await encodeBlob(canvas, outputMime, quality);
	if (blob && blob.size <= maxBytes) {
		const ext = outputMime === "image/webp" ? "webp" : "jpg";
		return new File([blob], `${stripExtension(file.name)}.${ext}`, {
			type: outputMime,
		});
	}

	blob = await encodeBlob(canvas, "image/jpeg", 0.5);
	if (!blob) {
		throw new Error("Encoding gambar gagal");
	}
	return new File([blob], `${stripExtension(file.name)}.jpg`, {
		type: "image/jpeg",
	});
}
