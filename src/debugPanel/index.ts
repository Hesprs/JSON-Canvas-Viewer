import { manifest, OmniUnit } from 'omnikernel';
import { destroyError } from '@/shared';
import type { debugPanelArgs } from '../../omniTypes';
import style from './styles.scss?inline';

@manifest({
	name: 'debugPanel',
	dependsOn: ['canvasViewer', 'dataManager', 'utilities', 'renderer', 'overlayManager'],
})
export default class DebugPanel extends OmniUnit<debugPanelArgs> {
	private _debugPanel: HTMLDivElement | null = null;
	private dataManager: typeof this.deps.dataManager;

	private get debugPanel() {
		if (!this._debugPanel) throw destroyError;
		return this._debugPanel;
	}

	constructor(...args: debugPanelArgs) {
		super(...args);
		this.Kernel.register({ update: this.update }, this.facade);
		this.Kernel.register(
			{
				onRefresh: { debugPanel: this.update },
			},
			this.deps.canvasViewer,
		);
		this.dataManager = this.deps.dataManager;
		this._debugPanel = document.createElement('div');
		this._debugPanel.className = 'debug-panel';
		const container = this.dataManager.data.container();
		this.deps.utilities.applyStyles(container, style);
		container.appendChild(this._debugPanel);
	}

	private update = () => {
		const round = this.deps.utilities.round;
		this.debugPanel.innerHTML = `
            <p>Scale: ${round(this.dataManager.data.scale(), 3)}</p>
            <p>Offset: ${round(this.dataManager.data.offsetX(), 1)}, ${round(this.dataManager.data.offsetY(), 1)}</p>
        `;
	};

	dispose = () => {
		this.debugPanel.remove();
		this._debugPanel = null;
	};
}
