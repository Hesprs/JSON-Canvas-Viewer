import { manifest, OmniUnit, Reactive } from 'omnikernel';
import { destroyError } from '@/shared';
import type { minimapArgs } from '../../omniTypes';
import style from './styles.scss?inline';

@manifest({
	name: 'minimap',
	dependsOn: ['dataManager', 'canvasViewer', 'renderer', 'overlayManager', 'utilities'],
})
export default class Minimap extends OmniUnit<minimapArgs> {
	private _minimapCtx: CanvasRenderingContext2D | null = null;
	private _viewportRectangle: HTMLDivElement | null = null;
	private _minimap: HTMLDivElement | null = null;
	private _minimapContainer: HTMLDivElement | null = null;
	private _toggleMinimapBtn: HTMLButtonElement | null = null;
	private minimapCache: { scale: number; centerX: number; centerY: number } = {
		scale: 1,
		centerX: 0,
		centerY: 0,
	};
	private dataManager: typeof this.deps.dataManager;
	private utilities: typeof this.deps.utilities;

	private get minimap() {
		if (this._minimap === null) throw destroyError;
		return this._minimap;
	}
	private get minimapCtx() {
		if (this._minimapCtx === null) throw destroyError;
		return this._minimapCtx;
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

	constructor(...args: minimapArgs) {
		super(...args);
		this.Kernel.register(
			{
				collapsed: new Reactive(false),
				toggleCollapse: this.toggleCollapseButton,
			},
			this.facade,
		);
		this.Kernel.register(
			{ onRefresh: { minimap: this.updateViewportRectangle } },
			this.deps.canvasViewer,
		);
		this.dataManager = this.deps.dataManager;
		this.utilities = this.deps.utilities;
		this.Kernel.register({ collapsed: { minimap: this.toggleCollapse } }, this.facade);
		this.Kernel.register({ hooks: { onCanvasFetched: { minimap: this.drawMinimap } } }, this.dataManager);

		this._minimapContainer = document.createElement('div');
		this._minimapContainer.className = 'minimap-container';

		this.utilities.applyStyles(this._minimapContainer, style);

		this._toggleMinimapBtn = document.createElement('button');
		this._toggleMinimapBtn.className = 'toggle-minimap collapse-button';
		this._toggleMinimapBtn.innerHTML =
			'<svg viewBox="-3.6 -3.6 31.2 31.2" stroke-width=".4"><path d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z" /></svg>';
		this._minimapContainer.appendChild(this._toggleMinimapBtn);

		this._minimap = document.createElement('div');
		this._minimap.className = 'minimap';
		const minimapCanvas = document.createElement('canvas');
		minimapCanvas.className = 'minimap-canvas';
		minimapCanvas.width = 200;
		minimapCanvas.height = 150;

		this._minimap.appendChild(minimapCanvas);
		this._minimapCtx = minimapCanvas.getContext('2d') as CanvasRenderingContext2D;
		this._viewportRectangle = document.createElement('div');
		this._viewportRectangle.className = 'viewport-rectangle';
		this._minimap.appendChild(this._viewportRectangle);
		this._minimapContainer.appendChild(this._minimap);

		this.dataManager.data.container().appendChild(this._minimapContainer);

		this._minimapContainer.classList.toggle('collapsed', this.facade.collapsed());

		this._toggleMinimapBtn.addEventListener('click', this.toggleCollapseButton);
		this.deps.utilities.resizeCanvasForDPR(minimapCanvas, minimapCanvas.width, minimapCanvas.height);
	}

	private toggleCollapseButton = () => {
		const state = !this.facade.collapsed();
		this.facade.collapsed(state);
	};

	private toggleCollapse = (newValue: boolean) => {
		this.minimapContainer.classList.toggle('collapsed', newValue);
		if (newValue) this.updateViewportRectangle();
	};

	private drawMinimap = () => {
		const bounds = this.dataManager.data.nodeBounds();
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
		const canvasData = this.dataManager.data.canvasData();
		for (const edge of canvasData.edges) this.drawMinimapEdge(edge);
		for (const node of canvasData.nodes) this.drawMinimapNode(node);
		this.minimapCtx.restore();
	};

	private drawMinimapNode = (node: JSONCanvasNode) => {
		const colors = this.utilities.getColor(node.color);
		const radius = 25;
		this.minimapCtx.fillStyle = colors.border;
		this.minimapCtx.globalAlpha = 0.3;
		this.utilities.drawRoundRect(this.minimapCtx, node.x, node.y, node.width, node.height, radius);
		this.minimapCtx.fill();
		this.minimapCtx.globalAlpha = 1.0;
	};

	private drawMinimapEdge = (edge: JSONCanvasEdge) => {
		const nodeMap = this.dataManager.data.nodeMap();
		const fromNode = nodeMap[edge.fromNode];
		const toNode = nodeMap[edge.toNode];
		if (!fromNode || !toNode) return;
		const [startX, startY] = this.utilities.getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = this.utilities.getAnchorCoord(toNode, edge.toSide);
		this.minimapCtx.beginPath();
		this.minimapCtx.moveTo(startX, startY);
		this.minimapCtx.lineTo(endX, endY);
		this.minimapCtx.strokeStyle = '#555';
		this.minimapCtx.lineWidth = 10;
		this.minimapCtx.stroke();
	};

	private updateViewportRectangle = () => {
		if (this.facade.collapsed()) return;
		const bounds = this.dataManager.data.nodeBounds();
		const container = this.dataManager.data.container();
		const scale = this.dataManager.data.scale();
		if (!bounds) return;
		const viewWidth = container.clientWidth / scale;
		const viewHeight = container.clientHeight / scale;
		const viewportCenterX =
			-this.dataManager.data.offsetX() / scale + container.clientWidth / (2 * scale);
		const viewportCenterY =
			-this.dataManager.data.offsetY() / scale + container.clientHeight / (2 * scale);
		const viewRectX =
			this.minimapCache.centerX +
			(viewportCenterX - viewWidth / 2 - bounds.centerX) * this.minimapCache.scale;
		const viewRectY =
			this.minimapCache.centerY +
			(viewportCenterY - viewHeight / 2 - bounds.centerY) * this.minimapCache.scale;
		const viewRectWidth = viewWidth * this.minimapCache.scale;
		const viewRectHeight = viewHeight * this.minimapCache.scale;
		this.viewportRectangle.style.left = `${viewRectX}px`;
		this.viewportRectangle.style.top = `${viewRectY}px`;
		this.viewportRectangle.style.width = `${viewRectWidth}px`;
		this.viewportRectangle.style.height = `${viewRectHeight}px`;
	};

	dispose = () => {
		this.toggleMinimapBtn.removeEventListener('click', this.toggleCollapseButton);
		this.minimapCtx.clearRect(0, 0, this.minimap.clientWidth, this.minimap.clientHeight);
		this.minimapContainer.remove();
		this._minimapContainer = null;
		this._toggleMinimapBtn = null;
		this._viewportRectangle = null;
		this._minimap = null;
	};
}
