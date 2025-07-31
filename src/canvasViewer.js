/*
CanvasViewer.js
A web-based viewer for Obsidian Canvas
Author: Hesprs (Hēsperus)
Version: 2.0.0
Todo:
- [ ] enable zooming by pinch when hovering seclected overlay
- [ ] add a way to lazy load the canvas
*/

import { marked } from 'marked';
import styles from './styles.css?inline';

export class CanvasViewer {
	/**
	 * @param {HTMLElement} container
	 * @param {Array} [extensions = []]
	 * @param {Array} [options = []]
	 */
	constructor(container, extensions = [], options = []) {
		// === Style ===
		const style = document.createElement('style');
		style.textContent = styles;
		container.appendChild(style);

		// === Real Container ===
		this.realContainer = document.createElement('div');
		this.realContainer.classList.add('container');

		// === Main Canvas ===
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'main-canvas';
		this.realContainer.appendChild(this.canvas);

		// === Overlays Layer ===
		this.overlaysLayer = document.createElement('div');
		this.overlaysLayer.className = 'overlays';
		this.realContainer.appendChild(this.overlaysLayer);

		// Extension: Minimap
		if (extensions.includes('minimap')) {
			this.minimapContainer = document.createElement('div');
			this.minimapContainer.className = 'minimap-container';

			this.toggleMinimapBtn = document.createElement('button');
			this.toggleMinimapBtn.className = 'toggle-minimap collapse-button';
			this.toggleMinimapBtn.innerHTML = '<svg viewBox="-3.6 -3.6 31.2 31.2" stroke-width=".4"><path d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z" /></svg>';
			this.minimapContainer.appendChild(this.toggleMinimapBtn);

			this.minimap = document.createElement('div');
			this.minimap.className = 'minimap';
			this.minimapCanvas = document.createElement('canvas');
			this.minimapCanvas.className = 'minimap-canvas';
			this.minimapCanvas.width = 200;
			this.minimapCanvas.height = 150;
			this.minimap.appendChild(this.minimapCanvas);
			this.viewportRectangle = document.createElement('div');
			this.viewportRectangle.className = 'viewport-rectangle';
			this.minimap.appendChild(this.viewportRectangle);
			this.minimapContainer.appendChild(this.minimap);
			this.realContainer.appendChild(this.minimapContainer);

			this.isMinimapVisible = !options.includes('minimapCollapsed') ? true : false;
			this.minimapContainer.classList.toggle('collapsed', !this.isMinimapVisible);
			this.minimapCache = {
				scale: 1,
				centerX: 0,
				centerY: 0,
			};
			this.minimapCtx = this.minimapCanvas.getContext('2d');
			this.toggleMinimapBtn.addEventListener('click', () => {
				this.isMinimapVisible = !this.isMinimapVisible;
				this.minimapContainer.classList.toggle('collapsed');
				if (this.isMinimapVisible) this.updateViewportRectangle();
			});
		} else if (options.includes('minimapCollapsed')) console.warn('CanvasViewer: "minimapCollapsed" option is not supported without minimap extension.');

		// === Controls Panel ===
		// Option: Controls Hidden
		if (!options.includes('controlsHidden')) {
			this.controlsPanel = document.createElement('div');
			this.controlsPanel.className = 'controls';

			this.toggleCollapseBtn = document.createElement('button');
			this.toggleCollapseBtn.className = 'collapse-button';
			this.toggleCollapseBtn.innerHTML = '<svg viewBox="-3.6 -3.6 31.2 31.2" stroke-width=".4"><path d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z" /></svg>';
			this.controlsPanel.appendChild(this.toggleCollapseBtn);

			this.controlsContent = document.createElement('div');
			this.controlsContent.className = 'controls-content';

			this.toggleFullscreenBtn = document.createElement('button');
			this.toggleFullscreenBtn.innerHTML = `
				<svg viewBox="-5.28 -5.28 34.56 34.56" fill="none"><path d="M4 9V5.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C4.76 4 5.04 4 5.6 4H9M4 15v3.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C4.76 20 5.04 20 5.6 20H9m6-16h3.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C20 4.76 20 5.04 20 5.6V9m0 6v3.4c0 .56 0 .84-.109 1.054a1 1 0 0 1-.437.437C19.24 20 18.96 20 18.4 20H15" stroke-width="2.4" stroke-linecap="round"/></svg>
			`;
			this.controlsContent.appendChild(this.toggleFullscreenBtn);

			this.zoomOutBtn = document.createElement('button');
			this.zoomOutBtn.innerHTML = '<svg viewBox="-1.2 -1.2 26.4 26.4"><path d="M6 12h12" stroke-width="2" stroke-linecap="round" /></svg>';
			this.controlsContent.appendChild(this.zoomOutBtn);

			this.zoomSlider = document.createElement('input');
			this.zoomSlider.type = 'range';
			this.zoomSlider.className = 'zoom-slider';
			this.zoomSlider.min = '-30';
			this.zoomSlider.max = '30';
			this.zoomSlider.value = '0';
			this.controlsContent.appendChild(this.zoomSlider);

			this.zoomInBtn = document.createElement('button');
			this.zoomInBtn.innerHTML = '<svg viewBox="-1.2 -1.2 26.4 26.4"><path d="M6 12h12m-6-6v12" stroke-width="2" stroke-linecap="round" /></svg>';
			this.controlsContent.appendChild(this.zoomInBtn);

			this.resetViewBtn = document.createElement('button');
			this.resetViewBtn.innerHTML = '<svg viewBox="-6 -6 30 30" stroke-width=".08"><path d="m14.955 7.986.116.01a1 1 0 0 1 .85 1.13 8 8 0 0 1-13.374 4.728l-.84.84c-.63.63-1.707.184-1.707-.707V10h3.987c.89 0 1.337 1.077.707 1.707l-.731.731a6 6 0 0 0 8.347-.264 6 6 0 0 0 1.63-3.33 1 1 0 0 1 1.131-.848zM11.514.813a8 8 0 0 1 1.942 1.336l.837-.837c.63-.63 1.707-.184 1.707.707V6h-3.981c-.89 0-1.337-1.077-.707-1.707l.728-.729a6 6 0 0 0-9.98 3.591 1 1 0 1 1-1.98-.281A8 8 0 0 1 11.514.813Z" /></svg>';
			this.controlsContent.appendChild(this.resetViewBtn);

			this.controlsPanel.appendChild(this.controlsContent);
			this.realContainer.appendChild(this.controlsPanel);

			this.toggleCollapseBtn.addEventListener('click', () => this.controlsPanel.classList.toggle('collapsed'));
			this.controlsPanel.classList.toggle('collapsed', options.includes('controlsCollapsed'));
			this.zoomInBtn.addEventListener('click', () => this.updateScale(this.scale * 1.2));
			this.zoomOutBtn.addEventListener('click', () => this.updateScale(this.scale / 1.2));
			this.zoomSlider.addEventListener('input', e => this.updateScale(Math.pow(1.1, e.target.value)));
			this.resetViewBtn.addEventListener('click', () => this.resetView());
			this.toggleFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
		} else if (options.includes('controlsCollapsed')) console.warn('CanvasViewer: "controlsCollapsed" option is overridden by "controlsHidden" option.');

		// === Preview Modal ===
		this.previewModalBackdrop = document.createElement('div');
		this.previewModalBackdrop.className = 'preview-modal-backdrop hidden';
		this.realContainer.appendChild(this.previewModalBackdrop);

		this.previewModal = document.createElement('div');
		this.previewModal.className = 'preview-modal hidden';

		this.previewModalClose = document.createElement('button');
		this.previewModalClose.className = 'preview-modal-close';
		this.previewModalClose.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.758 17.243 12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243" stroke-width="2" stroke-linecap="round" /></svg>';
		this.previewModal.appendChild(this.previewModalClose);

		this.previewModalContent = document.createElement('div');
		this.previewModalContent.className = 'preview-modal-content';
		this.previewModal.appendChild(this.previewModalContent);

		this.realContainer.appendChild(this.previewModal);
		container.appendChild(this.realContainer);

		if (extensions.includes('mistouchPrevention')) {
			this.preventionContainer = document.createElement('div');
			this.preventionContainer.className = 'prevention-container';
			this.preventionBanner = document.createElement('div');
			this.preventionBanner.className = 'prevention-banner';
			this.preventionBanner.innerHTML = 'Locked to prevent mistouch, click on to unlock.';
			this.preventionContainer.appendChild(this.preventionBanner);
			this.realContainer.appendChild(this.preventionContainer);
			this.realContainer.classList.add('numb');
			this.preventMt = true;
			this.preventMistouch = {
				record: false,
				lastX: 0,
				lastY: 0,
				lastClientX: 0,
				lastClientY: 0,
			};
		}

		this.container = this.realContainer;
		this.extensions = extensions;
		this.options = options;

		// === Variables ===
		this.ctx = this.canvas.getContext('2d');
		this.canvasBaseDir = null;
		this.offsetX = 0;
		this.offsetY = 0;
		this.scale = 1.0;
		this.targetScale = 1.0; // Target scale for smooth zooming
		this.touchPadMode = false;
		this.isPreviewModalOpen = false;

		// === Cache ===
		this.nodeBounds = null;
		this.dpr = window.devicePixelRatio || 1;
		this.canvasData = null; // raw canvas data
		this.nodeMap = {}; // { id: node } all nodes in canvas
		this.spatialGrid = null;
		this.overlays = {}; // { id: node } the overlays in viewport

		// === Constants ===
		this.ARROW_LENGTH = 12;
		this.ARROW_WIDTH = 7;
		this.FILE_NODE_RADIUS = 12;
		this.GRID_CELL_SIZE = 300;
		this.FONT_COLOR = '#fff';
		this.ZOOM_SMOOTHNESS = 0.4; // Adjust this value to control zoom smoothness (0-1)
		this.ZOOM_FACTOR = 1.06;
		this.CSS_ZOOM_REDRAW_INTERVAL = 500; // ms, configurable redraw interval for CSS zoom-in optimization
		this.INITIAL_VIEWPORT_PADDING = 100;

		// === State Variables ===
		this.dragState = {
			lastDrawnX: 0,
			lastDrawnY: 0,
		};
		this.overlayState = {
			selectedId: null,
			interacting: false,
		};
		this.pinchZoomState = {
			initialDistance: 0,
			initialScale: 1,
			initialOffsetX: 0,
			initialOffsetY: 0,
			initialMidpoint: { x: 0, y: 0 },
			pointersBuffer: new Map(),
		};
		this.pointers = new Map();
		this.perFrame = {
			needAnimating: false,
			zoom: false,
			zoomOrigin: {
				x: 0,
				y: 0,
			},
			wheelPan: false,
			wheelPanEvent: null,
			resize: false,
			resizeScale: {
				width: 0,
				height: 0,
				lastCentreX: null,
				lastCentreY: null,
			},
			pointerMove: false,
			moveParams: {
				e: null,
				touch: false,
			},
			zoomInOptimize: {
				lastDrawnViewport: null,
				lastDrawnScale: null,
			},
		};

		// === Attach Event Listeners ===
		// Extension: Mistouch Prevention
		if (this.extensions.includes('mistouchPrevention')) {
			window.addEventListener('pointerdown', this.MP_onPointerDown.bind(this));
			window.addEventListener('pointermove', this.MP_onPointerMove.bind(this));
			window.addEventListener('pointerup', this.MP_onPointerUp.bind(this));
		}
		this.container.addEventListener('pointerdown', this.onPointerDown.bind(this));
		window.addEventListener('pointermove', this.onPointerMove.bind(this));
		window.addEventListener('pointerup', this.onPointerUp.bind(this));
		this.container.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
		this.container.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
		this.container.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
		this.previewModalClose.addEventListener('click', () => this.hidePreviewModal());
		this.previewModalBackdrop.addEventListener('click', () => this.hidePreviewModal());
	}

	// #region Utility Functions
	onResize() {
		this.perFrame.resize = true;
		this.perFrame.resizeScale.width = this.container.clientWidth;
		this.perFrame.resizeScale.height = this.container.clientHeight;
	}

	resize() {
		this.perFrame.resize = false;
		const params = this.perFrame.resizeScale;
		if (params.lastCentreX) {
			this.offsetX += params.width / 2 - params.lastCentreX;
			this.offsetY += params.height / 2 - params.lastCentreY;
		}
		params.lastCentreX = params.width / 2;
		params.lastCentreY = params.height / 2;
		this.resizeCanvasForDPR(this.canvas, this.ctx, params.width, params.height);
		this.container.style.setProperty('--preview-max-width', `${params.width * 0.9}px`);
		this.container.style.setProperty('--preview-max-height', `${params.height * 0.9}px`);
	}

	isUIControl(target) {
		return target.closest && (target.closest('.controls') || target.closest('button') || target.closest('input'));
	}

	findNodeAt(x, y) {
		let candidates = [];
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

	// Screen to Container
	S2C({ x: screenX, y: screenY }) {
		const rect = this.container.getBoundingClientRect();
		return {
			x: screenX - rect.left,
			y: screenY - rect.top,
		};
	}
	// Container to Canvas
	C2C({ x: containerX, y: containerY }) {
		return {
			x: containerX - this.offsetX,
			y: containerY - this.offsetY,
		};
	}
	// Canvas to World
	C2W({ x: canvasX, y: canvasY }) {
		return {
			x: canvasX / this.scale,
			y: canvasY / this.scale,
		};
	}

	judgeInteract(node) {
		// how should the app handle node interactions
		const type = node == undefined ? 'default' : node.type;
		switch (type) {
			case 'text':
				return 'select';
			case 'link':
				return 'select';
			case 'file':
				return node.file.match(/\.md$/i) ? 'select' : 'preview';
			default:
				return 'non-interactive';
		}
	}

	interact(id) {
		const node = this.nodeMap[id];
		const interaction = this.judgeInteract(node);
		switch (interaction) {
			case 'non-interactive':
				this.select(null);
				break;
			case 'select':
				this.select(id);
				break;
			case 'preview':
				if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
					const img = new Image();
					img.src = this.canvasBaseDir + node.file;
					this.showPreviewModal(img);
				} else if (node.file.match(/\.mp3$/i)) {
					const audio = document.createElement('audio');
					audio.controls = true;
					audio.src = this.canvasBaseDir + node.file;
					this.showPreviewModal(audio);
				}
				break;
		}
		if (interaction !== 'non-interactive') this._emit('nodeInteract', node, interaction);
	}

	select(id) {
		const previous = this.overlayState.selectedId === null ? null : this.overlays[this.overlayState.selectedId];
		const current = id === null ? null : this.overlays[id];
		if (previous) previous.classList.remove('active');
		if (current) {
			current.classList.add('active');
			this.overlayState.interacting = true;
		} else this.overlayState.interacting = false;
		this.overlayState.selectedId = id;
	}

	getNthValue(map, n) {
		if (n < 0 || n >= map.size) return undefined;
		let i = 0;
		for (const value of map.values()) {
			if (i === n) return value;
			i++;
		}
	}

	getNthKey(map, n) {
		if (n < 0 || n >= map.size) return undefined;
		let i = 0;
		for (const key of map.keys()) {
			if (i === n) return key;
			i++;
		}
	}
	// #endregion

	// #region Draw Functions
	draw() {
		if (!this.perFrame.needAnimating && !this.perFrame.wheelPan && !this.perFrame.resize && !this.perFrame.pointerMove && !this.perFrame.zoom) {
			requestAnimationFrame(this.draw.bind(this));
			return;
		}
		if (this.perFrame.zoom) this.smoothZoom();
		if (this.perFrame.needAnimating) this.perFrame.needAnimating = false;
		if (this.perFrame.wheelPan) this.wheelPan(this.perFrame.wheelPanEvent);
		if (this.perFrame.resize) this.resize();
		if (this.perFrame.pointerMove) {
			this.perFrame.pointerMove = false;
			this.pointerMove();
		}
		this.overlaysLayer.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
		const currentViewport = this.getCurrentViewport();
		if (this.perFrame.zoomInOptimize.lastDrawnViewport && this.isViewportInside(currentViewport, this.perFrame.zoomInOptimize.lastDrawnViewport) && this.scale !== this.perFrame.zoomInOptimize.lastDrawnScale) this.CSS_ZOOM_REDRAW_INTERVAL = 500;
		else this.CSS_ZOOM_REDRAW_INTERVAL = 1;
		this.redraw(currentViewport);
		this.updateAllOverlays();
		if (this.extensions.includes('minimap')) this.updateViewportRectangle(); // Extension: Minimap
		requestAnimationFrame(this.draw.bind(this));
	}

	resizeCanvasForDPR(canvas, ctx, width, height) {
		canvas.width = Math.round(width * this.dpr);
		canvas.height = Math.round(height * this.dpr);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(this.dpr, this.dpr);
	}

	getColor(colorIndex) {
		let themeColor = null;
		switch (colorIndex) {
			case '1':
				themeColor = 'rgba(255, 120, 129, ?)';
				break;
			case '2':
				themeColor = 'rgba(251, 187, 131, ?)';
				break;
			case '3':
				themeColor = 'rgba(255, 232, 139, ?)';
				break;
			case '4':
				themeColor = 'rgba(124, 211, 124, ?)';
				break;
			case '5':
				themeColor = 'rgba(134, 223, 226, ?)';
				break;
			case '6':
				themeColor = 'rgba(203, 158, 255, ?)';
				break;
			default:
				themeColor = 'rgba(140, 140, 140, ?)';
		}
		return {
			border: themeColor.replace('?', '0.75'),
			background: themeColor.replace('?', '0.1'),
			active: themeColor.replace('?', '1'),
		};
	}

	throttle(func, alternateFunc) {
		let timeout = null;
		let lastArgs = null;
		let lastCallTime = -Infinity;
		return function throttled(...args) {
			const now = Date.now();
			const timeSinceLast = now - lastCallTime;
			if (timeSinceLast >= this.CSS_ZOOM_REDRAW_INTERVAL) {
				func.apply(this, args);
				lastCallTime = now;
			} else {
				lastArgs = args;
				alternateFunc.apply(this, args);
				if (!timeout) {
					timeout = setTimeout(() => {
						func.apply(this, lastArgs);
						lastCallTime = Date.now();
						timeout = null;
					}, this.CSS_ZOOM_REDRAW_INTERVAL - timeSinceLast);
				}
			}
		};
	}

	redraw = this.throttle(
		() => {
			this.canvas.style.transform = '';
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.ctx.save();
			this.ctx.translate(this.offsetX, this.offsetY);
			this.ctx.scale(this.scale, this.scale);
			this.canvasData.nodes.forEach(node => (node._inViewport = this.isNodeInViewport(node)));
			this.canvasData.nodes.forEach(node => {
				switch (node.type) {
					case 'group':
						this.drawGroup(node);
						break;
					case 'file':
						this.drawFileNode(node);
						break;
				}
			});
			this.canvasData.edges.forEach(edge => this.drawEdge(edge));
			this.ctx.restore();
			this.perFrame.zoomInOptimize.lastDrawnViewport = this.getCurrentViewport();
			this.perFrame.zoomInOptimize.lastDrawnScale = this.scale;
		},
		currentViewport => {
			const cssScale = this.scale / this.perFrame.zoomInOptimize.lastDrawnScale;
			this.applyCanvasCssScale(cssScale, currentViewport, this.perFrame.zoomInOptimize.lastDrawnViewport);
		},
	);

	getCurrentViewport() {
		const left = -this.offsetX / this.scale;
		const top = -this.offsetY / this.scale;
		const right = left + this.container.clientWidth / this.scale;
		const bottom = top + this.container.clientHeight / this.scale;
		return { left, top, right, bottom };
	}

	isViewportInside(inner, outer) {
		return inner.left > outer.left && inner.top > outer.top && inner.right < outer.right && inner.bottom < outer.bottom;
	}

	applyCanvasCssScale(cssScale, currentViewport, lastDrawnViewport) {
		const currentOffsetX = (lastDrawnViewport.left - currentViewport.left) * this.scale;
		const currentOffsetY = (lastDrawnViewport.top - currentViewport.top) * this.scale;
		this.canvas.style.transform = `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${cssScale})`;
	}

	drawLabelBar(x, y, label, colors) {
		const barHeight = 30 * this.scale;
		const radius = 6 * this.scale;
		const yOffset = 8 * this.scale;
		const fontSize = 16 * this.scale;
		const xPadding = 6 * this.scale;
		this.ctx.save();
		this.ctx.translate(x, y);
		this.ctx.scale(1 / this.scale, 1 / this.scale);
		this.ctx.font = `${fontSize}px 'Inter', sans-serif`;
		const barWidth = this.ctx.measureText(label).width + 2 * xPadding;
		this.ctx.translate(0, -barHeight - yOffset);
		this.ctx.fillStyle = colors.border;
		this.ctx.beginPath();
		this.ctx.moveTo(radius, 0);
		this.ctx.lineTo(barWidth - radius, 0);
		this.ctx.quadraticCurveTo(barWidth, 0, barWidth, radius);
		this.ctx.lineTo(barWidth, barHeight - radius);
		this.ctx.quadraticCurveTo(barWidth, barHeight, barWidth - radius, barHeight);
		this.ctx.lineTo(radius, barHeight);
		this.ctx.quadraticCurveTo(0, barHeight, 0, barHeight - radius);
		this.ctx.lineTo(0, radius);
		this.ctx.quadraticCurveTo(0, 0, radius, 0);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.fillStyle = this.FONT_COLOR;
		this.ctx.fillText(label, xPadding, barHeight * 0.65);
		this.ctx.restore();
	}

	drawRoundRect(ctx, x, y, width, height, radius) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	}

	drawNodeBackground(node) {
		const colors = this.getColor(node.color);
		const radius = this.FILE_NODE_RADIUS;
		this.ctx.globalAlpha = 1.0;
		this.ctx.fillStyle = colors.background;
		this.drawRoundRect(this.ctx, node.x + 1, node.y + 1, node.width - 2, node.height - 2, radius);
		this.ctx.fill();
		this.ctx.strokeStyle = colors.border;
		this.ctx.lineWidth = 2;
		this.drawRoundRect(this.ctx, node.x, node.y, node.width, node.height, radius);
		this.ctx.stroke();
	}

	drawGroup(node) {
		this.drawNodeBackground(node);
		if (node.label) this.drawLabelBar(node.x, node.y, node.label, this.getColor(node.color));
	}

	drawFileNode(node) {
		if (!node.file.match(/\.md|png|jpg|jpeg|gif|svg$/i)) {
			this.drawNodeBackground(node);
			if (node.file.match(/\.mp3$/i)) {
				this.ctx.fillStyle = this.FONT_COLOR;
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText('🎵 Click to Preview 🎵', node.x + node.width / 2, node.y + node.height / 2);
				this.ctx.textAlign = 'left';
			}
		}
		this.ctx.fillStyle = this.FONT_COLOR;
		this.ctx.font = '16px sans-serif';
		this.ctx.fillText(node.file, node.x + 5, node.y - 10);
	}

	drawEdge(edge) {
		const { fromNode, toNode } = this.getEdgeNodes(edge);
		if (!fromNode || !toNode) return;
		const [startX, startY] = this.getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = this.getAnchorCoord(toNode, edge.toSide);
		let [startControlX, startControlY, endControlX, endControlY] = [0, 0, 0, 0];
		if (!edge.controlPoints) {
			[startControlX, startControlY, endControlX, endControlY] = this.getControlPoints(startX, startY, endX, endY, edge.fromSide, edge.toSide);
			edge.controlPoints = [startControlX, startControlY, endControlX, endControlY];
		} else [startControlX, startControlY, endControlX, endControlY] = edge.controlPoints;
		this.drawCurvedPath(startX, startY, endX, endY, startControlX, startControlY, endControlX, endControlY);
		this.drawArrowhead(endX, endY, endControlX, endControlY);
		if (edge.label) {
			const t = 0.5;
			const x = Math.pow(1 - t, 3) * startX + 3 * Math.pow(1 - t, 2) * t * startControlX + 3 * (1 - t) * t * t * endControlX + Math.pow(t, 3) * endX;
			const y = Math.pow(1 - t, 3) * startY + 3 * Math.pow(1 - t, 2) * t * startControlY + 3 * (1 - t) * t * t * endControlY + Math.pow(t, 3) * endY;
			this.ctx.font = '18px sans-serif';
			const metrics = this.ctx.measureText(edge.label);
			const padding = 8;
			const labelWidth = metrics.width + padding * 2;
			const labelHeight = 20;
			this.ctx.fillStyle = '#222';
			this.ctx.beginPath();
			this.drawRoundRect(this.ctx, x - labelWidth / 2, y - labelHeight / 2 - 2, labelWidth, labelHeight, 4);
			this.ctx.fill();
			this.ctx.fillStyle = '#ccc';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText(edge.label, x, y - 2);
			this.ctx.textAlign = 'left';
			this.ctx.textBaseline = 'alphabetic';
		}
	}

	getEdgeNodes(edge) {
		return {
			fromNode: this.nodeMap[edge.fromNode],
			toNode: this.nodeMap[edge.toNode],
		};
	}

	getControlPoints(startX, startY, endX, endY, fromSide, toSide) {
		const distanceX = endX - startX;
		const distanceY = endY - startY;
		const realDistance = Math.min(Math.abs(distanceX), Math.abs(distanceY)) + 0.3 * Math.max(Math.abs(distanceX), Math.abs(distanceY));
		const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
		const PADDING = clamp(realDistance * 0.5, 60, 300);
		let startControlX = startX;
		let startControlY = startY;
		let endControlX = endX;
		let endControlY = endY;
		switch (fromSide) {
			case 'top':
				startControlY = startY - PADDING;
				break;
			case 'bottom':
				startControlY = startY + PADDING;
				break;
			case 'left':
				startControlX = startX - PADDING;
				break;
			case 'right':
				startControlX = startX + PADDING;
				break;
		}
		switch (toSide) {
			case 'top':
				endControlY = endY - PADDING;
				break;
			case 'bottom':
				endControlY = endY + PADDING;
				break;
			case 'left':
				endControlX = endX - PADDING;
				break;
			case 'right':
				endControlX = endX + PADDING;
				break;
		}
		return [startControlX, startControlY, endControlX, endControlY];
	}

	drawCurvedPath(startX, startY, endX, endY, c1x, c1y, c2x, c2y) {
		this.ctx.beginPath();
		this.ctx.moveTo(startX, startY);
		this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endX, endY);
		this.ctx.strokeStyle = '#ccc';
		this.ctx.lineWidth = 2;
		this.ctx.stroke();
	}

	getAnchorCoord(node, side) {
		const midX = node.x + node.width / 2;
		const midY = node.y + node.height / 2;
		switch (side) {
			case 'top':
				return [midX, node.y];
			case 'bottom':
				return [midX, node.y + node.height];
			case 'left':
				return [node.x, midY];
			case 'right':
				return [node.x + node.width, midY];
			default:
				return [midX, midY];
		}
	}

	drawArrowhead(tipX, tipY, fromX, fromY) {
		const dx = tipX - fromX;
		const dy = tipY - fromY;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) return;
		const unitX = dx / length;
		const unitY = dy / length;
		const leftX = tipX - unitX * this.ARROW_LENGTH - unitY * this.ARROW_WIDTH;
		const leftY = tipY - unitY * this.ARROW_LENGTH + unitX * this.ARROW_WIDTH;
		const rightX = tipX - unitX * this.ARROW_LENGTH + unitY * this.ARROW_WIDTH;
		const rightY = tipY - unitY * this.ARROW_LENGTH - unitX * this.ARROW_WIDTH;
		this.ctx.beginPath();
		this.ctx.fillStyle = '#ccc';
		this.ctx.moveTo(tipX, tipY);
		this.ctx.lineTo(leftX, leftY);
		this.ctx.lineTo(rightX, rightY);
		this.ctx.closePath();
		this.ctx.fill();
	}

	setInitialView() {
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
		this.targetScale = this.scale; // Set targetScale to the initial scale
		this.offsetX = initialView.offsetX;
		this.offsetY = initialView.offsetY;
		if (!this.options.includes('controlsHidden')) this.zoomSlider.value = this.scaleToSlider(this.scale);
		this.perFrame.needAnimating = true;
	}

	// #endregion

	// #region Load Canvas
	/**
	 * Load a canvas file (by path or object)
	 * @param {string|Object} pathOrObject - Path to .canvas file or canvas data object
	 */
	async loadCanvas(pathOrObject) {
		try {
			if (/^https?:\/\//.test(pathOrObject)) this.canvasBaseDir = pathOrObject.substring(0, pathOrObject.lastIndexOf('/') + 1);
			else {
				const lastSlash = pathOrObject.lastIndexOf('/');
				this.canvasBaseDir = lastSlash !== -1 ? pathOrObject.substring(0, lastSlash + 1) : './';
			}
			this.canvasData = await fetch(pathOrObject).then(res => res.json());
			this.canvasData.nodes.forEach(node => {
				this.nodeMap[node.id] = node;
			});
			this.buildSpatialGrid();
			this.nodeBounds = this.calculateNodesBounds();
			this.setInitialView();
			this.resizeCanvasForDPR(this.canvas, this.ctx, this.container.offsetWidth, this.container.offsetHeight);
			this.draw();
			// Extension: Minimap
			if (this.extensions.includes('minimap')) {
				this.resizeCanvasForDPR(this.minimapCanvas, this.minimapCtx, this.minimapCanvas.width, this.minimapCanvas.height);
				this.drawMinimap();
			}
			this._resizeObserver = new ResizeObserver(() => this.onResize());
			this._resizeObserver.observe(this.container);
			this._emit('canvasLoaded', this.canvasData);
		} catch (err) {
			console.error('Failed to load canvas data:', err);
		}
	}

	buildSpatialGrid() {
		if (!this.canvasData || this.canvasData.nodes.length < 50) return;
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

	calculateNodesBounds() {
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
	// #endregion

	// #region Event Handlers
	/**
	 * Register an event listener for CanvasViewer events.
	 * @param {string} event - Event name (e.g., 'nodeSelect', 'canvasLoaded', 'zoom', 'pan', 'resetView')
	 * @param {Function} callback - Callback function to invoke with event data
	 */
	on(event, callback) {
		if (!this._eventMap) this._eventMap = {};
		if (!this._eventMap[event]) this._eventMap[event] = [];
		this._eventMap[event].push(callback);
	}

	/**
	 * Internal: Emit an event
	 * @param {string} event - Event name
	 * @param {any} data - Event data
	 */
	_emit(event, data) {
		if (this._eventMap && this._eventMap[event]) {
			for (const cb of this._eventMap[event]) cb(data);
		}
	}

	/**
	 * Set the zoom scale of the canvas viewer.
	 * @param {number} scale - The new zoom scale (clamped between 0.05 and 20)
	 */
	setScale(scale) {
		this.updateScale(Math.max(0.05, Math.min(20, scale)));
		this._emit('zoom', this.scale);
	}

	/**
	 * Reset the view to the initial position and scale.
	 */
	resetView() {
		this.setInitialView();
		this._emit('resetView');
	}

	zoomIn() {
		this.setScale(this.scale * 1.2);
	}
	zoomOut() {
		this.setScale(this.scale / 1.2);
	}

	/**
	 * Pan the view to a specific world coordinate.
	 * @param {number} x - X coordinate in world space
	 * @param {number} y - Y coordinate in world space
	 */
	panTo(x, y) {
		this.offsetX = this.container.clientWidth / 2 - x * this.scale;
		this.offsetY = this.container.clientHeight / 2 - y * this.scale;
		this.perFrame.needAnimating = true;
		this._emit('pan', { x, y });
	}

	/**
	 * Destroy the viewer and clean up DOM and event listeners.
	 */
	destroy() {
		if (this._resizeObserver) {
			this._resizeObserver.disconnect();
			this._resizeObserver = null;
		}
		this.container.innerHTML = '';
		this._eventMap = {};
	}
	// #endregion

	// #region Overlays
	isNodeInViewport(node, margin = 200) {
		const viewLeft = -this.offsetX / this.scale - margin;
		const viewTop = -this.offsetY / this.scale - margin;
		const viewRight = viewLeft + this.container.clientWidth / this.scale + 2 * margin;
		const viewBottom = viewTop + this.container.clientHeight / this.scale + 2 * margin;
		return node.x + node.width > viewLeft && node.x < viewRight && node.y + node.height > viewTop && node.y < viewBottom;
	}

	async loadMarkdownForNode(node) {
		if (!node.mdContent) {
			node.mdContent = 'Loading...';
			this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
			try {
				let result = await fetch(this.canvasBaseDir + node.file);
				result = await result.text();
				const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
				if (frontmatterMatch) {
					const frontmatter = frontmatterMatch[1].split('\n').reduce((acc, line) => {
						const [key, value] = line.split(':').map(s => s.trim());
						acc[key] = value;
						return acc;
					}, {});
					node.mdContent = marked.parse(frontmatterMatch[2].trim());
					node.mdFrontmatter = frontmatter;
				} else {
					node.mdContent = marked.parse(result);
					node.mdFrontmatter = null;
				}
			} catch (err) {
				console.error('Failed to load markdown:', err);
				node.mdContent = 'Failed to load content.';
				node.mdFrontmatter = null;
			}
		}
		this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
	}

	updateAllOverlays() {
		const neededOverlays = new Set();
		const overlayCreators = {
			text: node => {
				if (node._inViewport) {
					neededOverlays.add(node.id);
					this.updateOrCreateOverlay(node, node.text, 'text');
				}
			},
			file: node => {
				if (node._inViewport) {
					neededOverlays.add(node.id);
					if (node.file.match(/\.md$/i)) this.loadMarkdownForNode(node);
					else if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) this.updateOrCreateOverlay(node, this.canvasBaseDir + node.file, 'image');
				}
			},
			link: node => {
				neededOverlays.add(node.id);
				this.updateOrCreateOverlay(node, node.url, 'link');
			},
		};
		Object.values(this.nodeMap).forEach(node => {
			if (overlayCreators[node.type]) overlayCreators[node.type](node);
		});
		Object.keys(this.overlays).forEach(id => {
			if (!neededOverlays.has(id)) {
				const div = this.overlays[id];
				if (div && div.parentNode) div.parentNode.removeChild(div);
				delete this.overlays[id];
			}
		});
	}

	updateOrCreateOverlay(node, content, type) {
		let element = this.overlays[node.id];
		if (!element) {
			element = this.constructOverlay(node, content, type);
			this.overlaysLayer.appendChild(element);
			this.overlays[node.id] = element;
			element.style.left = node.x + 'px';
			element.style.top = node.y + 'px';
			element.style.width = node.width + 'px';
			element.style.height = node.height + 'px';
		}
		if (type === 'markdown') {
			const parsedContentContainer = element.getElementsByClassName('parsed-content-wrapper')[0];
			if (parsedContentContainer.innerHTML !== node.mdContent) parsedContentContainer.innerHTML = node.mdContent;
			if (!element.classList.contains('rtl') && node.mdFrontmatter?.direction === 'rtl') element.classList.add('rtl');
		}
	}

	constructOverlay(node, content, type) {
		const overlay = document.createElement('div');
		overlay.classList.add('overlay-container');
		const overlayBorder = document.createElement('div');
		overlayBorder.className = 'overlay-border';
		overlay.appendChild(overlayBorder);
		if (type === 'text' || type === 'markdown') {
			overlay.classList.add('markdown-content');
			const parsedContentWrapper = document.createElement('div');
			parsedContentWrapper.innerHTML = marked.parse(content || '');
			parsedContentWrapper.classList.add('parsed-content-wrapper');
			overlay.appendChild(parsedContentWrapper);
		} else if (type === 'link') {
			const iframe = document.createElement('iframe');
			iframe.src = content;
			iframe.sandbox = 'allow-scripts allow-same-origin';
			iframe.className = 'link-iframe';
			iframe.loading = 'lazy';
			const clickLayer = document.createElement('div');
			clickLayer.className = 'link-click-layer';
			overlay.appendChild(iframe);
			overlay.appendChild(clickLayer);
		} else if (type === 'image') {
			const img = document.createElement('img');
			img.src = content;
			img.loading = 'lazy';
			overlay.appendChild(img);
		}
		const colorClass = node.color == undefined ? 'color-0' : 'color-' + node.color;
		overlay.classList.add(colorClass);
		if (type !== 'image') {
			if (this.overlayState.selectedId === node.id) overlay.classList.add('active');
			overlay.addEventListener('pointerenter', () => {
				if (this.overlayState.selectedId === node.id) this.overlayState.interacting = true;
			});
			overlay.addEventListener('pointerleave', () => {
				if (this.overlayState.selectedId === node.id) this.overlayState.interacting = false;
			});
			overlay.addEventListener('touchstart', () => {
				if (this.overlayState.selectedId === node.id) this.overlayState.interacting = true;
			});
			overlay.addEventListener('touchend', () => {
				if (this.overlayState.selectedId === node.id) this.overlayState.interacting = false;
			});
		}
		return overlay;
	}
	// #endregion

	// #region Scale and Preview
	scaleToSlider(scale) {
		return Math.log(scale) / Math.log(1.1);
	}

	updateScale(newScale) {
		const bounds = this.container.getBoundingClientRect();
		this.perFrame.zoomOrigin = {
			x: bounds.left + bounds.width / 2,
			y: bounds.top + bounds.height / 2,
		};
		this.targetScale = Math.round(Math.max(0.05, Math.min(20, newScale)) * 1000) / 1000;
		this.perFrame.zoom = true;
	}

	// === Preview ===
	showPreviewModal(content) {
		this.previewModalContent.innerHTML = '';
		this.isPreviewModalOpen = true;
		this.previewModalBackdrop.classList.remove('hidden');
		this.previewModal.classList.remove('hidden');
		this.previewModalContent.appendChild(content);
	}

	hidePreviewModal() {
		this.isPreviewModalOpen = false;
		this.previewModalBackdrop.classList.add('hidden');
		this.previewModal.classList.add('hidden');
	}

	toggleFullscreen(option = 'toggle') {
		if (document.fullscreenElement === null && (option === 'toggle' || option === 'enter')) {
			this.container.requestFullscreen();
			this.toggleFullscreenBtn.innerHTML = `
            	<svg viewBox="-40.32 -40.32 176.64 176.64"><path d="M30 60H6a6 6 0 0 0 0 12h18v18a6 6 0 0 0 12 0V66a5.997 5.997 0 0 0-6-6Zm60 0H66a5.997 5.997 0 0 0-6 6v24a6 6 0 0 0 12 0V72h18a6 6 0 0 0 0-12ZM66 36h24a6 6 0 0 0 0-12H72V6a6 6 0 0 0-12 0v24a5.997 5.997 0 0 0 6 6ZM30 0a5.997 5.997 0 0 0-6 6v18H6a6 6 0 0 0 0 12h24a5.997 5.997 0 0 0 6-6V6a5.997 5.997 0 0 0-6-6Z"/></svg>
        	`;
		} else if (document.fullscreenElement !== null && (option === 'toggle' || option === 'exit')) {
			document.exitFullscreen();
			this.toggleFullscreenBtn.innerHTML = `
            	<svg viewBox="-5.28 -5.28 34.56 34.56" fill="none"><path d="M4 9V5.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C4.76 4 5.04 4 5.6 4H9M4 15v3.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C4.76 20 5.04 20 5.6 20H9m6-16h3.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C20 4.76 20 5.04 20 5.6V9m0 6v3.4c0 .56 0 .84-.109 1.054a1 1 0 0 1-.437.437C19.24 20 18.96 20 18.4 20H15" stroke-width="2.4" stroke-linecap="round"/></svg>
        	`;
		}
	}
	// #endregion

	// #region Pointer Events
	onPointerDown(e) {
		if (this.isPreviewModalOpen || this.isUIControl(e.target) || this.pointers.size === 2 || this.overlayState.interacting) return;
		if (e.isPrimary) this.pointers.clear();

		/*
		if (this.overlayState.interacting && this.pointers.size !== 1) {
			if (e.isPrimary) this.pinchZoomState.pointersBuffer.clear();
			if (this.pinchZoomState.pointersBuffer.size !== 1) {
				this.pinchZoomState.pointersBuffer.set(e.pointerId, {
					startX: e.clientX,
					startY: e.clientY,
					lastX: e.clientX,
					lastY: e.clientY,
				});
				return;
			}
		}
		if (this.pinchZoomState.pointersBuffer.size === 1) {
			this.pointers.set(this.getNthKey(this.pinchZoomState.pointersBuffer, 0), this.getNthValue(this.pinchZoomState.pointersBuffer, 0));
			this.pinchZoomState.pointersBuffer.clear();
		}
		*/

		this.pointers.set(e.pointerId, {
			startX: e.clientX,
			startY: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			interrupted: false,
		});
		if (this.pointers.size === 2) {
			this.pointers.get(e.pointerId).interrupted = true;
			this.getNthValue(this.pointers, 0).interrupted = true;
			this.pinchZoomState.initialDistance = this.getPointerDistance(this.pointers);
			this.pinchZoomState.initialScale = this.scale;
			this.pinchZoomState.initialOffsetX = this.offsetX;
			this.pinchZoomState.initialOffsetY = this.offsetY;
			this.pinchZoomState.initialMidpoint = this.S2C(this.getPointerMidpoint(this.pointers));
		} else if (this.pointers.size === 1) {
			this.dragState.lastDrawnX = e.clientX;
			this.dragState.lastDrawnY = e.clientY;
		}
	}

	onPointerMove(e) {
		/*
		if (this.overlayState.interacting && this.pinchZoomState.pointersBuffer.has(e.pointerId)) {
			this.pinchZoomState.pointersBuffer.set(e.pointerId, {
				startX: this.pinchZoomState.pointersBuffer.get(e.pointerId).startX,
				startY: this.pinchZoomState.pointersBuffer.get(e.pointerId).startY,
				lastX: e.clientX,
				lastY: e.clientY,
			});
			return;
		}
		*/
		if (!this.pointers.has(e.pointerId)) return;
		this.pointers.set(e.pointerId, {
			startX: this.pointers.get(e.pointerId).startX,
			startY: this.pointers.get(e.pointerId).startY,
			lastX: e.clientX,
			lastY: e.clientY,
			interrupted: this.pointers.get(e.pointerId).interrupted,
		});
		this.perFrame.pointerMove = true;
	}

	pointerMove() {
		if (this.pointers.size === 0) return;
		if (this.pointers.size === 1) {
			const e = this.getNthValue(this.pointers, 0);
			const dx = e.lastX - this.dragState.lastDrawnX;
			const dy = e.lastY - this.dragState.lastDrawnY;
			this.offsetX += dx;
			this.offsetY += dy;
			this.dragState.lastDrawnX = e.lastX;
			this.dragState.lastDrawnY = e.lastY;
		} else if (this.pointers.size === 2) {
			const newDistance = this.getPointerDistance(this.pointers);
			let zoomFactor = newDistance / this.pinchZoomState.initialDistance;
			let newScale = Math.round(Math.max(0.05, Math.min(20, this.pinchZoomState.initialScale * zoomFactor)) * 1000) / 1000;
			const midScreen = this.S2C(this.getPointerMidpoint(this.pointers));
			const mid0 = this.pinchZoomState.initialMidpoint;
			const offset0 = { x: this.pinchZoomState.initialOffsetX, y: this.pinchZoomState.initialOffsetY };
			const scale0 = this.pinchZoomState.initialScale;
			const world0 = {
				x: (mid0.x - offset0.x) / scale0,
				y: (mid0.y - offset0.y) / scale0,
			};
			this.scale = newScale;
			this.offsetX = midScreen.x - world0.x * newScale;
			this.offsetY = midScreen.y - world0.y * newScale;
		}
	}

	onPointerUp(e) {
		// if (this.overlayState.interacting) this.pinchZoomState.pointersBuffer.delete(e.pointerId);
		if (!this.pointers.has(e.pointerId)) return;
		this.pointers.set(e.pointerId, {
			startX: this.pointers.get(e.pointerId).startX,
			startY: this.pointers.get(e.pointerId).startY,
			lastX: e.clientX,
			lastY: e.clientY,
			interrupted: this.pointers.get(e.pointerId).interrupted,
		});
		if (this.pointers.size === 1 && !this.pointers.get(e.pointerId).interrupted) {
			const pointer = this.pointers.get(e.pointerId);
			if (Math.abs(pointer.startX - pointer.lastX) + Math.abs(pointer.startY - pointer.lastY) < 5) {
				const worldCoords = this.C2W(this.C2C(this.S2C({ x: pointer.lastX, y: pointer.lastY })));
				const node = this.findNodeAt(worldCoords.x, worldCoords.y);
				this.interact(node?.id);
			}
		} else if (this.pointers.size === 2) {
			this.pointers.delete(e.pointerId);
			this.dragState.lastDrawnX = this.getNthValue(this.pointers, 0).lastX;
			this.dragState.lastDrawnY = this.getNthValue(this.pointers, 0).lastY;
		}
		this.pointers.delete(e.pointerId);
	}

	getPointerDistance(pointers) {
		const dx = this.getNthValue(pointers, 0).lastX - this.getNthValue(pointers, 1).lastX;
		const dy = this.getNthValue(pointers, 0).lastY - this.getNthValue(pointers, 1).lastY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// output screen coords
	getPointerMidpoint(pointers) {
		return {
			x: (this.getNthValue(pointers, 0).lastX + this.getNthValue(pointers, 1).lastX) / 2,
			y: (this.getNthValue(pointers, 0).lastY + this.getNthValue(pointers, 1).lastY) / 2,
		};
	}

	// === Wheel ===
	wheelPan(e) {
		this.perFrame.wheelPan = false;
		this.offsetX -= e.deltaX;
		this.offsetY -= e.deltaY;
	}

	smoothZoom() {
		this.targetScale = Math.round(Math.max(0.05, Math.min(20, this.targetScale)) * 1000) / 1000;
		const scaleDiff = this.targetScale - this.scale;
		let newScale;
		if (Math.abs(scaleDiff) < this.targetScale * 0.01 + 0.002) {
			newScale = this.targetScale;
			this.perFrame.zoom = false;
		} else newScale = Math.round((this.scale + scaleDiff * this.ZOOM_SMOOTHNESS) * 1000) / 1000;
		const containerCoords = this.S2C(this.perFrame.zoomOrigin);
		const canvasCoords = this.C2C(containerCoords);
		this.offsetX = containerCoords.x - (canvasCoords.x * newScale) / this.scale;
		this.offsetY = containerCoords.y - (canvasCoords.y * newScale) / this.scale;
		this.scale = newScale;
		if (!this.options.includes('controlsHidden')) this.zoomSlider.value = this.scaleToSlider(this.scale); // Option: controlsHidden
	}

	onWheel(e) {
		if (!this.touchPadMode && (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) this.touchPadMode = true;
		if (this.isPreviewModalOpen || (this.overlayState.interacting && (!this.touchPadMode || (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey)))) return;
		e.preventDefault();
		if (this.touchPadMode && !e.ctrlKey) {
			this.perFrame.wheelPan = true;
			this.perFrame.wheelPanEvent = e;
		} else {
			if (e.deltaY < 0) this.targetScale *= this.ZOOM_FACTOR;
			else this.targetScale /= this.ZOOM_FACTOR;
			this.perFrame.zoomOrigin = { x: e.clientX, y: e.clientY };
			this.perFrame.zoom = true;
		}
	}
	// #endregion

	// #region Minimap Extension
	drawMinimap() {
		const bounds = this.nodeBounds;
		if (!bounds) return;
		const displayWidth = this.minimap.clientWidth;
		const displayHeight = this.minimap.clientHeight;
		const scaleX = displayWidth / bounds.width;
		const scaleY = displayHeight / bounds.height;
		this.minimapCache.scale = Math.min(scaleX, scaleY) * 0.9;
		this.minimapCache.centerX = displayWidth / 2;
		this.minimapCache.centerY = displayHeight / 2;
		this.minimapCtx.clearRect(0, 0, displayWidth, displayHeight);
		this.minimapCtx.save();
		this.minimapCtx.translate(this.minimapCache.centerX, this.minimapCache.centerY);
		this.minimapCtx.scale(this.minimapCache.scale, this.minimapCache.scale);
		this.minimapCtx.translate(-bounds.centerX, -bounds.centerY);
		for (let edge of this.canvasData.edges) this.drawMinimapEdge(edge);
		for (let node of this.canvasData.nodes) this.drawMinimapNode(node);
		this.minimapCtx.restore();
	}

	drawMinimapNode(node) {
		const colors = this.getColor(node.color);
		const radius = 25;
		this.minimapCtx.fillStyle = colors.border;
		this.minimapCtx.globalAlpha = 0.3;
		this.drawRoundRect(this.minimapCtx, node.x, node.y, node.width, node.height, radius);
		this.minimapCtx.fill();
		this.minimapCtx.globalAlpha = 1.0;
	}

	drawMinimapEdge(edge) {
		const fromNode = this.nodeMap[edge.fromNode];
		const toNode = this.nodeMap[edge.toNode];
		if (!fromNode || !toNode) return;
		const [startX, startY] = this.getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = this.getAnchorCoord(toNode, edge.toSide);
		this.minimapCtx.beginPath();
		this.minimapCtx.moveTo(startX, startY);
		this.minimapCtx.lineTo(endX, endY);
		this.minimapCtx.strokeStyle = '#555';
		this.minimapCtx.lineWidth = 10;
		this.minimapCtx.stroke();
	}

	updateViewportRectangle() {
		if (!this.isMinimapVisible) return;
		const bounds = this.nodeBounds;
		if (!bounds) return;
		const viewWidth = this.container.clientWidth / this.scale;
		const viewHeight = this.container.clientHeight / this.scale;
		const viewportCenterX = -this.offsetX / this.scale + this.container.clientWidth / (2 * this.scale);
		const viewportCenterY = -this.offsetY / this.scale + this.container.clientHeight / (2 * this.scale);
		const viewRectX = this.minimapCache.centerX + (viewportCenterX - viewWidth / 2 - bounds.centerX) * this.minimapCache.scale;
		const viewRectY = this.minimapCache.centerY + (viewportCenterY - viewHeight / 2 - bounds.centerY) * this.minimapCache.scale;
		const viewRectWidth = viewWidth * this.minimapCache.scale;
		const viewRectHeight = viewHeight * this.minimapCache.scale;
		this.viewportRectangle.style.left = viewRectX + 'px';
		this.viewportRectangle.style.top = viewRectY + 'px';
		this.viewportRectangle.style.width = viewRectWidth + 'px';
		this.viewportRectangle.style.height = viewRectHeight + 'px';
	}
	// #endregion

	// #region Mistouch Prevention Extension
	MP_onPointerDown(e) {
		const bounds = this.container.getBoundingClientRect();
		if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
			if (!this.preventMt) {
				this.preventionContainer.classList.remove('hidden');
				this.container.classList.add('numb');
				this.preventMt = true;
			}
		} else {
			if (this.preventMt) {
				this.preventMistouch.lastX = e.clientX;
				this.preventMistouch.lastY = e.clientY;
				this.preventMistouch.lastClientX = e.clientX;
				this.preventMistouch.lastClientY = e.clientY;
				this.preventMistouch.record = true;
			}
		}
	}

	MP_onPointerMove(e) {
		if (this.preventMistouch.record) {
			this.preventMistouch.lastClientX = e.clientX;
			this.preventMistouch.lastClientY = e.clientY;
		}
	}

	MP_onPointerUp() {
		if (this.preventMistouch.record) {
			this.preventMistouch.record = false;
			if (Math.abs(this.preventMistouch.lastClientX - this.preventMistouch.lastX) + Math.abs(this.preventMistouch.lastClientY - this.preventMistouch.lastY) < 5) {
				this.preventMt = false;
				this.preventionContainer.classList.add('hidden');
				setTimeout(() => this.container.classList.remove('numb'), 50); // minimum delay to prevent triggering undesired button touch
			}
		}
	}
	// #endregion
}

class obsidianCanvas extends HTMLElement {
	constructor() {
		super();
		this.style.display = 'block';
		this.style.overflow = 'hidden';
		this.attachShadow({ mode: 'open' });
		const extensions = this.getAttribute('extensions') ? this.getAttribute('extensions').split(' ') : [];
		const options = this.getAttribute('options') ? this.getAttribute('options').split(' ') : [];
		this.viewer = new CanvasViewer(this.shadowRoot, extensions, options);
	}
	connectedCallback() {
		if (this.viewer) this.viewer.loadCanvas(this.getAttribute('src'));
	}
	disconnectedCallback() {
		if (this.viewer) this.viewer.destroy();
	}
}

customElements.define('obsidian-canvas', obsidianCanvas);
