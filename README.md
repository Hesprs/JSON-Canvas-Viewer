# Obsidian Canvas Web Renderer X

A **web-based** viewer for **Obsidian Canvas** files that allows you to view and interact with your canvas files directly in the browser. Using this tool, you can embed interactive canvas to your front-end projects with ease.

![App interface](https://img1.tucang.cc/api/image/show/747527d6db155d1301a38e96fb53439d)

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

1. Place your `.canvas` file and any related files in the data directory (default file should be named `default.canvas`)
2. Start a localhost at any port from the root directory (you can use tools like Live Server)
3. Visit your host
4. Click on a node to select and interact with it
5. Navigate the canvas using:
    - Drag to pan
    - Scroll to zoom
6. Use the control panel to:
    - Zoom in/out
    - Reset view
    - Toggle minimap

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
- **Zooming origin**: the canvas now zooms toward / backward the mouse pointer.
- **Selection**: a node is interactive only when "selected", working the same way as in Obsidian.
- **Smart dragging**: the app can distinguish whether you want to pan the canvas or select a node.
- **Better paths**: optimize the curved path stiffness logic.
- **Straightforward control**: the default behaviour of mouse wheel is zooming rather than vertical scrolling.
- **Simple aesthetics**: nodes now have round corners and labels can adjust their width based on their text and zoom with the canvas. Styles have been reconstructed for better aesthetics and supporting more markdown elements.
- **Mobile adaption**: enable panning & zooming using touch (experimental).
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
