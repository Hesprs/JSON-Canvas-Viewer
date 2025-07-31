/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
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
			name: 'CanvasViewer',
		},
		rollupOptions: {
      external: isIntegratedBuild ? [] : ['marked'],
      output: {
        entryFileNames: (chunkInfo) => {
          if (isIntegratedBuild) {
            return `canvasViewer.inte.js`;
          }
          return `canvasViewer.js`;
        },
      },
    },
	},
	plugins: [cssInjectedByJsPlugin()],
	server: {
		open: '/',
	},
  publicDir: resolve(__dirname, 'dist'),
});