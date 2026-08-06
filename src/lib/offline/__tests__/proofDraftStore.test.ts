import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
	clearProofDraft,
	loadProofDraft,
	saveProofDraft,
} from "$lib/offline/proofDraftStore";

describe("proofDraftStore", () => {
	beforeEach(async () => {
		await clearProofDraft("p-test");
	});

	it("menyimpan dan memuat draf bukti per peserta", async () => {
		const draft = {
			participantId: "p-test",
			blob: new Blob(["fake"], { type: "image/jpeg" }),
			name: "bukti.jpg",
			savedAt: 1234,
		};
		await saveProofDraft(draft);

		const loaded = await loadProofDraft("p-test");
		expect(loaded).not.toBeNull();
		expect(loaded?.participantId).toBe("p-test");
		expect(loaded?.name).toBe("bukti.jpg");
		expect(loaded?.savedAt).toBe(1234);
		expect(loaded?.blob).toBeDefined();
	});

	it("mengembalikan null bila belum ada draf", async () => {
		expect(await loadProofDraft("p-test")).toBeNull();
	});

	it("menghapus draf", async () => {
		await saveProofDraft({
			participantId: "p-test",
			blob: new Blob(["x"], { type: "image/jpeg" }),
			name: "a.jpg",
			savedAt: 1,
		});
		await clearProofDraft("p-test");
		expect(await loadProofDraft("p-test")).toBeNull();
	});

	it("draf antar peserta tidak saling menimpa", async () => {
		await saveProofDraft({
			participantId: "p-test",
			blob: new Blob(["1"], { type: "image/jpeg" }),
			name: "satu.jpg",
			savedAt: 1,
		});
		await saveProofDraft({
			participantId: "p-lain",
			blob: new Blob(["2"], { type: "image/jpeg" }),
			name: "dua.jpg",
			savedAt: 2,
		});
		expect((await loadProofDraft("p-test"))?.name).toBe("satu.jpg");
		expect((await loadProofDraft("p-lain"))?.name).toBe("dua.jpg");
	});
});
