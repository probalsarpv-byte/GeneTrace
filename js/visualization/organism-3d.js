// organism-3d.js
// Scientific 3D organism visualization for GeneTrace v1.1
// Uses Three.js loaded from CDN (lazy-loaded on first use)
// DISCLAIMER: Illustrative scientific visualization only
// Not a microscopic photograph or exact specimen rendering

function loadThreeJS() {
    return new Promise((resolve, reject) => {
        if (window.THREE) {
            resolve(window.THREE);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => resolve(window.THREE);
        script.onerror = () => reject(new Error('Failed to load Three.js'));
        document.head.appendChild(script);
    });
}

function getFallbackSVG(type, label) {
    const colors = {
        'bacterium': '#5b7fa6',
        'gram-positive': '#800080',
        'gram-negative': '#5b7fa6',
        'yeast': '#b8956a',
        'filamentous-fungus': '#8b6b4a',
        'protozoan': '#4a9b8e',
        'microalgae': '#3d8b5e',
        'bacteriophage': '#7a8899',
        'ssRNA-virus': '#c0614a',
        'dsDNA-virus': '#c0614a',
        'unknown': '#999999'
    };
    const color = colors[type] || colors['unknown'];
    
    // Simplified flat illustrations
    let shape = `<circle cx="50" cy="50" r="30" fill="${color}" />`;
    if (type.includes('virus') || type === 'bacteriophage') {
        shape = `<polygon points="50,20 80,50 50,80 20,50" fill="${color}" />`;
    } else if (type === 'bacterium' || type === 'gram-negative') {
        shape = `<rect x="20" y="35" width="60" height="30" rx="15" fill="${color}" />`;
    }

    return `
        <div style="text-align:center; padding: 20px;">
            <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                ${shape}
            </svg>
            <div style="margin-top: 10px; font-family: sans-serif; font-size: 14px; color: #333;">${label || type}</div>
            <div style="font-size: 10px; color: #777; margin-top: 5px;">Illustrative scientific visualization based on identified organism group</div>
        </div>
    `;
}

export class OrganismViewer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container ${containerId} not found`);
        this.options = { interactive: false, width: 400, height: 300, ...options };
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.mesh = null;
        this.animationId = null;
        this.isInteracting = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    async init() {
        try {
            await loadThreeJS();
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(45, this.options.width / this.options.height, 0.1, 1000);
            this.camera.position.z = 10;

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(this.options.width, this.options.height);
            this.container.appendChild(this.renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 20, 10);
            this.scene.add(directionalLight);
        } catch (e) {
            console.warn("Falling back to SVG illustration due to ThreeJS load error", e);
            this.renderer = null;
        }
    }

    showOrganism(type, label, isPremium) {
        if (!this.renderer) {
            this.container.innerHTML = getFallbackSVG(type, label);
            return;
        }

        const colors = {
            'bacterium': 0x5b7fa6,
            'gram-positive': 0x800080,
            'gram-negative': 0x5b7fa6,
            'yeast': 0xb8956a,
            'filamentous-fungus': 0x8b6b4a,
            'protozoan': 0x4a9b8e,
            'microalgae': 0x3d8b5e,
            'bacteriophage': 0x7a8899,
            'ssRNA-virus': 0xc0614a,
            'dsDNA-virus': 0xc0614a,
            'unknown': 0x999999
        };
        const color = colors[type] || colors['unknown'];
        const material = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });

        let geometry;
        switch (type) {
            case 'bacterium':
            case 'gram-negative':
                geometry = (typeof THREE.CapsuleGeometry !== 'undefined') 
                    ? new THREE.CapsuleGeometry(1.5, 3, 16, 32) 
                    : new THREE.CylinderGeometry(1.5, 1.5, 3, 16);
                break;
            case 'gram-positive':
            case 'yeast':
            case 'microalgae':
                geometry = new THREE.SphereGeometry(2, 32, 16);
                break;
            case 'bacteriophage':
            case 'ssRNA-virus':
            case 'dsDNA-virus':
                geometry = new THREE.IcosahedronGeometry(2, 0);
                break;
            case 'filamentous-fungus':
                geometry = new THREE.CylinderGeometry(0.5, 0.5, 6, 16);
                break;
            case 'protozoan':
            default:
                geometry = new THREE.DodecahedronGeometry(2, 1);
                break;
        }

        if (this.mesh) this.scene.remove(this.mesh);
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        this.addDisclaimer();
        this.addOrganismLabel(label || type);

        if (isPremium) {
            this.setupInteraction();
        }

        this.animate();
    }

    setupInteraction() {
        this.renderer.domElement.style.cursor = 'grab';
        
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            this.isInteracting = true;
            this.lastMouse.x = e.clientX;
            this.lastMouse.y = e.clientY;
            this.renderer.domElement.style.cursor = 'grabbing';
        });

        window.addEventListener('mouseup', () => {
            this.isInteracting = false;
            this.renderer.domElement.style.cursor = 'grab';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isInteracting || !this.mesh) return;
            const deltaX = e.clientX - this.lastMouse.x;
            const deltaY = e.clientY - this.lastMouse.y;
            this.mesh.rotation.y += deltaX * 0.01;
            this.mesh.rotation.x += deltaY * 0.01;
            this.lastMouse.x = e.clientX;
            this.lastMouse.y = e.clientY;
        });
    }

    addDisclaimer() {
        let disc = document.getElementById('organism-disclaimer');
        if (!disc) {
            disc = document.createElement('div');
            disc.id = 'organism-disclaimer';
            disc.style.position = 'absolute';
            disc.style.bottom = '10px';
            disc.style.left = '10px';
            disc.style.fontSize = '10px';
            disc.style.color = '#777';
            disc.style.pointerEvents = 'none';
            this.container.style.position = 'relative';
            this.container.appendChild(disc);
        }
        disc.innerText = 'Illustrative scientific visualization based on identified organism group';
    }

    addOrganismLabel(text) {
        let label = document.getElementById('organism-label');
        if (!label) {
            label = document.createElement('div');
            label.id = 'organism-label';
            label.style.position = 'absolute';
            label.style.top = '10px';
            label.style.left = '10px';
            label.style.fontWeight = 'bold';
            label.style.color = '#333';
            label.style.pointerEvents = 'none';
            this.container.appendChild(label);
        }
        label.innerText = text;
    }

    animate() {
        if (!this.renderer) return;
        this.animationId = requestAnimationFrame(() => this.animate());
        if (!this.isInteracting && this.mesh) {
            this.mesh.rotation.y += 0.005;
            this.mesh.rotation.x += 0.002;
        }
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.renderer) {
            this.renderer.dispose();
            this.container.innerHTML = '';
        }
    }

    exportImage() {
        if (!this.renderer) return null;
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL();
    }
}

export class StaticOrganismIllustration {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }
    show(type, label) {
        if (this.container) {
            this.container.innerHTML = getFallbackSVG(type, label);
        }
    }
}
