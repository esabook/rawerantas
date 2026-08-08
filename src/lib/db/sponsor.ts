import type { InferSelectModel } from "drizzle-orm";
import { get } from "svelte/store";
import { demoSponsors } from "$lib/demo/generator";
import { demoMode } from "$lib/demo/store";
import { compressImage } from "$lib/utils/imageCompressor";
import { localClear, localGetAll, localPut, localStores } from "./localStore";
import { getSupabase } from "./queries";
import type { sponsors } from "./schema";
import { PROOF_IMAGES_BUCKET } from "./storage";

export const SPONSOR_IMAGE_MAX_BYTES = 500 * 1024;

export type Sponsor = InferSelectModel<typeof sponsors>;

const SPONSOR_STORE = localStores.sponsors;
const OVERRIDE_ID = "__sponsors_override__";

type SponsorOverride = { id: typeof OVERRIDE_ID; createdAt: Date };

const sortSponsors = (items: Sponsor[]) =>
	[...items].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);

export async function getSponsors(): Promise<Sponsor[]> {
	if (get(demoMode)) {
		const local = await localGetAll<Sponsor | SponsorOverride>(SPONSOR_STORE);
		if (local.some((item) => item.id === OVERRIDE_ID)) {
			return sortSponsors(
				local.filter((item): item is Sponsor => item.id !== OVERRIDE_ID),
			);
		}
		return sortSponsors(demoSponsors());
	}
	const { supabase } = await getSupabase();
	const { data, error } = await supabase
		.from("sponsors")
		.select("*")
		.order("created_at", { ascending: true });
	if (error) {
		throw new Error(`getSponsors: ${error.message}`);
	}
	return (data ?? []).map((row) => {
		const value = row as Sponsor & { image_url?: string; created_at?: string };
		return {
			...value,
			imageUrl: value.imageUrl ?? value.image_url ?? "",
			createdAt: value.createdAt ?? value.created_at ?? new Date(),
		};
	}) as Sponsor[];
}
async function saveLocalSponsors(items: Sponsor[]): Promise<void> {
	await localClear(SPONSOR_STORE);
	await localPut(SPONSOR_STORE, { id: OVERRIDE_ID, createdAt: new Date() });
	for (const item of items) {
		await localPut(SPONSOR_STORE, item);
	}
}

export async function saveSponsor(sponsor: Sponsor): Promise<void> {
	if (get(demoMode)) {
		const current = await getSponsors();
		const next = current.some((item) => item.id === sponsor.id)
			? current.map((item) => (item.id === sponsor.id ? sponsor : item))
			: [...current, sponsor];
		await saveLocalSponsors(next);
		return;
	}
	const { supabase } = await getSupabase();
	const { error } = await supabase.from("sponsors").upsert({
		id: sponsor.id,
		image_url: sponsor.imageUrl,
		url: sponsor.url,
	});
	if (error) {
		throw new Error(`saveSponsor: ${error.message}`);
	}
}

export async function deleteSponsor(id: string): Promise<void> {
	if (get(demoMode)) {
		const current = await getSponsors();
		await saveLocalSponsors(current.filter((item) => item.id !== id));
		return;
	}
	const { supabase } = await getSupabase();
	const { error } = await supabase.from("sponsors").delete().eq("id", id);
	if (error) {
		throw new Error(`deleteSponsor: ${error.message}`);
	}
}

export async function uploadSponsorImage(file: File): Promise<string> {
	const compressed = await compressImage(file, {
		maxBytes: SPONSOR_IMAGE_MAX_BYTES,
		maxDimension: 1280,
		outputMime: "image/webp",
	});
	if (compressed.size > SPONSOR_IMAGE_MAX_BYTES) {
		throw new Error(
			`Gambar melebihi batas ${Math.round(SPONSOR_IMAGE_MAX_BYTES / 1024)} KB setelah kompresi.`,
		);
	}
	if (get(demoMode)) {
		return URL.createObjectURL(compressed);
	}
	const { supabase } = await getSupabase();
	const mime = compressed.type === "image/jpeg" ? "image/jpeg" : "image/webp";
	const ext = mime === "image/jpeg" ? "jpg" : "webp";
	const path = `sponsors/${crypto.randomUUID()}.${ext}`;
	const { error } = await supabase.storage
		.from(PROOF_IMAGES_BUCKET)
		.upload(path, compressed, { contentType: mime });
	if (error) {
		throw new Error(`uploadSponsorImage: ${error.message}`);
	}
	const { data } = supabase.storage
		.from(PROOF_IMAGES_BUCKET)
		.getPublicUrl(path);
	return data.publicUrl;
}
