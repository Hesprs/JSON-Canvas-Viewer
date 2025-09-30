import { deepMerge } from './utilities';
import styles from './styles.scss?inline';
import { dataManager } from './dataManager';
import interactionHandler from './interactionHandler';
import overlayManager from './overlayManager';
import renderer from './renderer';

export default class canvasViewer {
	private animationId: null | number = null;
	private resizeAnimationId: null | number = null;
	private resizeObserver: ResizeObserver;
	private dataManager: dataManager;
	private perFrame: {
		lastScale: number;
		lastOffsets: { x: number; y: number };
	} = {
		lastScale: 1,
		lastOffsets: { x: 0, y: 0 },
	};
	private lastResizeCenter: {
		x: null | number;
		y: null | number;
	} = {
		x: null,
		y: null,
	};
	private data: runtimeData = {
		offsetX: 0,
		offsetY: 0,
		scale: 1,
		canvasData: {
			nodes: [],
			edges: [],
			metadata: {
				version: '',
				frontmatter: {},
			},
		},
		nodeMap: {},
		canvasBaseDir: '',
		nodeBounds: {
			minX: 0,
			minY: 0,
			maxX: 0,
			maxY: 0,
			width: 0,
			height: 0,
			centerX: 0,
			centerY: 0,
		},
		container: document.createElement('div'),
	};
	private registry: registry = {
		options: {
			main: {},
		},
		extensions: [renderer, interactionHandler, overlayManager],
		hooks: {
			onDispose: [],
			onLoaded: [],
			onRender: [],
			onToggleFullscreen: [],
			onZoom: [],
			onClick: [],
			onResize: [],
			onInteractionEnd: [],
			onInteractionStart: [],
		},
		api: {},
		register: (userRegistry: userRegistry) => {
			// push values into this.registry.extensions
			if (userRegistry.extensions) userRegistry.extensions.forEach(value => this.registry.extensions.push(value));
			if (userRegistry.hooks) {
				for (const hookKey in userRegistry.hooks) {
					if (!this.registry.hooks[hookKey]) this.registry.hooks[hookKey] = [];
					userRegistry.hooks[hookKey].forEach(value => this.registry.hooks[hookKey].push(value));
				}
			}
			if (userRegistry.api) deepMerge(this.registry.api, userRegistry.api);
			if (userRegistry.options) deepMerge(this.registry.options, userRegistry.options, true);
		},
	};

	constructor(container: HTMLElement, userRegistry?: registry) {
		if (userRegistry) this.registry.register(userRegistry);
		while (container.firstElementChild) container.firstElementChild.remove();
		container.innerHTML = '';

		const style = document.createElement('style');
		style.innerHTML = styles;
		let realContainer: HTMLElement | ShadowRoot;

		if (this.registry.options.main.noShadow) realContainer = container;
		else realContainer = container.attachShadow({ mode: 'open' });

		realContainer.appendChild(style);
		this.data.container.classList.add('container');
		realContainer.appendChild(this.data.container);

		this.dataManager = new dataManager(this.data, this.registry);
		this.registry.register({
			api: {
				main: {
					pan: this.dataManager.pan,
					zoom: this.dataManager.zoom,
					zoomToScale: this.dataManager.zoomToScale,
					shiftFullscreen: this.dataManager.shiftFullscreen,
					resetView: this.dataManager.resetView,
					findNodeAtMousePosition: this.dataManager.findNodeAtMousePosition,
					judgeInteract: this.dataManager.judgeInteract,
					middleScreen: this.dataManager.middleScreen,
				},
			},
		});
		this.resizeObserver = new ResizeObserver(this.onResize);
		for (const extension of this.registry.extensions) new extension(this.data, this.registry);
	}

	private draw = () => {
		if (this.perFrame.lastScale !== this.data.scale || this.perFrame.lastOffsets.x !== this.data.offsetX || this.perFrame.lastOffsets.y !== this.data.offsetY) this.refresh();
		this.animationId = requestAnimationFrame(this.draw);
	};

	private refresh = () => {
		this.perFrame.lastScale = this.data.scale;
		this.perFrame.lastOffsets = { x: this.data.offsetX, y: this.data.offsetY };
		for (const hook of this.registry.hooks.onRender) hook();
	};

	private onResize = () => {
		this.resizeAnimationId = requestAnimationFrame(() => {
			const center = this.dataManager.middleScreen();
			if (this.lastResizeCenter.x && this.lastResizeCenter.y) {
				this.data.offsetX += center.x - this.lastResizeCenter.x;
				this.data.offsetY += center.y - this.lastResizeCenter.y;
			}
			this.lastResizeCenter.x = center.x;
			this.lastResizeCenter.y = center.y;
			for (const hook of this.registry.hooks.onResize) hook(center.x * 2, center.y * 2);
			this.refresh();
		});
	};

	async loadCanvas(path: string) {
		await this.dataManager.loadCanvas(path);
		this.dataManager.resetView();
		for (const hook of this.registry.hooks.onLoaded) hook();
		this.resizeObserver.observe(this.data.container);
		this.animationId = requestAnimationFrame(this.draw);
	}

	dispose() {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		if (this.resizeAnimationId) cancelAnimationFrame(this.resizeAnimationId);
		this.resizeObserver.disconnect();
		for (const hook of this.registry.hooks.onDispose) hook();
		this.data.container.remove();
	}
}
