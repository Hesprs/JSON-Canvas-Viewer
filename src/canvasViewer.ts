/*
canvasViewer.ts
A web-based viewer for JSON Canvas
Author: Hesprs (Hēsperus)
Todo:
- [ ] enable zooming by pinch when hovering seclected overlay
- [ ] add a way to lazy load the canvas
*/

import interactor from './interactor';
import { renderer, unexpectedError, destroyError } from './renderer';
import minimap from './minimap';
import controls from './controls';
import previewModal from './previewModal';
import overlayManager from './overlayManager';
import mistouchPreventer from './mistouchPreventer';
import styles from './styles.scss?inline';

export default class canvasViewer extends EventTarget {
	private controls: controls | null = null;
	private minimap: minimap | null = null;
	private mistouchPreventer: mistouchPreventer | null = null;
	private canvasBaseDir: null | string = null;
	private animationId: null | number = null;
	private _canvasData: JSONCanvas | null = null;
	private _nodeMap: Record<string, JSONCanvasNode> | null = null;
	private _nodeBounds: {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	} | null = null;
	private _container: HTMLDivElement | null;
	private renderer: renderer;
	private overlayManager: overlayManager;
	private interactor: interactor;
	private resizeObserver: ResizeObserver;
	private previewModal: previewModal;
	private extensions: Array<string>;
	private options: Array<string>;
	private offsetX: number;
	private offsetY: number;
	private scale: number;
	private spatialGrid: Record<string, Array<JSONCanvasNode>> | null = null;
	private ZOOM_SMOOTHNESS: number;
	private INITIAL_VIEWPORT_PADDING: number;
	private perFrame: {
		needAnimating: boolean;
		zoom: boolean;
		smoothZoom: boolean;
		targetScale: number;
		pan: boolean;
		resize: boolean;
		resizeScale: {
			width: number;
			height: number;
			lastCentreX: null | number;
			lastCentreY: null | number;
		};
	};
	private GRID_CELL_SIZE: number;

	private get canvasData() {
		if (this._canvasData === null) throw destroyError;
		return this._canvasData;
	}
	private get nodeMap() {
		if (this._nodeMap === null) throw destroyError;
		return this._nodeMap;
	}
	private get nodeBounds() {
		if (this._nodeBounds === null) throw destroyError;
		return this._nodeBounds;
	}
	private get container() {
		if (this._container === null) throw destroyError;
		return this._container;
	}

	constructor(container: HTMLElement, extensions: Array<string> = [], options: Array<string> = []) {
		super();
		const shadowContainer = container.attachShadow({ mode: 'open' });
		const style = document.createElement('style');
		style.innerHTML = styles;

		shadowContainer.appendChild(style);
		this._container = document.createElement('div');
		this._container.classList.add('container');

		this.renderer = new renderer(this._container);
		this.overlayManager = new overlayManager(this._container);
		this.interactor = new interactor(this._container, { preventDefault: true, proControlSchema: options.includes('proControlSchema') });
		this.resizeObserver = new ResizeObserver(this.onResize);

		// Extension: Minimap
		if (extensions.includes('minimap')) this.minimap = new minimap(this._container, options.includes('minimapCollapsed'));
		else if (options.includes('minimapCollapsed')) console.warn('CanvasViewer: "minimapCollapsed" option is not supported without minimap extension.');

		// Controls Panel
		if (!options.includes('controlsHidden')) this.controls = new controls(this._container, options.includes('controlsCollapsed'));
		else if (options.includes('controlsCollapsed')) console.warn('CanvasViewer: "controlsCollapsed" option is overridden by "controlsHidden" option.');

		// Preview Modal
		this.previewModal = new previewModal(this._container);

		// Extension: Mistouch Prevention
		if (extensions.includes('mistouchPrevention')) this.mistouchPreventer = new mistouchPreventer(this._container, !options.includes('noPreventionAtStart'));

		shadowContainer.appendChild(this._container);

		this.extensions = extensions;
		this.options = options;

		// === Variables ===
		this.offsetX = 0;
		this.offsetY = 0;
		this.scale = 1.0;

		// === Constants ===
		this.ZOOM_SMOOTHNESS = 0.25; // Adjust this value to control zoom smoothness (0-1)
		this.INITIAL_VIEWPORT_PADDING = 100;
		this.GRID_CELL_SIZE = 800;

		// === State Variables ===
		this.perFrame = {
			needAnimating: false,
			zoom: false,
			smoothZoom: false,
			targetScale: 1,
			pan: false,
			resize: false,
			resizeScale: {
				width: 0,
				height: 0,
				lastCentreX: null,
				lastCentreY: null,
			},
		};
	}

	// === Utility Functions ===
	private isUIControl(target: HTMLElement) {
		return target.closest && (target.closest('.controls') || target.closest('button') || target.closest('input'));
	}

	private findNodeAt({ x, y }: Coordinates) {
		let candidates: Array<JSONCanvasNode> = [];
		if (!this.spatialGrid) candidates = this.canvasData.nodes;
		else {
			const col = Math.floor(x / this.GRID_CELL_SIZE);
			const row = Math.floor(y / this.GRID_CELL_SIZE);
			const key = `${col},${row}`;
			candidates = this.spatialGrid[key] || [];
		}
		for (const node of candidates) {
			if (x < node.x || x > node.x + node.width || y < node.y || y > node.y + node.height || this.judgeInteract(node) === 'non-interactive') continue;
			return node;
		}
	}

	// Container to Canvas
	private C2C({ x: containerX, y: containerY }: Coordinates) {
		return {
			x: containerX - this.offsetX,
			y: containerY - this.offsetY,
		};
	}
	// Canvas to World
	private C2W({ x: canvasX, y: canvasY }: Coordinates) {
		return {
			x: canvasX / this.scale,
			y: canvasY / this.scale,
		};
	}

	private middleScreen() {
		return {
			x: this.container.clientWidth / 2,
			y: this.container.clientHeight / 2,
		};
	}

	private judgeInteract(node: JSONCanvasNode | undefined) {
		// how should the app handle node interactions
		const type = !node ? 'default' : node.type;
		switch (type) {
			case 'text':
				return 'select';
			case 'link':
				return 'select';
			case 'file':
				if (!node || !node.file) throw unexpectedError;
				return node.file.match(/\.md$/i) ? 'select' : 'preview';
			default:
				return 'non-interactive';
		}
	}

	private zoomToScale(newScale: number, origin: Coordinates) {
		const validNewScale = Math.max(Math.min(newScale, 20), 0.05);
		if (validNewScale === this.scale) return;
		const canvasCoords = this.C2C(origin);
		this.offsetX = origin.x - (canvasCoords.x * validNewScale) / this.scale;
		this.offsetY = origin.y - (canvasCoords.y * validNewScale) / this.scale;
		this.scale = validNewScale;
		if (this.controls) this.controls.updateSlider(this.scale);
	}

	private buildSpatialGrid() {
		if (!this.canvasData || this.canvasData.nodes.length < 50) return;
		this.spatialGrid = {};
		for (let node of this.canvasData.nodes) {
			const minCol = Math.floor(node.x / this.GRID_CELL_SIZE);
			const maxCol = Math.floor((node.x + node.width) / this.GRID_CELL_SIZE);
			const minRow = Math.floor(node.y / this.GRID_CELL_SIZE);
			const maxRow = Math.floor((node.y + node.height) / this.GRID_CELL_SIZE);
			for (let col = minCol; col <= maxCol; col++) {
				for (let row = minRow; row <= maxRow; row++) {
					const key = `${col},${row}`;
					if (!this.spatialGrid[key]) this.spatialGrid[key] = [];
					this.spatialGrid[key].push(node);
				}
			}
		}
	}

	private calculateNodeBounds() {
		if (!this.canvasData || !this.canvasData.nodes.length) return null;
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		this.canvasData.nodes.forEach(node => {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		});
		const width = maxX - minX;
		const height = maxY - minY;
		const centerX = minX + width / 2;
		const centerY = minY + height / 2;
		return { minX, minY, maxX, maxY, width, height, centerX, centerY };
	}

	// === Render Loop ===
	private draw = () => {
		if (!this.perFrame.needAnimating && !this.perFrame.pan && !this.perFrame.resize && !this.perFrame.zoom && !this.perFrame.smoothZoom) {
			this.animationId = requestAnimationFrame(this.draw);
			return;
		}
		if (this.perFrame.needAnimating) this.perFrame.needAnimating = false;
		if (this.perFrame.zoom) {
			this.perFrame.zoom = false;
			const zoomDump = this.interactor.getZoomDump();
			this.zoom(zoomDump.factor, zoomDump.origin);
			this.interactor.resetZoomDump();
		}
		if (this.perFrame.pan) {
			this.perFrame.pan = false;
			this.pan(this.interactor.getPanDump());
			this.interactor.resetPanDump();
		}
		if (this.perFrame.smoothZoom) this.smoothZoom();
		if (this.perFrame.resize) this.resize();
		this.renderer.redraw(this.offsetX, this.offsetY, this.scale);
		this.overlayManager.updateAllOverlays(this.offsetX, this.offsetY, this.scale);
		if (this.minimap) this.minimap.updateViewportRectangle(this.offsetX, this.offsetY, this.scale); // Extension: Minimap
		this.animationId = requestAnimationFrame(this.draw);
	};

	private resize() {
		this.perFrame.resize = false;
		const params = this.perFrame.resizeScale;
		if (params.lastCentreX && params.lastCentreY) {
			this.offsetX += params.width / 2 - params.lastCentreX;
			this.offsetY += params.height / 2 - params.lastCentreY;
		}
		params.lastCentreX = params.width / 2;
		params.lastCentreY = params.height / 2;
		this.renderer.resizeCanvasForDPR();
		this.previewModal.resize(params.width, params.height);
	}

	private pan({ x, y }: Coordinates) {
		this.offsetX += x;
		this.offsetY += y;
	}
	private zoom(factor: number, origin: Coordinates) {
		const newScale = this.scale * factor;
		this.zoomToScale(newScale, origin);
	}
	private smoothZoom() {
		const scaleDiff = this.perFrame.targetScale - this.scale;
		let newScale;
		if (Math.abs(scaleDiff) < this.perFrame.targetScale * 0.01 + 0.002) {
			newScale = this.perFrame.targetScale;
			this.perFrame.smoothZoom = false;
		} else newScale = Math.round((this.scale + scaleDiff * this.ZOOM_SMOOTHNESS) * 1000) / 1000;
		this.zoomToScale(newScale, this.middleScreen());
	}

	// === Sub-class Events ===
	private onClick = (e: Event) => {
		if (e instanceof CustomEvent) {
			if (this.isUIControl(e.detail.target)) return;
			const node = this.findNodeAt(this.C2W(this.C2C(e.detail.position)));
			const interaction = this.judgeInteract(node);
			switch (interaction) {
				case 'non-interactive':
					this.overlayManager.select(null);
					break;
				case 'select':
					if (!node) throw unexpectedError;
					this.overlayManager.select(node.id);
					break;
				case 'preview':
					if (!node) throw unexpectedError;
					this.previewModal.showPreviewModal(node);
					break;
			}
			if (node && interaction !== 'non-interactive') this.dispatchEvent(new CustomEvent<{ node: string; type: 'select' | 'preview' }>('interact', { detail: { node: node.id, type: interaction } }));
		} else throw unexpectedError;
	};
	private onResize = () => {
		this.perFrame.resize = true;
		this.perFrame.resizeScale.width = this.container.clientWidth;
		this.perFrame.resizeScale.height = this.container.clientHeight;
	};
	private onPan = () => (this.perFrame.pan = true);
	private onZoom = () => (this.perFrame.zoom = true);
	private onSlide = (e: Event) => {
		if (e instanceof CustomEvent) this.setScale(e.detail);
		else throw unexpectedError;
	};
	private onMinimapExpanded = () => {
		if (this.minimap) this.minimap.updateViewportRectangle(this.offsetX, this.offsetY, this.scale);
	};
	private onPreventionStart = () => {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	};
	private onPreventionEnd = () => (this.animationId = requestAnimationFrame(this.draw));
	private stopInteractor = () => this.interactor.stop();
	private startInteractor = () => this.interactor.start();
	private onToggleFullscreen = () => this.shiftFullscreen();

	// === Public ===
	zoomIn = () => this.setScale(this.scale * 1.2);
	zoomOut = () => this.setScale(this.scale / 1.2);
	setScale(scale: number) {
		this.perFrame.targetScale = scale;
		this.perFrame.smoothZoom = true;
	}
	panTo(x: number, y: number) {
		this.offsetX = this.container.clientWidth / 2 - x * this.scale;
		this.offsetY = this.container.clientHeight / 2 - y * this.scale;
		this.perFrame.needAnimating = true;
	}
	shiftFullscreen(option: string = 'toggle') {
		if (!document.fullscreenElement && (option === 'toggle' || option === 'enter')) this.container.requestFullscreen();
		else if (document.fullscreenElement && (option === 'toggle' || option === 'exit')) document.exitFullscreen();
		if (this.controls) this.controls.updateFullscreenBtn();
	}

	async loadCanvas(path: string) {
		try {
			if (/^https?:\/\//.test(path)) this.canvasBaseDir = path.substring(0, path.lastIndexOf('/') + 1);
			else {
				const lastSlash = path.lastIndexOf('/');
				this.canvasBaseDir = lastSlash !== -1 ? path.substring(0, lastSlash + 1) : './';
			}
			this._canvasData = await fetch(path).then(res => res.json());
			this._nodeMap = {};
			this.canvasData.nodes.forEach((node: JSONCanvasNode) => {
				if (node.type === 'file' && node.file && !node.file.includes('http')) {
					const file = node.file.split('/');
					node.file = file[file.length - 1];
				}
				this.nodeMap[node.id] = node;
			});
			this.buildSpatialGrid();
			this._nodeBounds = this.calculateNodeBounds();
			this.resetView();
			this.resizeObserver.observe(this.container);

			this.interactor.start();
			this.renderer.receiveData(this.nodeMap, this.canvasData);
			this.overlayManager.receiveData(this.canvasBaseDir, this.nodeMap);
			this.previewModal.receiveData(this.canvasBaseDir);

			this.interactor.addEventListener('trueClick', this.onClick);
			this.interactor.addEventListener('pan', this.onPan);
			this.interactor.addEventListener('zoom', this.onZoom);
			this.previewModal.addEventListener('previewModalShown', this.stopInteractor);
			this.previewModal.addEventListener('previewModalHidden', this.startInteractor);
			this.overlayManager.addEventListener('interactionStart', this.stopInteractor);
			this.overlayManager.addEventListener('interactionEnd', this.startInteractor);
			if (this.controls) this.controls.addEventListener('zoomIn', this.zoomIn);
			if (this.controls) this.controls.addEventListener('zoomOut', this.zoomOut);
			if (this.controls) this.controls.addEventListener('slide', this.onSlide);
			if (this.controls) this.controls.addEventListener('toggleFullscreen', this.onToggleFullscreen);
			if (this.controls) this.controls.addEventListener('resetView', this.resetView);

			if (this.minimap) {
				this.minimap.receiveData(this.nodeBounds, this.canvasData, this.nodeMap);
				this.minimap.addEventListener('minimapExpanded', this.onMinimapExpanded);
			}

			if (this.mistouchPreventer) {
				this.mistouchPreventer.addEventListener('preventionStart', this.onPreventionStart);
				this.mistouchPreventer.addEventListener('preventionEnd', this.onPreventionEnd);
			}

			if (!this.extensions.includes('mistouchPrevention') || this.options.includes('noPreventionAtStart')) this.animationId = requestAnimationFrame(this.draw);
			this.dispatchEvent(new CustomEvent<JSONCanvas>('loaded', { detail: this.canvasData }));
		} catch (err) {
			console.error('Failed to load canvas data:', err);
		}
	}

	resetView = () => {
		const bounds = this.nodeBounds;
		if (!bounds) {
			return {
				scale: 1.0,
				offsetX: this.container.clientWidth / 2,
				offsetY: this.container.clientHeight / 2,
			};
		}
		const contentWidth = bounds.width + this.INITIAL_VIEWPORT_PADDING * 2;
		const contentHeight = bounds.height + this.INITIAL_VIEWPORT_PADDING * 2;
		// Use logical dimensions for scaling calculations
		const viewWidth = this.container.clientWidth;
		const viewHeight = this.container.clientHeight;
		const scaleX = viewWidth / contentWidth;
		const scaleY = viewHeight / contentHeight;
		const newScale = Math.round(Math.min(scaleX, scaleY) * 1000) / 1000;
		const contentCenterX = bounds.centerX;
		const contentCenterY = bounds.centerY;
		const initialView = {
			scale: newScale,
			offsetX: viewWidth / 2 - contentCenterX * newScale,
			offsetY: viewHeight / 2 - contentCenterY * newScale,
		};
		this.scale = initialView.scale;
		this.offsetX = initialView.offsetX;
		this.offsetY = initialView.offsetY;
		if (this.controls) this.controls.updateSlider(this.scale);
		this.perFrame.needAnimating = true;
	};

	dispose() {
		this.interactor.removeEventListener('trueClick', this.onClick);
		this.interactor.removeEventListener('pan', this.onPan);
		this.interactor.removeEventListener('zoom', this.onZoom);
		this.previewModal.removeEventListener('previewModalShown', this.stopInteractor);
		this.previewModal.removeEventListener('previewModalHidden', this.startInteractor);
		this.overlayManager.removeEventListener('interactionStart', this.stopInteractor);
		this.overlayManager.removeEventListener('interactionEnd', this.startInteractor);
		if (this.controls) this.controls.removeEventListener('zoomIn', this.zoomIn);
		if (this.controls) this.controls.removeEventListener('zoomOut', this.zoomOut);
		if (this.controls) this.controls.removeEventListener('slide', this.onSlide);
		if (this.controls) this.controls.removeEventListener('toggleFullscreen', this.onToggleFullscreen);
		if (this.controls) this.controls.removeEventListener('resetView', this.resetView);
		if (this.minimap) this.minimap.removeEventListener('minimapExpanded', this.onMinimapExpanded);
		if (this.mistouchPreventer) {
			this.mistouchPreventer.removeEventListener('preventionStart', this.onPreventionStart);
			this.mistouchPreventer.removeEventListener('preventionEnd', this.onPreventionEnd);
		}
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.resizeObserver.disconnect();
		this.interactor.dispose();
		this.previewModal.dispose();
		if (this.controls) this.controls.dispose();
		if (this.minimap) this.minimap.dispose();
		if (this.mistouchPreventer) this.mistouchPreventer.dispose();
		this.overlayManager.dispose();
		this.renderer.dispose();
		this.container.remove();
		this._container = null;
	}
}

class CanvasViewer extends HTMLElement {
	viewer: canvasViewer;
	constructor() {
		super();
		this.style.display = 'block';
		this.style.overflow = 'hidden';
		this.style.maxWidth = '120vw';
		this.style.maxHeight = '120vh';
		const extensionString = this.getAttribute('extensions');
		const optionString = this.getAttribute('options');
		const extensions = extensionString ? extensionString.split(' ') : [];
		const options = optionString ? optionString.split(' ') : [];
		this.viewer = new canvasViewer(this, extensions, options);
	}
	connectedCallback() {
		const sourcePath = this.getAttribute('src');
		if (!sourcePath) throw new Error('No source canvas path provided.');
		if (this.viewer) this.viewer.loadCanvas(sourcePath);
	}
	disconnectedCallback() {
		if (this.viewer) this.viewer.dispose();
		this.remove();
	}
}

customElements.define('canvas-viewer', CanvasViewer);
