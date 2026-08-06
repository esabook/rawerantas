import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import Greeting from "../Greeting.svelte";

afterEach(cleanup);

describe("Greeting", () => {
	it("render nama dari prop", () => {
		render(Greeting, { name: "Budi" });
		expect(screen.getByText("Halo, Budi!")).toBeTruthy();
	});

	it("render fallback saat tanpa prop", () => {
		render(Greeting);
		expect(screen.getByText("Halo, dunia!")).toBeTruthy();
	});
});
