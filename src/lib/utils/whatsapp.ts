import { env } from "$lib/env";

export function buildCheckinUrl(id: string | number): string {
	return `${env.baseUrl}/panitia/checkin?id=${encodeURIComponent(String(id))}`;
}

export function waShare(text: string, url?: string): string {
	const parts = [text];
	if (url) {
		parts.push(url);
	}
	return `https://wa.me/?text=${encodeURIComponent(parts.join("\n"))}`;
}
