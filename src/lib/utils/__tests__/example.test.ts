import { describe, expect, it } from "vitest";
import { cn } from "@/utils";

describe("cn", () => {
	it("menggabungkan class dasar", () => {
		expect(cn("a", "b")).toBe("a b");
	});

	it("membuang value falsy", () => {
		expect(cn("a", undefined, null, false, "")).toBe("a");
	});

	it("menang untuk konflik util tailwind di class terakhir", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
	});
});
