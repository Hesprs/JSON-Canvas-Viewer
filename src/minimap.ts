import { getColor, drawRoundRect, getAnchorCoord, destroyError, resizeCanvasForDPR } from './renderer';

export default class minimap extends EventTarget {
	private _minimapCtx: CanvasRenderingContext2D | null;
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
	private _viewportRectangle: HTMLDivElement | null;
	private _minimap: HTMLDivElement | null;
	private _container: HTMLElement | null;
	private _minimapContainer: HTMLDivElement | null;
	private _toggleMinimapBtn: HTMLButtonElement | null;
	private isMinimapVisible: boolean;
	private minimapCache: { scale: number; centerX: number; centerY: number };

	private get minimapCtx() {
		if (this._minimapCtx === null) throw destroyError;
		return this._minimapCtx;
	}
	private get canvasData() {
		if (this._canvasData === null) throw destroyError;
		return this._canvasData;
	}
	private get container() {
		if (this._container === null) throw destroyError;
		return this._container;
	}
	private get minimap() {
		if (this._minimap === null) throw destroyError;
		return this._minimap;
	}
	private get nodeBounds() {
		if (this._nodeBounds === null) throw destroyError;
		return this._nodeBounds;
	}
	private get nodeMap() {
		if (this._nodeMap === null) throw destroyError;
		return this._nodeMap;
	}
	private get viewportRectangle() {
		if (this._viewportRectangle === null) throw destroyError;
		return this._viewportRectangle;
	}
	private get minimapContainer() {
		if (this._minimapContainer === null) throw destroyError;
		return this._minimapContainer;
	}
	private get toggleMinimapBtn() {
		if (this._toggleMinimapBtn === null) throw destroyError;
		return this._toggleMinimapBtn;
	}

	constructor(container: HTMLElement, minimapCollapsed: boolean = false) {
		super();
		this._minimapContainer = document.createElement('div');
		this._minimapContainer.className = 'minimap-container';

		this._toggleMinimapBtn = document.createElement('button');
		this._toggleMinimapBtn.className = 'toggle-minimap collapse-button';
		this._toggleMinimapBtn.innerHTML = '<svg viewBox="-3.6 -3.6 31.2 31.2" stroke-width=".4"><path d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z" /></svg>';
		this._minimapContainer.appendChild(this._toggleMinimapBtn);

		this._minimap = document.createElement('div');
		this._minimap.className = 'minimap';
		const minimapCanvas = document.createElement('canvas');
		minimapCanvas.className = 'minimap-canvas';
		minimapCanvas.width = 200;
		minimapCanvas.height = 150;

		this._minimap.appendChild(minimapCanvas);
		this._minimapCtx = minimapCanvas.getContext('2d');
		this._viewportRectangle = document.createElement('div');
		this._viewportRectangle.className = 'viewport-rectangle';
		this._minimap.appendChild(this._viewportRectangle);
		this._minimapContainer.appendChild(this._minimap);

		container.appendChild(this._minimapContainer);
		this._container = container;

		this.isMinimapVisible = !minimapCollapsed;
		this._minimapContainer.classList.toggle('collapsed', minimapCollapsed);
		this.minimapCache = {
			scale: 1,
			centerX: 0,
			centerY: 0,
		};
		this._toggleMinimapBtn.addEventListener('click', this.toggleVisisbility);

		resizeCanvasForDPR(minimapCanvas, minimapCanvas.width, minimapCanvas.height);
	}

	receiveData(nodeBounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; centerX: number; centerY: number }, canvasData: JSONCanvas, nodeMap: Record<string, JSONCanvasNode>) {
		this._nodeBounds = nodeBounds;
		this._canvasData = canvasData;
		this._nodeMap = nodeMap;
		this.drawMinimap();
	}

	private toggleVisisbility = () => {
		this.isMinimapVisible = !this.isMinimapVisible;
		this.minimapContainer.classList.toggle('collapsed');
		this.dispatchEvent(new CustomEvent<string>(this.isMinimapVisible ? 'minimapExpanded' : 'minimapCollapsed'));
	};

	private drawMinimap() {
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

	private drawMinimapNode(node: JSONCanvasNode) {
		const colors = getColor(node.color);
		const radius = 25;
		this.minimapCtx.fillStyle = colors.border;
		this.minimapCtx.globalAlpha = 0.3;
		drawRoundRect(this.minimapCtx, node.x, node.y, node.width, node.height, radius);
		this.minimapCtx.fill();
		this.minimapCtx.globalAlpha = 1.0;
	}

	private drawMinimapEdge(edge: JSONCanvasEdge) {
		const fromNode = this.nodeMap[edge.fromNode];
		const toNode = this.nodeMap[edge.toNode];
		if (!fromNode || !toNode) return;
		const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
		this.minimapCtx.beginPath();
		this.minimapCtx.moveTo(startX, startY);
		this.minimapCtx.lineTo(endX, endY);
		this.minimapCtx.strokeStyle = '#555';
		this.minimapCtx.lineWidth = 10;
		this.minimapCtx.stroke();
	}

	updateViewportRectangle(offsetX: number, offsetY: number, scale: number) {
		if (!this.isMinimapVisible) return;
		const bounds = this.nodeBounds;
		if (!bounds) return;
		const viewWidth = this.container.clientWidth / scale;
		const viewHeight = this.container.clientHeight / scale;
		const viewportCenterX = -offsetX / scale + this.container.clientWidth / (2 * scale);
		const viewportCenterY = -offsetY / scale + this.container.clientHeight / (2 * scale);
		const viewRectX = this.minimapCache.centerX + (viewportCenterX - viewWidth / 2 - bounds.centerX) * this.minimapCache.scale;
		const viewRectY = this.minimapCache.centerY + (viewportCenterY - viewHeight / 2 - bounds.centerY) * this.minimapCache.scale;
		const viewRectWidth = viewWidth * this.minimapCache.scale;
		const viewRectHeight = viewHeight * this.minimapCache.scale;
		this.viewportRectangle.style.left = viewRectX + 'px';
		this.viewportRectangle.style.top = viewRectY + 'px';
		this.viewportRectangle.style.width = viewRectWidth + 'px';
		this.viewportRectangle.style.height = viewRectHeight + 'px';
	}

	dispose() {
		this.toggleMinimapBtn.removeEventListener('click', this.toggleVisisbility);
		this.minimapCtx.clearRect(0, 0, this.minimap.clientWidth, this.minimap.clientHeight);
		this.minimapContainer.remove();
		this._minimapContainer = null;
		this._minimapCtx = null;
		this._toggleMinimapBtn = null;
		this._canvasData = null;
		this._container = null;
		this._nodeMap = null;
		this._nodeBounds = null;
		this._viewportRectangle = null;
		this._minimap = null;
	}
}
