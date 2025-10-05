import { unexpectedError } from './utilities';

const GRID_CELL_SIZE = 800;
const INITIAL_VIEWPORT_PADDING = 100;
const RESISTANCE = 40;

export default class dataManager {
	data: runtimeData;
	registry: registry;
	spatialGrid: Record<string, Array<JSONCanvasNode>> | null = null;
	acceleration: {
		pan: {
			x: number;
			y: number;
		};
		zoom: number;
	} = {
		pan: { x: 0, y: 0 },
		zoom: 0,
	};
	animationId: number | null = null;

	constructor(data: runtimeData, registry: registry) {
		registry.register({
			api: {
				main: {
					pan: this.pan,
					zoom: this.zoom,
					zoomToScale: this.zoomToScale,
					panToCoords: this.panToCoords,
					shiftFullscreen: this.shiftFullscreen,
					resetView: this.resetView,
				},
				dataManager: {
					middleViewer: this.middleViewer,
					findNodeAtMousePosition: this.findNodeAtMousePosition,
				},
			},
			hooks: {
				onLoad: [async (path: string) => await this.loadCanvas(path)],
				onDispose: [this.dispose],
			},
		});
		this.data = data;
		this.registry = registry;
	}
	loadCanvas = async (path: string) => {
		try {
			if (/^https?:\/\//.test(path)) this.data.canvasBaseDir = path.substring(0, path.lastIndexOf('/') + 1);
			else {
				const lastSlash = path.lastIndexOf('/');
				this.data.canvasBaseDir = lastSlash !== -1 ? path.substring(0, lastSlash + 1) : './';
			}
			this.data.canvasData = await fetch(path).then(res => res.json());
			this.data.canvasData.nodes.forEach((node: JSONCanvasNode) => {
				if (node.type === 'file' && node.file && !node.file.includes('http')) {
					const file = node.file.split('/');
					node.file = file[file.length - 1];
				}
				this.data.nodeMap[node.id] = node;
			});
			this.data.nodeBounds = this.calculateNodeBounds();
			this.buildSpatialGrid();
		} catch (err) {
			console.error('Failed to load canvas data:', err);
		}
	};

	private findNodeAtMousePosition = ({ x: mouseX, y: mouseY }: Coordinates) => {
		const { x, y } = this.C2W(this.C2C({ x: mouseX, y: mouseY }));
		let candidates: Array<JSONCanvasNode> = [];
		if (!this.spatialGrid) candidates = this.data.canvasData.nodes;
		else {
			const col = Math.floor(x / GRID_CELL_SIZE);
			const row = Math.floor(y / GRID_CELL_SIZE);
			const key = `${col},${row}`;
			candidates = this.spatialGrid[key] || [];
		}
		for (const node of candidates) {
			if (x < node.x || x > node.x + node.width || y < node.y || y > node.y + node.height || this.judgeInteract(node) === 'non-interactive') continue;
			return node;
		}
		return null;
	};

	// how should the app handle node interactions
	private judgeInteract = (node: JSONCanvasNode | null) => {
		const type = !node ? 'default' : node.type;
		switch (type) {
			case 'text':
			case 'link':
				return 'select';
			case 'file': {
				const file = node?.file;
				if (!file) throw unexpectedError;
				if (file.match(/\.(md|wav|mp3)$/i)) return 'select';
				else return 'non-interactive';
			}
			default:
				return 'non-interactive';
		}
	};

	private calculateNodeBounds() {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		this.data.canvasData.nodes.forEach(node => {
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

	private buildSpatialGrid() {
		if (this.data.canvasData.nodes.length < 50) return;
		this.spatialGrid = {};
		for (const node of this.data.canvasData.nodes) {
			const minCol = Math.floor(node.x / GRID_CELL_SIZE);
			const maxCol = Math.floor((node.x + node.width) / GRID_CELL_SIZE);
			const minRow = Math.floor(node.y / GRID_CELL_SIZE);
			const maxRow = Math.floor((node.y + node.height) / GRID_CELL_SIZE);
			for (let col = minCol; col <= maxCol; col++) {
				for (let row = minRow; row <= maxRow; row++) {
					const key = `${col},${row}`;
					if (!this.spatialGrid[key]) this.spatialGrid[key] = [];
					this.spatialGrid[key].push(node);
				}
			}
		}
	}

	private zoom = (factor: number, origin: Coordinates) => {
		const newScale = this.data.scale * factor;
		this.zoomToScale(newScale, origin);
	};
	private zoomToScale = (newScale: number, origin: Coordinates) => {
		const validNewScale = Math.max(Math.min(newScale, 20), 0.05);
		if (validNewScale === this.data.scale) return;
		const canvasCoords = this.C2C(origin);
		this.data.offsetX = origin.x - (canvasCoords.x * validNewScale) / this.data.scale;
		this.data.offsetY = origin.y - (canvasCoords.y * validNewScale) / this.data.scale;
		this.data.scale = validNewScale;
		for (const hook of this.registry.hooks.onZoom) hook(validNewScale);
	};
	private pan = ({ x, y }: Coordinates) => {
		this.data.offsetX += x;
		this.data.offsetY += y;
	};
	private panToCoords = ({ x, y }: Coordinates) => {
		this.data.offsetX = x;
		this.data.offsetY = y;
	};
	private shiftFullscreen = (option: string = 'toggle') => {
		if (!document.fullscreenElement && (option === 'toggle' || option === 'enter')) this.data.container.requestFullscreen();
		else if (document.fullscreenElement && (option === 'toggle' || option === 'exit')) document.exitFullscreen();
		for (const hook of this.registry.hooks.onToggleFullscreen) hook();
	};
	private resetView = () => {
		const bounds = this.data.nodeBounds;
		if (!bounds || !this.data.container) return;
		const contentWidth = bounds.width + INITIAL_VIEWPORT_PADDING * 2;
		const contentHeight = bounds.height + INITIAL_VIEWPORT_PADDING * 2;
		// Use logical dimensions for scaling calculations
		const viewWidth = this.data.container.clientWidth;
		const viewHeight = this.data.container.clientHeight;
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
		this.data.offsetX = initialView.offsetX;
		this.data.offsetY = initialView.offsetY;
		this.data.scale = initialView.scale;
	};

	// Container to Canvas
	private C2C = ({ x: containerX, y: containerY }: Coordinates) => ({
		x: containerX - this.data.offsetX,
		y: containerY - this.data.offsetY,
	});
	// Canvas to World
	private C2W = ({ x: canvasX, y: canvasY }: Coordinates) => ({
		x: canvasX / this.data.scale,
		y: canvasY / this.data.scale,
	});

	private middleViewer = () => {
		return {
			x: this.data.container.clientWidth / 2,
			y: this.data.container.clientHeight / 2,
			width: this.data.container.clientWidth,
			height: this.data.container.clientHeight,
		};
	};

	private animator = () => {
		if (this.acceleration.pan.x !== 0 || this.acceleration.pan.y !== 0 || this.acceleration.zoom !== 0) {
			this.data.offsetX += this.acceleration.pan.x;
			this.data.offsetY += this.acceleration.pan.y;
			this.data.scale *= this.acceleration.zoom;
			if (this.acceleration.pan.x >= RESISTANCE) this.acceleration.pan.x -= RESISTANCE;
			else this.acceleration.pan.x = 0;
			if (this.acceleration.pan.y >= RESISTANCE) this.acceleration.pan.y -= RESISTANCE;
			else this.acceleration.pan.y = 0;
			if (this.acceleration.zoom >= RESISTANCE) this.acceleration.zoom -= RESISTANCE;
			else this.acceleration.zoom = 1;
		}
		this.animationId = requestAnimationFrame(this.animator);
	};

	private dispose = () => {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.animationId = null;
	};
}
