// tree-renderer.js

export function parseNewick(newick) {
    // Basic Newick parser
    let ancestors = [];
    let tree = {};
    let tokens = newick.split(/\s*(;|\(|\)|,|:)\s*/);
    let subtree = tree;
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        switch (token) {
            case '(': // new branch
                let node = {};
                subtree.children = subtree.children || [];
                subtree.children.push(node);
                ancestors.push(subtree);
                subtree = node;
                break;
            case ',': // another branch
                let sibling = {};
                ancestors[ancestors.length - 1].children.push(sibling);
                subtree = sibling;
                break;
            case ')': // optional name next
                subtree = ancestors.pop();
                break;
            case ':': // optional length next
                break;
            default:
                let x = tokens[i - 1];
                if (x == ')' || x == '(' || x == ',') {
                    subtree.name = token;
                } else if (x == ':') {
                    subtree.length = parseFloat(token);
                }
        }
    }
    return tree;
}

export function renderSVGTree(containerId, treeData, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const config = {
        layout: 'rectangular',
        highlightSample: '',
        showBranchLengths: false,
        showSupport: false,
        ...options
    };
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 800 600');
    svg.style.fontFamily = 'sans-serif';
    
    // Very simplified tree rendering (placeholder for actual d3-like tree logic)
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute('x', '400');
    text.setAttribute('y', '300');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = `Tree Visualization: ${config.layout} layout`;
    
    // Add tooltip handling, zooming, panning etc here in a real implementation
    let isDown = false;
    let startX, startY;
    let viewBox = {x: 0, y: 0, w: 800, h: 600};
    
    svg.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.clientX;
        startY = e.clientY;
    });
    
    svg.addEventListener('mouseup', () => isDown = false);
    svg.addEventListener('mouseleave', () => isDown = false);
    
    svg.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        const dx = (startX - e.clientX) * (viewBox.w / svg.clientWidth);
        const dy = (startY - e.clientY) * (viewBox.h / svg.clientHeight);
        viewBox.x += dx;
        viewBox.y += dy;
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        startX = e.clientX;
        startY = e.clientY;
    });
    
    svg.appendChild(text);
    container.appendChild(svg);
    
    // Fit to view button logic could be implemented here as part of UI overlay
}

export function fitTreeToContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (svg) {
        svg.setAttribute('viewBox', '0 0 800 600');
    }
}
