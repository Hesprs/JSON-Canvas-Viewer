import { destroyError, round } from '../../utilities';
import style from './styles.scss?inline'

export default class debugPanel {
    private _debugPanel: HTMLDivElement | null;
    private data: runtimeData;

    private get debugPanel() {
        if (!this._debugPanel) throw destroyError;
        return this._debugPanel;
    }

    constructor(data: runtimeData, registry: registry) {
        registry.register({
            hooks: {
                onRender: [this.update],
                onDispose: [this.dispose],
            },
            api: {
                debugPanel: {
                    update: this.update,
                },
            },
        });
        this._debugPanel = document.createElement('div');
        this._debugPanel.className = 'debug-panel';
        registry.api.dataManager.applyStyles(this._debugPanel, style);
        this.data = data;
        data.container.appendChild(this._debugPanel);
    }

    private update = () => {
        this.debugPanel.innerHTML = `
            <p>Scale: ${round(this.data.scale, 3)}</p>
            <p>Offset: ${round(this.data.offsetX, 1)}, ${round(this.data.offsetY, 1)}</p>
        `;
    };

    private dispose = () => {
        this.debugPanel.remove();
        this._debugPanel = null;
    };
}