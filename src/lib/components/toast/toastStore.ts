import { writable } from "svelte/store";

export interface ToastAction {
	id: number;
	message: string;
	onUndo: () => void;
	onConfirm: () => void;
	dismissAt: number;
}

export const DEFAULT_TOAST_MS = 5000;

let nextId = 1;

export const toasts = writable<ToastAction[]>([]);

export function undoable(
	message: string,
	opts: { onConfirm: () => void; onUndo?: () => void; timeoutMs?: number },
): number {
	const id = nextId++;
	const toast: ToastAction = {
		id,
		message,
		onUndo: opts.onUndo ?? (() => {}),
		onConfirm: opts.onConfirm,
		dismissAt: Date.now() + (opts.timeoutMs ?? DEFAULT_TOAST_MS),
	};
	toasts.update((list) => [...list, toast]);
	return id;
}

export function confirmToast(id: number): void {
	let confirmed: ToastAction | undefined;
	toasts.update((list) => {
		const index = list.findIndex((t) => t.id === id);
		if (index === -1) {
			return list;
		}
		confirmed = list[index];
		return list.filter((t) => t.id !== id);
	});
	confirmed?.onConfirm();
}

export function undoToast(id: number): void {
	let undone: ToastAction | undefined;
	toasts.update((list) => {
		const index = list.findIndex((t) => t.id === id);
		if (index === -1) {
			return list;
		}
		undone = list[index];
		return list.filter((t) => t.id !== id);
	});
	undone?.onUndo();
}

export function dismissToast(id: number): void {
	toasts.update((list) => list.filter((t) => t.id !== id));
}

export function clearToasts(): void {
	toasts.set([]);
}
