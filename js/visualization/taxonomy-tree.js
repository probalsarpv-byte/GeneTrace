// taxonomy-tree.js

export class TaxonomyPath {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container ${containerId} not found`);
    }

    render(taxonomyData) {
        this.clear();
        
        const levels = ['Domain', 'Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'];
        
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '10px';
        wrapper.style.padding = '20px';
        wrapper.style.fontFamily = 'sans-serif';
        
        let delay = 0;
        
        levels.forEach((level, index) => {
            const key = level.toLowerCase();
            let val = taxonomyData[key];
            let tentative = false;
            
            if (val && val.includes('(tentative)')) {
                tentative = true;
                val = val.replace('(tentative)', '').trim();
            }
            
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.opacity = '0';
            item.style.transform = 'translateY(10px)';
            item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            item.style.transitionDelay = `${delay}ms`;
            
            const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (isReducedMotion) {
                item.style.transition = 'none';
                item.style.opacity = '1';
                item.style.transform = 'none';
            }
            
            // Connective line
            if (index > 0) {
                const line = document.createElement('div');
                line.style.width = '2px';
                line.style.height = '15px';
                line.style.backgroundColor = '#ccc';
                line.style.marginLeft = '14px';
                line.style.marginRight = '20px';
                wrapper.appendChild(line);
            }
            
            const rankLabel = document.createElement('div');
            rankLabel.innerText = level;
            rankLabel.style.width = '60px';
            rankLabel.style.fontSize = '12px';
            rankLabel.style.color = '#777';
            rankLabel.style.fontWeight = 'bold';
            
            const pill = document.createElement('div');
            pill.style.padding = '5px 12px';
            pill.style.borderRadius = '20px';
            pill.style.backgroundColor = val ? '#e6f0fa' : '#f5f5f5';
            pill.style.color = val ? '#0056b3' : '#999';
            pill.style.border = `1px solid ${val ? '#cce0ff' : '#ddd'}`;
            pill.style.display = 'flex';
            pill.style.alignItems = 'center';
            pill.style.gap = '8px';
            pill.style.cursor = 'pointer';
            
            const taxonName = document.createElement('span');
            taxonName.innerText = val || 'Not determined';
            if (level === 'Species' || level === 'Genus') {
                taxonName.style.fontStyle = 'italic';
            }
            pill.appendChild(taxonName);
            
            if (tentative) {
                const badge = document.createElement('span');
                badge.innerText = 'Tentative';
                badge.style.backgroundColor = '#ffc107';
                badge.style.color = '#000';
                badge.style.fontSize = '10px';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '10px';
                pill.appendChild(badge);
            }
            
            pill.title = `${level}: ${val || 'Not determined'}`;
            
            item.appendChild(rankLabel);
            item.appendChild(pill);
            wrapper.appendChild(item);
            
            if (!isReducedMotion) {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 50);
                });
            }
            
            delay += 100;
        });
        
        this.container.appendChild(wrapper);
    }
    
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
