import { destroyError } from '../../shared';
import { api } from 'omnikernel';
import style from './styles.scss?inline';

export default class debugPanel {
	private _debugPanel: HTMLDivElement | null;
	Kernel: Amoeba;

	private get debugPanel() {
		if (!this._debugPanel) throw destroyError;
		return this._debugPanel;
	}

	constructor(Kernel: Amoeba) {
		Kernel._register({
			main: {
				hooks: {
					onRefresh: this.update,
				},
			},
			debugPanel: {
				update: api(this.update),
			},
			dispose: this.dispose,
		});
		this._debugPanel = document.createElement('div');
		this._debugPanel.className = 'debug-panel';
		const container = Kernel.data.container();
		Kernel.utilities.applyStyles(container, style);
		container.appendChild(this._debugPanel);
		this.Kernel = Kernel;
	}

	private update = () => {
		const round = this.Kernel.utilities.round;
		this.debugPanel.innerHTML = `
            <p>Scale: ${round(this.Kernel.data.scale(), 3)}</p>
            <p>Offset: ${round(this.Kernel.data.offsetX(), 1)}, ${round(this.Kernel.data.offsetY(), 1)}</p>
        `;
	};

	private dispose = () => {
		this.debugPanel.remove();
		this._debugPanel = null;
	};
}
