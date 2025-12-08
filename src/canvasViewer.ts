import { FacadeUnit, Hook, manifest } from 'omnikernel';
import type { Coordinates } from '@/declarations';
import style from './styles.scss?inline';

@manifest({
	name: 'canvasViewer',
	dependsOn: ['dataManager', 'utilities', 'options'],
})
export default class CanvasViewer extends FacadeUnit {
	private animationId: null | number = null;
	private resizeAnimationId: null | number = null;
	private utilities: Facade;
	private dataManager: Facade;
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

	constructor(...args: UnitArgs) {
		super(...args);
		this.Kernel.register(
			{
				refresh: this.refresh,
				onRefresh: new Hook(),
				onResize: new Hook(),
			},
			this.facade,
		);
		this.dataManager = this.deps.dataManager;
		this.utilities = this.deps.utilities;
		this.Kernel.register(
			{
				hooks: {
					onCanvasFetched: { renderer: this.onFetched },
				},
			},
			this.dataManager,
		);
		const options = this.deps.options;
		this.Kernel.register({ options: { noShadow: false } }, options);

		const parentContainer = options.container() as HTMLElement;
		while (parentContainer.firstElementChild) parentContainer.firstElementChild.remove();
		parentContainer.innerHTML = '';

		const realContainer = options.options.noShadow()
			? parentContainer
			: parentContainer.attachShadow({ mode: 'open' });

		this.utilities.applyStyles(realContainer, style);

		const container = this.dataManager.data.container() as HTMLDivElement;
		container.classList.add('container');
		realContainer.appendChild(container);
	}

	private onFetched = () => {
		this.dataManager.api.resetView();
		this.resizeObserver.observe(this.dataManager.data.container() as HTMLDivElement);
		this.animationId = requestAnimationFrame(this.draw);
	};

	private draw = () => {
		if (
			this.perFrame.lastScale !== this.dataManager.data.scale() ||
			this.perFrame.lastOffsets.x !== this.dataManager.data.offsetX() ||
			this.perFrame.lastOffsets.y !== this.dataManager.data.offsetY()
		)
			this.refresh();
		this.animationId = requestAnimationFrame(this.draw);
	};

	private refresh = () => {
		this.perFrame.lastScale = this.dataManager.data.scale() as number;
		this.perFrame.lastOffsets = {
			x: this.dataManager.data.offsetX(),
			y: this.dataManager.data.offsetY(),
		} as Coordinates;
		this.facade.onRefresh();
	};

	private onResize = () => {
		this.resizeAnimationId = requestAnimationFrame(() => {
			const center = this.dataManager.utilities.middleViewer() as Coordinates & {
				width: number;
				height: number;
			};
			if (this.lastResizeCenter.x && this.lastResizeCenter.y) {
				this.dataManager.data.offsetX(
					(this.dataManager.data.offsetX() as number) + center.x - this.lastResizeCenter.x,
				);
				this.dataManager.data.offsetY(
					(this.dataManager.data.offsetY() as number) + center.y - this.lastResizeCenter.y,
				);
			}
			this.lastResizeCenter.x = center.x;
			this.lastResizeCenter.y = center.y;
			this.facade.onResize(center.width, center.height);
			this.refresh();
		});
	};
	private resizeObserver: ResizeObserver = new ResizeObserver(this.onResize);

	dispose = () => {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		if (this.resizeAnimationId) cancelAnimationFrame(this.resizeAnimationId);
		this.resizeObserver.disconnect();
		(this.dataManager.data.container() as HTMLDivElement).remove();
		while ((this.deps.options.container() as HTMLElement).firstChild)
			(this.deps.options.container() as HTMLElement).firstChild?.remove();
	};
}
