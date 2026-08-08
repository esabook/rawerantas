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

const SYNC_INTERVAL_MS = 15_000;

let syncing = false;

/** Drain antrean offline; in-flight guard cegah overlap saat online/offline flap cepat. */
async function drainQueue(): Promise<void> {
	if (syncing || !navigator.onLine) {
		return;
	}
	syncing = true;
	try {
		const [{ runSyncOnce }, { executeQueueEntry }] = await Promise.all([
			import("./sync"),
			import("./executor"),
		]);
		await runSyncOnce(executeQueueEntry);
	} catch {
		// Kegagalan drain (mis. offline di tengah jalan) — batch berikutnya coba lagi.
	} finally {
		syncing = false;
		void refreshQueueCount();
	}
}

let initialized = false;

export function initNetworkStore(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	const sync = (): void => {
		const wasOnline = navigator.onLine;
		setOnline(wasOnline);
		if (wasOnline) {
			void drainQueue();
		}
	};
	sync();
	window.addEventListener("online", sync);
	window.addEventListener("offline", sync);
	void refreshQueueCount();
	window.setInterval(() => void refreshQueueCount(), 5_000);
	window.setInterval(() => void drainQueue(), SYNC_INTERVAL_MS);
}
