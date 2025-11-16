import { destroyError } from '../../shared';
import { api } from 'omnikernel';
import style from './styles.scss?inline';

export default class controls {
	private _controlsPanel: HTMLDivElement | null;
	private _toggleCollapseBtn: HTMLButtonElement | null;
	private _toggleFullscreenBtn: HTMLButtonElement | null;
	private _zoomOutBtn: HTMLButtonElement | null;
	private _zoomSlider: HTMLInputElement | null;
	private _zoomInBtn: HTMLButtonElement | null;
	private _resetViewBtn: HTMLButtonElement | null;
	private Kernel: Amoeba;

	private get controlsPanel() {
		if (this._controlsPanel === null) throw destroyError;
		return this._controlsPanel;
	}
	private get toggleCollapseBtn() {
		if (this._toggleCollapseBtn === null) throw destroyError;
		return this._toggleCollapseBtn;
	}
	private get toggleFullscreenBtn() {
		if (this._toggleFullscreenBtn === null) throw destroyError;
		return this._toggleFullscreenBtn;
	}
	private get zoomOutBtn() {
		if (this._zoomOutBtn === null) throw destroyError;
		return this._zoomOutBtn;
	}
	private get zoomSlider() {
		if (this._zoomSlider === null) throw destroyError;
		return this._zoomSlider;
	}
	private get zoomInBtn() {
		if (this._zoomInBtn === null) throw destroyError;
		return this._zoomInBtn;
	}
	private get resetViewBtn() {
		if (this._resetViewBtn === null) throw destroyError;
		return this._resetViewBtn;
	}

	constructor(Kernel: Amoeba) {
		Kernel._register({
			main: {
				hooks: {
					onToggleFullscreen: this.updateFullscreenBtn,
					onRefresh: this.updateSlider,
				},
			},
			controls: {
				toggleCollapse: api(this.toggleCollapse),
				collapsed: false,
			},
			dispose: this.dispose,
		});

		this._controlsPanel = document.createElement('div');
		this._controlsPanel.className = 'controls';
		this._controlsPanel.classList.toggle('collapsed', Kernel.controls.collapsed());

		Kernel.utilities.applyStyles(this._controlsPanel, style);

		this._toggleCollapseBtn = document.createElement('button');
		this._toggleCollapseBtn.className = 'collapse-button';
		this._toggleCollapseBtn.innerHTML = '<svg viewBox="-3.6 -3.6 31.2 31.2" stroke-width=".4"><path d="M15.707 4.293a1 1 0 0 1 0 1.414L9.414 12l6.293 6.293a1 1 0 0 1-1.414 1.414l-7-7a1 1 0 0 1 0-1.414l7-7a1 1 0 0 1 1.414 0Z" /></svg>';
		this._controlsPanel.appendChild(this._toggleCollapseBtn);

		const controlsContent = document.createElement('div');
		controlsContent.className = 'controls-content';

		this._toggleFullscreenBtn = document.createElement('button');
		this._toggleFullscreenBtn.innerHTML = `<svg viewBox="-5.28 -5.28 34.56 34.56" fill="none"><path d="M4 9V5.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C4.76 4 5.04 4 5.6 4H9M4 15v3.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C4.76 20 5.04 20 5.6 20H9m6-16h3.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C20 4.76 20 5.04 20 5.6V9m0 6v3.4c0 .56 0 .84-.109 1.054a1 1 0 0 1-.437.437C19.24 20 18.96 20 18.4 20H15" stroke-width="2.4" stroke-linecap="round"/></svg>`;
		controlsContent.appendChild(this._toggleFullscreenBtn);

		this._zoomOutBtn = document.createElement('button');
		this._zoomOutBtn.innerHTML = '<svg viewBox="-1.2 -1.2 26.4 26.4"><path d="M6 12h12" stroke-width="2" stroke-linecap="round" /></svg>';
		controlsContent.appendChild(this._zoomOutBtn);

		this._zoomSlider = document.createElement('input');
		this._zoomSlider.type = 'range';
		this._zoomSlider.className = 'zoom-slider';
		this._zoomSlider.min = '-30';
		this._zoomSlider.max = '30';
		this._zoomSlider.value = '0';
		controlsContent.appendChild(this._zoomSlider);

		this._zoomInBtn = document.createElement('button');
		this._zoomInBtn.innerHTML = '<svg viewBox="-1.2 -1.2 26.4 26.4"><path d="M6 12h12m-6-6v12" stroke-width="2" stroke-linecap="round" /></svg>';
		controlsContent.appendChild(this._zoomInBtn);

		this._resetViewBtn = document.createElement('button');
		this._resetViewBtn.innerHTML = '<svg viewBox="-6 -6 30 30" stroke-width=".08"><path d="m14.955 7.986.116.01a1 1 0 0 1 .85 1.13 8 8 0 0 1-13.374 4.728l-.84.84c-.63.63-1.707.184-1.707-.707V10h3.987c.89 0 1.337 1.077.707 1.707l-.731.731a6 6 0 0 0 8.347-.264 6 6 0 0 0 1.63-3.33 1 1 0 0 1 1.131-.848zM11.514.813a8 8 0 0 1 1.942 1.336l.837-.837c.63-.63 1.707-.184 1.707.707V6h-3.981c-.89 0-1.337-1.077-.707-1.707l.728-.729a6 6 0 0 0-9.98 3.591 1 1 0 1 1-1.98-.281A8 8 0 0 1 11.514.813Z" /></svg>';
		controlsContent.appendChild(this._resetViewBtn);

		this._controlsPanel.appendChild(controlsContent);

		Kernel.data.container().appendChild(this._controlsPanel);

		this.Kernel = Kernel;

		this._toggleCollapseBtn.addEventListener('click', this.toggleCollapse);
		this._zoomInBtn.addEventListener('click', this.zoomIn);
		this._zoomOutBtn.addEventListener('click', this.zoomOut);
		this._zoomSlider.addEventListener('input', this.slide);
		this._resetViewBtn.addEventListener('click', Kernel.main.api.resetView);
		this._toggleFullscreenBtn.addEventListener('click', this.toggleFullscreen);
	}

	private toggleCollapse = () => this.controlsPanel.classList.toggle('collapsed');
	private zoomIn = () => this.Kernel.main.api.zoom(1.1, this.Kernel.utilities.middleViewer());
	private zoomOut = () => this.Kernel.main.api.zoom(1 / 1.1, this.Kernel.utilities.middleViewer());
	private slide = () => this.Kernel.main.api.zoomToScale(Math.pow(1.1, Number(this.zoomSlider.value)), this.Kernel.utilities.middleViewer());

	private updateFullscreenBtn = () => {
		if (document.fullscreenElement === null) this.toggleFullscreenBtn.innerHTML = `<svg viewBox="-40.32 -40.32 176.64 176.64"><path d="M30 60H6a6 6 0 0 0 0 12h18v18a6 6 0 0 0 12 0V66a5.997 5.997 0 0 0-6-6Zm60 0H66a5.997 5.997 0 0 0-6 6v24a6 6 0 0 0 12 0V72h18a6 6 0 0 0 0-12ZM66 36h24a6 6 0 0 0 0-12H72V6a6 6 0 0 0-12 0v24a5.997 5.997 0 0 0 6 6ZM30 0a5.997 5.997 0 0 0-6 6v18H6a6 6 0 0 0 0 12h24a5.997 5.997 0 0 0 6-6V6a5.997 5.997 0 0 0-6-6Z"/></svg>`;
		else this.toggleFullscreenBtn.innerHTML = `<svg viewBox="-5.28 -5.28 34.56 34.56" fill="none"><path d="M4 9V5.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C4.76 4 5.04 4 5.6 4H9M4 15v3.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C4.76 20 5.04 20 5.6 20H9m6-16h3.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C20 4.76 20 5.04 20 5.6V9m0 6v3.4c0 .56 0 .84-.109 1.054a1 1 0 0 1-.437.437C19.24 20 18.96 20 18.4 20H15" stroke-width="2.4" stroke-linecap="round"/></svg>`;
	}
	private toggleFullscreen = () => this.Kernel.main.api.shiftFullscreen('toggle');

	private updateSlider = () => (this.zoomSlider.value = String(this.scaleToSlider(this.Kernel.data.scale())));
	private scaleToSlider = (scale: number) => Math.log(scale) / Math.log(1.1);

	private dispose = () => {
		this.toggleCollapseBtn.removeEventListener('click', this.toggleCollapse);
		this.zoomInBtn.removeEventListener('click', this.zoomIn);
		this.zoomOutBtn.removeEventListener('click', this.zoomOut);
		this.zoomSlider.removeEventListener('input', this.slide);
		this.resetViewBtn.removeEventListener('click', this.Kernel.main.api.resetView);
		this.toggleFullscreenBtn.removeEventListener('click', this.Kernel.main.api.shiftFullscreen);
		this.controlsPanel.remove();
		this._controlsPanel = null;
		this._toggleCollapseBtn = null;
		this._zoomInBtn = null;
		this._zoomOutBtn = null;
		this._zoomSlider = null;
		this._resetViewBtn = null;
		this._toggleFullscreenBtn = null;
	};
}
