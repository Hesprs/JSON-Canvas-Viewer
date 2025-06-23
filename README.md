# Obsidian Canvas Web Renderer X Version 1.1.1

A **web-based** viewer for **Obsidian Canvas** files that allows you to view and interact with your canvas files directly in the browser. Using this tool, you can embed interactive canvas to your front-end projects with ease.

![App interface](https://img1.tucang.cc/api/image/show/72e975b6d6cbd6436300b3d86fe26f91)

This project is modified from [sofanati-nour/obsidian-canvas-web-renderer](https://github.com/sofanati-nour/obsidian-canvas-web-renderer), which is insightful, containing proficient expertise but also buggy and unable to use directly. So this project comes with supercharging, making it possible to be put into practical uses. All-round enhances were applied and more than 80% of the code is modified or added.

| Titles                   | Information                                     |
| ------------------------ | ----------------------------------------------- |
| Technology stack         | HTML Canvas, Vanilla JavaScript                 |
| Open-source project used | Marked.js, Obsidian Canvas Web Renderer         |
| Major Enhancements       | Experience & Bug fix & Performance & Aesthetics |
| License                  | MIT License                                     |

## 🐶 Features

View Obsidian Canvas files (`.canvas`, go to [JSON Canvas](https://jsoncanvas.org/) for more) in a web browser.
- Full markdown syntax support and auto parsed to HTML
- Embed into front-end projects using `iframe`
- Interactive pan and zoom functionality
- Support for different node types:
    - Text nodes
    - File nodes (including Markdown files)
    - Link nodes (embedded web content)
    - Group nodes with custom colors
- Edge connections between nodes with labels
- Minimap for easy navigation
- Responsive design and mobile adaption (unable to zoom using two fingers on mobile devices since it's always intercepted by browser default zooming)
- 🔥**Much more performant** than rendering canvas in Obsidian!

## 🔦 Usage

1. Start a localhost at any port from the root directory (you can use tools like Live Server)
2. Visit your host through URL with parameter (optional), or you can embed it in an `iframe` in your own project and access it through file path of the `index.html` + parameter (optional)
    - The parameter is the relative path pointing to the `.canvas` file, so the URL should be like `http://localhost:5500/?path=example/introduction.canvas` or the `src` of your `iframe` should be like `/path/to/modules/Obsidian-Canvas-Web-Renderer-X/index.html?path=/path/to/canvas/your.canvas`, you should put all the related files in the same directory as the `.canvas` file.
    - If there's no parameter, the application will open the example canvas (`introduction.canvas`).
    - Or you can simply put your `.canvas` file with related files in the `example` directory and name it as `introduction.canvas`.
3. Click on a node to select and interact with it
4. Navigate the canvas using:
    - Drag to pan
    - Scroll to zoom
5. Use the control panel to:
    - Zoom in/out
    - Reset view
    - Toggle minimap
    - Toggle fullscreen

## 🪛 Enhancements & Fixes

Improvements compared with [sofanati-nour/obsidian-canvas-web-renderer](https://github.com/sofanati-nour/obsidian-canvas-web-renderer):

**Fixes**:
- **UI fix**: the control panel is now positioned correctly.
- **Movement Synchronization**: there's no weird delay when the link nodes move with the canvas.
- **Text node spacing**: texts in text nodes don't overflow out of the nodes now.
- **Mistouching prevention**: you don't need to care about your mouse / finger selects text or opens an image when you intend to pan the canvas; or the canvas still follows your pointer which has left the window.
- **Zoom slider fix**: the slider is positioned to match the correct scale when opening a canvas.

**Enhancements**:
- **Full markdown syntax support**: use marked.js to parse all the markdown-related text to enable tables, images, titles, codes, dividing lines and videos to be displayed in markdown & text nodes.
- **Supercharged text nodes**: use the overlay DOM to render all text nodes, which improves reactivity and resolution, and fixes crucial bugs.
- **Overlay Isolation**: Isolating the DOM overlay with mouse / touch events enables you to drag & zoom anywhere on the canvas, providing convenient & continuous experience.
- **Custom file path (experimental)**: allow custom `.canvas` path asigned by URL parameter.
- **Fullscreen support**: there's now a fullscreen button in the control panel.
- **Zooming origin**: the canvas now zooms toward / backward the mouse pointer.
- **Selection**: a node is interactive only when "selected", working the same way as in Obsidian.
- **Smart dragging**: the app can distinguish whether you want to pan the canvas or select a node.
- **Better paths**: optimize the curved path stiffness logic.
- **Straightforward control**: the default behaviour of mouse wheel is zooming rather than vertical scrolling.
- **Simple aesthetics**: nodes now have round corners and labels can adjust their width based on their text and zoom with the canvas. Styles have been reconstructed for better aesthetics and supporting more markdown elements.
- **Mobile adaption (experimental)**: enable panning & zooming using touch.
- **Super robustness**: the application won't collapse if there's missing file.
- **Refactor**: Large refactor & reconstruction for reusability and readability.
- **Various performance improvements**:
    - Throttling
    - Spatial grid for canvas more than 200 nodes
    - Updating minimap based on hash change
    - Integrated DOM overlay zooming & panning
    - Remove DOM overlay node from DOM when out of the viewport
    - Image & markdown file lazy load

## 📂 Canvas File Structure

The viewer expects Obsidian Canvas files in JSON format with the following structure:

``` JSON
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

The project is built with vanilla JavaScript and HTML5 Canvas. Key files:
- `index.html`: Main entry point
- `styles.css`: Styles for render canvas on web
- `app.js`: Core application logic
- `colors.js`: Color configuration for nodes and groups
