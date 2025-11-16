import style from './styles.scss?inline';
import { hook, api } from 'omnikernel';

export default class Core {
	private animationId: null | number = null;
	private resizeAnimationId: null | number = null;
	private Kernel;
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

	constructor(Kernel: Amoeba) {
		Kernel._register({
			data: {
				container: document.createElement('div'),
			},
			main: {
				options: {
					noShadow: false,
				},
				api: {
					refresh: api(this.refresh),
				},
				hooks: {
					onRefresh: hook(),
					onResize: hook(),
					onLoaded: this.onLoaded,
				},
			},
			dispose: this.dispose,
		});
		this.Kernel = Kernel;

		const parentContainer = Kernel.container();
		while (parentContainer.firstElementChild) parentContainer.firstElementChild.remove();
		parentContainer.innerHTML = '';

		const realContainer = Kernel.main.options.noShadow() ? parentContainer : parentContainer.attachShadow({ mode: 'open' });

		Kernel.utilities.applyStyles(realContainer, style);

		const container = Kernel.data.container();
		container.classList.add('container');
		realContainer.appendChild(container);
	};

	private onLoaded = () => {
		this.Kernel.main.api.resetView();
		this.resizeObserver.observe(this.Kernel.data.container());
		this.animationId = requestAnimationFrame(this.draw);
	}

	private draw = () => {
		if (this.perFrame.lastScale !== this.Kernel.data.scale() || this.perFrame.lastOffsets.x !== this.Kernel.data.offsetX() || this.perFrame.lastOffsets.y !== this.Kernel.data.offsetY()) this.refresh();
		this.animationId = requestAnimationFrame(this.draw);
	};

	private refresh = () => {
		this.perFrame.lastScale = this.Kernel.data.scale();
		this.perFrame.lastOffsets = { x: this.Kernel.data.offsetX(), y: this.Kernel.data.offsetY() };
		this.Kernel.main.hooks.onRefresh();
	};

	private onResize = () => {
		this.resizeAnimationId = requestAnimationFrame(() => {
			const center = this.Kernel.utilities.middleViewer();
			if (this.lastResizeCenter.x && this.lastResizeCenter.y) {
				this.Kernel.data.offsetX(this.Kernel.data.offsetX() + center.x - this.lastResizeCenter.x);
				this.Kernel.data.offsetY(this.Kernel.data.offsetY() + center.y - this.lastResizeCenter.y);
			}
			this.lastResizeCenter.x = center.x;
			this.lastResizeCenter.y = center.y;
			this.Kernel.main.hooks.onResize(center.width, center.height);
			this.refresh();
		});
	};
	private resizeObserver: ResizeObserver = new ResizeObserver(this.onResize);

	dispose() {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		if (this.resizeAnimationId) cancelAnimationFrame(this.resizeAnimationId);
		this.resizeObserver.disconnect();
		this.Kernel.data.container().remove();
	}
}
