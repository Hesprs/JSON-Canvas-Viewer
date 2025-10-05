// @ts-nocheck
import { defineConfig } from 'vite';
import { resolve } from 'path';
import terser from '@rollup/plugin-terser';
import { readdirSync } from 'fs';

// Auto-detect entry points from src directory
const srcDir = resolve(__dirname, 'src', 'extensions');
const extensions = readdirSync(srcDir)
	.filter(file => file.endsWith('.ts') || file.endsWith('.js'))
	.reduce((entries, file) => {
		const name = file.replace(/\.(ts|js)$/, '');
		entries[name] = resolve(srcDir, file);
		return entries;
	}, {} as Record<string, string>);

export default defineConfig({
	root: 'example',
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/'),
			'$': resolve(__dirname, 'dist/es/'),
		},
	},
	build: {
		outDir: resolve(__dirname, 'dist'),
		emptyOutDir: true,
		minify: 'esbuild',
		lib: {
			entry: {
				index: resolve(__dirname, 'src', 'canvasViewer.ts'),
				...extensions,
			},
			name: 'canvasViewer',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: ['marked'],
			output: {
				entryFileNames: ({ name }) => {
					if (name === 'index') {
						return '[format]/index.js';
					}
					return '[format]/[name].js';
				},
				plugins: [terser()],
			},
		},
	},
});
