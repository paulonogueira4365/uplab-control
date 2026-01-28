import adapter from '@sveltejs/adapter-auto'; // Mudamos para auto (Vercel detecta melhor)
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter(),
        // Se a Vercel reclamar de rotas, o auto resolve. 
        // Para o Tauri, quando você for gerar o .exe, você volta para o static.
    }
};

export default config;