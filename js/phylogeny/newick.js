// newick.js
// Basic Newick format parser
// e.g. "((A,B),(C,D));"

export function parseNewick(newickStr) {
    const tokens = newickStr.match(/\(|\)|,|[^(),]+/g);
    
    let root = { name: '', children: [] };
    let currentNode = root;
    let stack = [];
    
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        
        if (token === '(') {
            let node = { name: '', children: [], parent: currentNode };
            currentNode.children.push(node);
            stack.push(currentNode);
            currentNode = node;
        } else if (token === ',') {
            let node = { name: '', children: [], parent: stack[stack.length - 1] };
            stack[stack.length - 1].children.push(node);
            currentNode = node;
        } else if (token === ')') {
            currentNode = stack.pop();
        } else {
            // Label and optional branch length, e.g. "A:0.1"
            let [name, length] = token.split(':');
            currentNode.name = name ? name.trim() : '';
            if (length) {
                currentNode.length = parseFloat(length);
            }
        }
    }
    
    return root;
}
