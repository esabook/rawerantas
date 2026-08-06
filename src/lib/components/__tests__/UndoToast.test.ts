import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ToastSystem from "$lib/components/toast/ToastSystem.svelte";
import {
	clearToasts,
	confirmToast,
	dismissToast,
	undoable,
	undoToast,
} from "$lib/components/toast/toastStore";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	clearToasts();
});

describe("toastStore", () => {
	it("undo → onUndo sekali; confirm setelah undo tidak jalan (idempotent)", () => {
		const onUndo = vi.fn();
		const onConfirm = vi.fn();
		const id = undoable("Skor disimpan", { onUndo, onConfirm });
		undoToast(id);
		undoToast(id);
		confirmToast(id);
		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("confirm → onConfirm sekali; undo setelah confirm tidak jalan", () => {
		const onUndo = vi.fn();
		const onConfirm = vi.fn();
		const id = undoable("Skor disimpan", { onUndo, onConfirm });
		confirmToast(id);
		confirmToast(id);
		undoToast(id);
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onUndo).not.toHaveBeenCalled();
	});

	it("dismiss → tidak memanggil apa pun", () => {
		const onUndo = vi.fn();
		const onConfirm = vi.fn();
		const id = undoable("Skor disimpan", { onUndo, onConfirm });
		dismissToast(id);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onUndo).not.toHaveBeenCalled();
	});
});

describe("UndoToast", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		render(ToastSystem);
	});

	it("toast tampil; auto-dismiss 5s → onConfirm dijalankan", async () => {
		const onConfirm = vi.fn();
		undoable("Skor disimpan", { onConfirm, timeoutMs: 5000 });
		await screen.findByText("Skor disimpan");
		await vi.advanceTimersByTimeAsync(6000);
		expect(onConfirm).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByText("Skor disimpan")).toBeNull());
	});

	it("tombol Undo → onUndo, toast hilang, onConfirm tidak jalan", async () => {
		const onUndo = vi.fn();
		const onConfirm = vi.fn();
		undoable("Skor disimpan", { onUndo, onConfirm, timeoutMs: 5000 });
		const undoBtn = await screen.findByRole("button", { name: /undo/i });
		await fireEvent.click(undoBtn);
		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(screen.queryByText("Skor disimpan")).toBeNull();
	});

	it("tombol Tutup → toast hilang tanpa konfirmasi", async () => {
		const onConfirm = vi.fn();
		undoable("Skor disimpan", { onConfirm, timeoutMs: 5000 });
		const closeBtn = await screen.findByRole("button", { name: "Tutup" });
		await fireEvent.click(closeBtn);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(screen.queryByText("Skor disimpan")).toBeNull();
	});
});
