import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	compressImage,
	computeTargetDimensions,
	findQualityForSize,
} from "../imageCompressor";

const blobOfSize = (size: number, mime: string): Blob =>
	new Blob([new Uint8Array(size)], { type: mime });

describe("computeTargetDimensions", () => {
	it("gambar kecil → tidak diskalakan", () => {
		expect(computeTargetDimensions(800, 600)).toEqual({
			width: 800,
			height: 600,
		});
	});

	it("landscape besar → dibatasi max dimension, rasio tetap", () => {
		expect(computeTargetDimensions(4000, 3000)).toEqual({
			width: 1280,
			height: 960,
		});
	});

	it("portrait besar → tinggi jadi pembatas", () => {
		expect(computeTargetDimensions(1000, 4000)).toEqual({
			width: 320,
			height: 1280,
		});
	});

	it("max dimension kustom", () => {
		expect(computeTargetDimensions(4000, 2000, 1024)).toEqual({
			width: 1024,
			height: 512,
		});
	});

	it("dimensi 0 → minimal 1", () => {
		expect(computeTargetDimensions(0, 0).width).toBeGreaterThanOrEqual(1);
	});
});

describe("findQualityForSize", () => {
	it("langsung kecil → kualitas awal tanpa iterasi", async () => {
		const encode = vi.fn(async (q: number) => Math.round(50_000 * q));
		const result = await findQualityForSize(encode, 200_000);
		expect(result.quality).toBe(0.8);
		expect(encode).toHaveBeenCalledTimes(1);
	});

	it("turun bertahap sampai ≤ target", async () => {
		const encode = vi.fn(async (q: number) => Math.round(1_000_000 * q));
		const result = await findQualityForSize(encode, 200_000, 0.2);
		expect(result.quality).toBe(0.2);
		expect(result.bytes).toBe(200_000);
	});

	it("tak pernah tercapai → kualitas minimum (best effort)", async () => {
		const encode = vi.fn(async () => 1_000_000_000);
		const result = await findQualityForSize(encode, 200_000, 0.3);
		expect(result.quality).toBe(0.3);
		expect(result.bytes).toBe(1_000_000_000);
	});
});

describe("compressImage", () => {
	const fakeBitmap = { width: 4000, height: 3000, close: vi.fn() };
	const fakeCtx = { drawImage: vi.fn() };

	beforeEach(() => {
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => fakeBitmap),
		);
		vi.stubGlobal("ImageBitmap", class {});
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
			fakeCtx as unknown as CanvasRenderingContext2D,
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("gambar 5MB → ≤200KB, dimensi dibatasi, EXIF rotate via createImageBitmap", async () => {
		const captured = { canvas: null as HTMLCanvasElement | null };
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
			function (
				this: HTMLCanvasElement,
				callback: BlobCallback,
				mime?: string,
				quality?: number,
			) {
				captured.canvas = this;
				const size =
					mime === "image/webp"
						? Math.round(500_000 * (quality ?? 0.8))
						: Math.round(100_000 * (quality ?? 0.5));
				callback(blobOfSize(size, mime ?? "image/webp"));
			},
		);
		const file = new File([new Uint8Array(5_000_000)], "bukti-transfer.jpg", {
			type: "image/jpeg",
		});

		const result = await compressImage(file);

		expect(createImageBitmap).toHaveBeenCalledWith(file, {
			imageOrientation: "from-image",
		});
		expect(fakeCtx.drawImage).toHaveBeenCalledWith(fakeBitmap, 0, 0, 1280, 960);
		expect(captured.canvas?.width).toBe(1280);
		expect(captured.canvas?.height).toBe(960);
		expect(result.size).toBeLessThanOrEqual(200 * 1024);
		expect(result.name).toBe("bukti-transfer.webp");
		expect(result.type).toBe("image/webp");
	});

	it("webp selalu besar → fallback jpeg quality 0.5", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
			(callback: BlobCallback, mime?: string, quality?: number) => {
				const size =
					mime === "image/webp"
						? 10_000_000
						: Math.round(100_000 * (quality ?? 0.5));
				callback(blobOfSize(size, mime ?? "image/jpeg"));
			},
		);
		const file = new File([new Uint8Array(5_000_000)], "foto.png", {
			type: "image/png",
		});

		const result = await compressImage(file);

		expect(result.type).toBe("image/jpeg");
		expect(result.name).toBe("foto.jpg");
		expect(result.size).toBeLessThanOrEqual(200 * 1024);
	});

	it("createImageBitmap tanpa orientasi (fallback) saat 'from-image' ditolak", async () => {
		vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
			(callback: BlobCallback) => {
				callback(blobOfSize(50_000, "image/webp"));
			},
		);
		vi.stubGlobal(
			"createImageBitmap",
			vi
				.fn()
				.mockRejectedValueOnce(new Error("imageOrientation unsupported"))
				.mockResolvedValueOnce(fakeBitmap),
		);
		const file = new File([new Uint8Array(500_000)], "a.jpg", {
			type: "image/jpeg",
		});

		const result = await compressImage(file);

		expect(createImageBitmap).toHaveBeenCalledTimes(2);
		expect(createImageBitmap).toHaveBeenLastCalledWith(file);
		expect(result.name).toBe("a.webp");
	});
});
