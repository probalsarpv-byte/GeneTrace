// tree-viewer.js

export function renderSVGTree(containerId, newickTree, highlightQueryName = null) {
    const container = document.getElementById(containerId);
    if (!container || !newickTree) return;

    // A very basic rectangular cladogram layout
    let leafNodes = [];
    
    // Pass 1: find leaves to determine height
    function traverse(node, depth) {
        node.depth = depth;
        if (!node.children || node.children.length === 0) {
            leafNodes.push(node);
        } else {
            node.children.forEach(child => traverse(child, depth + 1));
        }
    }
    
    traverse(newickTree.children[0] || newickTree, 0); // skip phantom root if necessary
    
    const svgWidth = 800;
    const svgHeight = Math.max(400, leafNodes.length * 36);
    const padding = 50;
    
    // Assign y coordinates to leaves
    leafNodes.forEach((node, i) => {
        node.y = padding + (i * (svgHeight - 2 * padding) / Math.max(1, leafNodes.length - 1));
    });
    
    // Pass 2: assign y coordinates to internal nodes (average of children)
    // and x coordinates based on depth
    let maxDepth = 0;
    function computeCoords(node) {
        if (node.depth > maxDepth) maxDepth = node.depth;
        
        if (node.children && node.children.length > 0) {
            let sumY = 0;
            node.children.forEach(child => {
                computeCoords(child);
                sumY += child.y;
            });
            node.y = sumY / node.children.length;
        }
    }
    computeCoords(newickTree.children[0] || newickTree);
    
    const depthStep = (svgWidth - 260) / Math.max(1, maxDepth);
    
    function assignX(node) {
        node.x = padding + (node.depth * depthStep);
        if (node.children) {
            node.children.forEach(assignX);
        }
    }
    assignX(newickTree.children[0] || newickTree);
    
    // Build SVG strings
    let linesHtml = '';
    let textHtml = '';
    
    function drawTree(node) {
        if (node.children && node.children.length > 0) {
            // Vertical line connecting children
            let minY = Math.min(...node.children.map(c => c.y));
            let maxY = Math.max(...node.children.map(c => c.y));
            
            linesHtml += `<line x1="${node.x}" y1="${minY}" x2="${node.x}" y2="${maxY}" stroke="var(--text-secondary)" stroke-width="2"/>`;
            
            node.children.forEach(child => {
                // Horizontal line to child
                linesHtml += `<line x1="${node.x}" y1="${child.y}" x2="${child.x}" y2="${child.y}" stroke="var(--text-secondary)" stroke-width="2"/>`;
                drawTree(child);
            });
        }
        
        if (node.name) {
            const isQuery = highlightQueryName && (
                node.name.toLowerCase().includes(highlightQueryName.toLowerCase()) ||
                highlightQueryName.toLowerCase().includes(node.name.toLowerCase()) ||
                node.name.toLowerCase().includes('query')
            );
            if (isQuery) {
                textHtml += `<rect x="${node.x + 6}" y="${node.y - 12}" width="280" height="22" rx="4" fill="rgba(37, 99, 235, 0.12)" stroke="var(--accent-primary, #2563eb)" stroke-width="1.5" />`;
                textHtml += `<text x="${node.x + 12}" y="${node.y + 4}" fill="var(--accent-primary, #2563eb)" font-size="13" font-weight="700" font-family="var(--font-sans)">⭐ ${node.name} [Query Isolate]</text>`;
            } else {
                textHtml += `<text x="${node.x + 10}" y="${node.y + 5}" fill="var(--text-primary)" font-size="13" font-family="var(--font-sans)">${node.name}</text>`;
            }
        }
    }
    
    drawTree(newickTree.children[0] || newickTree);
    
    const svgStr = `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: auto;">
            <svg width="${svgWidth}" height="${svgHeight}">
                ${linesHtml}
                ${textHtml}
            </svg>
        </div>
    `;
    
    container.innerHTML = svgStr;
}
