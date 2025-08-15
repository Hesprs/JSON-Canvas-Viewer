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
	]
;

export default defineConfig({
	root: resolve(__dirname, 'example'),
	resolve: {
		alias: {
			'json-canvas-viewer': resolve(__dirname, 'src/canvasViewer.ts'),
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
	publicDir: resolve(__dirname, 'dist'),
	plugins: [
		{
			name: 'typescript-diagnostics',
			configureServer(server) {
				server.watcher.on('all', (event, path) => {
					if (path.endsWith('.ts') && event === 'change') {
						require('typescript').transpileModule(require('fs').readFileSync(path, 'utf-8'), { compilerOptions: require('./tsconfig.json').compilerOptions });
					}
				});
			},
		},
	],
});
