import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

const DEV_DEFAULT_BASE_URL = "http://localhost:5173";

function baseUrlGuard(baseUrl: string | undefined, mode: string): Plugin {
	return {
		name: "base-url-guard",
		buildStart() {
			const isEmpty = baseUrl === undefined || baseUrl.length === 0;
			const isDevDefault = baseUrl === DEV_DEFAULT_BASE_URL;
			if (!isEmpty && !isDevDefault) return;
			const message = isEmpty
				? "[env] PUBLIC_BASE_URL kosong — QR e-tiket dan link wa.me akan salah. Isi di .env sebelum build rilis."
				: `[env] PUBLIC_BASE_URL masih nilai dev default (${DEV_DEFAULT_BASE_URL}) — QR e-tiket dan link wa.me akan mati di production. Isi domain rilis sebelum build.`;
			if (mode === "production") {
				throw new Error(message);
			}
			console.warn(message);
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, ".", "");
	return {
		plugins: [
			tailwindcss(),
			baseUrlGuard(env.PUBLIC_BASE_URL, mode),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
				},
				adapter: adapter({ fallback: "index.html" }),
				alias: {
					"@": "./src/lib",
				},
			}),
		],
		resolve: {
			conditions: ["browser"],
		},
		test: {
			environment: "happy-dom",
			include: ["src/**/*.{test,spec}.{js,ts,svelte}"],
		},
	};
});
