import { defineConfig } from 'vite';
import { resolve } from 'path';
const isIntegratedBuild = process.env.VITE_BUILD_INTEGRATED === 'true';

export default defineConfig({
	root: resolve(__dirname, 'example'),
	resolve: {
		alias: {
			'obsidian-canvas-viewer': resolve(__dirname, 'src/canvasViewer.js'),
		},
	},
	build: {
		outDir: resolve(__dirname, 'dist'),
		emptyOutDir: !isIntegratedBuild,
		minify: 'esbuild',
		cssCodeSplit: false,
		lib: {
			entry: resolve(__dirname, 'src/canvasViewer.js'),
			name: 'canvasViewer',
		},
		rollupOptions: {
			external: isIntegratedBuild ? [] : ['marked'],
			output: {
				entryFileNames: () => {
					if (isIntegratedBuild) return `canvasViewer.inte.js`;
					else return `canvasViewer.js`;
				},
			},
		},
	},
	server: {
		open: '/',
	},
	publicDir: resolve(__dirname, 'dist'),
});
