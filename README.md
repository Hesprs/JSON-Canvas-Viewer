# Obsidian Canvas Viewer

[![npm](https://badgen.net/npm/v/obsidian-canvas-viewer)](https://www.npmjs.com/package/obsidian-canvas-viewer)
[![install size](https://badgen.net/packagephobia/install/obsidian-canvas-viewer)](https://packagephobia.now.sh/result?p=obsidian-canvas-viewer)
[![github commits](https://badgen.net/github/commits/hesprs/Obsidian-Canvas-Viewer?color=purple)](https://github.com/hesprs/Obsidian-Canvas-Viewer/commits/main)

![Canvas Viewer](example/preview.png)

A **JavaScript-based** viewer for **Obsidian Canvas** files. View and interact with your canvas files directly in the browser, or embed the viewer in your own front-end projects with ease. It is built without any web framework so it can be easily integrated into any framework.

This project is inspired by [sofanati-nour/obsidian-canvas-web-renderer](https://github.com/sofanati-nour/obsidian-canvas-web-renderer), but is far more developed and optimized.

For more about **Obsidian Canvas**, also known as **JSON Canvas**, please visit [jsoncanvas.org](https://jsoncanvas.org/).

## 📦 Installation

We recommend using `npm`, `pnpm` or any other favorable package managers to install the package. **Note: This package requires `marked` as dependency, your package manager will remind you to install it.**

```bash
# npm
npm install obsidian-canvas-viewer

# pnpm
pnpm add obsidian-canvas-viewer

# yarn
yarn add obsidian-canvas-viewer
```

If your project *doesn't use Node.js*, you can use the integrated version, which is built with `marked` and `obsidian-canvas-viewer` inlined, so it can be deployed in vanilla JavaScript projects. Find the integrated version in [Release page](https://github.com/hesprs/Obsidian-Canvas-Viewer/releases).

After installation, you can import the package as a module:

If you use Node.js, you can use the following import:

```js
import canvasViewer from 'obsidian-canvas-viewer';
```

Or you use the integrated version, import it as below:

```js
import canvasViewer from 'path/to/canvasViewer.inte.js';
```

## 🚀 Quick Start

As a custom element (a simple way to embed, already defined in the code):

```html
<obsidian-canvas 
    src="example/introduction.canvas"
    extensions="minimap mistouchPrevention"
    options="minimapCollapsed"
></obsidian-canvas>
```

Or instantiate the viewer (more flexible, but requires more code):

```html
<div id="myCanvasContainer" style="width:800px; height:600px;"></div>
<script>
    const viewer = new canvasViewer(
        document.getElementById('myCanvasContainer'), 
        ['minimap', 'mistouchPrevention'],
        ['minimapCollapsed']
    );
    viewer.loadCanvas('example/introduction.canvas');
    viewer.on('nodeInteract', (node, interactionType) => {
        // handle node interaction
    });
</script>
```

## 🐶 Features

- View Obsidian Canvas files (`.canvas`) in a web browser
- Full markdown syntax support (auto-parsed to HTML)
- Embed into front-end projects using a container element or custom element
- Interactive pan and zoom functionality
- Support for different node types:
    - Text nodes
    - File nodes (including Markdown files)
    - Link nodes (embedded web content)
    - Group nodes with custom colors
- Edge connections between nodes with labels
- Minimap for easy navigation (optional extension)
- Mistouch prevention (optional extension)
- Responsive design with mobile and touchpad adaption
- 🔥 **More performant** than rendering canvas in Obsidian!

## 🔌 API Reference

### Constructor

```js
new canvasViewer(container, extensions, options);
```

- `container`: HTMLElement where the viewer will be rendered
- `extensions`: (optional) Array (or space-separated string in case of custom element) of extension names to enable:
    - `minimap` - Adds navigation minimap
    - `mistouchPrevention` - Frozes canvas when clicking outside. **Warning: external navigation (like `zoomIn()` or `resetView()`) cannot take effect if the canvas is frozen**.
- `options`: (optional) Array (or space-separated string in case of custom element) of config options:
    - `minimapCollapsed` - Starts with minimap collapsed
    - `controlsHidden` - Hides the control panel
    - `controlsCollapsed` - Starts with controls collapsed
    - `proControlSchema` - Uses control keybindings in professional softwares (mouse wheel: scroll vertically; mouse wheel + shift: scroll horizontally; mouse wheel + ctrl: zoom), rather than mouse wheel to zoom. The canvas viewer automatically detect and adjust control schema by default, but you can explicitly configure it. This option doesn't affect mobile control.

### Methods

- `loadCanvas(path)` — Load a canvas file (by path), **please put all the related files (files embeded in the canvas) in the same folder as the canvas file, wherever they originally are**.
- `interact(id)` — Interact with a node (select or preview, set `null` to deselect)
- `on(event, callback)` — Listen for events (see below)
- `setScale(scale)` — Set zoom level to a specific value (number, 0.05–20)
- `toggleFullscreen(option = 'toggle')` — Toggle fullscreen mode ('toggle', 'enter', 'exit')
- `resetView()` — Reset pan/zoom to fit canvas content
- `zoomIn()` — Zoom in by a fixed step
- `zoomOut()` — Zoom out by a fixed step
- `panTo(x, y)` — Pan the view to a specific world coordinate
- `destroy()` — Clean up and remove viewer from DOM

### Events

Register with `viewer.on(event, callback)`.

- `nodeInteract` — Fired when a node is interacted with (`callback(node, interactionType)`)
    - `interactionType`: 'select' or 'preview'
- `canvasLoaded` — Fired when a canvas file is loaded (`callback(canvasData)`)
- `zoom` — Fired when zoom level changes (`callback(scale)`)
- `pan` — Fired when the view is panned (`callback({x, y})`)
- `resetView` — Fired when the view is reset (`callback()`)

## 📂 Canvas File Structure

The viewer expects Obsidian Canvas files in JSON format:

```json
{
    "nodes": [
        {
            "id": "unique-id",
            "type": "text|file|link|group",
            "x": 0,
            "y": 0,
            "width": 400,
            "height": 400,
            "text": "Content for text nodes",
            "file": "filename for file nodes",
            "url": "URL for link nodes",
            "color": "color-id for groups"
        }
    ],
    "edges": [
        {
            "id": "edge-id",
            "fromNode": "source-node-id",
            "toNode": "target-node-id",
            "fromSide": "top|bottom|left|right",
            "toSide": "top|bottom|left|right",
            "label": "Optional edge label"
        }
    ]
}
```

## 💻 Development

- Built with JavaScript and HTML5 Canvas
- Key files:
    - `src/canvasViewer.js`: Main class-based component
    - `example/index.html`: Example/demo entry point
    - `src/styles.scss`: Styles for the viewer

## 📝 Copyright & License

Copyright ©️ 2025 Hesprs (Hēsperus) | [MIT License](https://mit-license.org/)