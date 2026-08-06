import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";

function baseUrlGuard(baseUrl: string | undefined): Plugin {
	return {
		name: "base-url-guard",
		buildStart() {
			if (baseUrl === undefined || baseUrl.length === 0) {
				console.warn(
					"[env] PUBLIC_BASE_URL kosong — QR e-tiket dan link wa.me akan salah. Isi di .env sebelum build rilis.",
				);
			}
		},
	};
}

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, ".", "");
	return {
		plugins: [
			tailwindcss(),
			baseUrlGuard(env.PUBLIC_BASE_URL),
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
