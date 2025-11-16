// @ts-nocheck
import { defineConfig } from 'vite';
import { resolve } from 'path';
import terser from '@rollup/plugin-terser';
import { readdirSync, existsSync } from 'fs';

// Auto-detect entry points from src directory
const srcDir = resolve(__dirname, 'src', 'extensions');
const extensions = readdirSync(srcDir, { withFileTypes: true })
	.filter(entry => entry.isDirectory())
	.map(dir => {
		const indexPath = resolve(srcDir, dir.name, 'index.ts');
		if (existsSync(indexPath)) return { [dir.name]: indexPath };
		else return { [dir.name]: resolve(srcDir, dir.name) };
	})
	.reduce((entries, entry) => {
		Object.assign(entries, entry);
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
				index: resolve(__dirname, 'src', 'main.ts'),
				...extensions,
			},
			name: 'canvasViewer',
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: ['marked'],
			output: {
				entryFileNames: '[format]/[name].js',
				plugins: [terser()],
			},
		},
	},
});
