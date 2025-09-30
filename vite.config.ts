// @ts-nocheck
import { defineConfig } from 'vite';
import { resolve } from 'path';
import terser from '@rollup/plugin-terser';

const standalone = process.env.standalone === 'true';
const external = standalone ? [] : ['marked'];
const output = standalone
	? [
			{
				format: 'es',
				entryFileNames: `canvasViewer.js`,
				plugins: [terser()],
			},
	  ]
	: [
			{
				format: 'es',
				entryFileNames: `canvasViewer.esm.js`,
				plugins: [terser()],
			},
			{
				format: 'cjs',
				entryFileNames: `canvasViewer.cjs.js`,
			},
	  ];

export default defineConfig({
	root: resolve(__dirname, 'example'),
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/'),
		},
	},
	build: {
		outDir: resolve(__dirname, 'dist'),
		emptyOutDir: !standalone,
		minify: 'esbuild',
		cssCodeSplit: false,
		lib: {
			entry: resolve(__dirname, 'src/canvasViewer.ts'),
			name: 'canvasViewer',
		},
		rollupOptions: {
			external: external,
			output: output,
		},
	},
	server: {
		open: '/',
	},
});
