import { writable } from "svelte/store";
import { countByStatus } from "./queue";

export const online = writable<boolean>(
	typeof navigator === "undefined" ? true : navigator.onLine,
);

export const queueCount = writable(0);

const setOnline = (value: boolean): void => online.set(value);

export function reportFetchSuccess(): void {
	setOnline(true);
}

export function reportFetchFailure(): void {
	setOnline(false);
}

export async function refreshQueueCount(): Promise<void> {
	const pending = await countByStatus("pending");
	const dead = await countByStatus("dead");
	queueCount.set(pending + dead);
}

let initialized = false;

export function initNetworkStore(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	const sync = (): void => setOnline(navigator.onLine);
	sync();
	window.addEventListener("online", sync);
	window.addEventListener("offline", sync);
	void refreshQueueCount();
	window.setInterval(() => void refreshQueueCount(), 5_000);
}
