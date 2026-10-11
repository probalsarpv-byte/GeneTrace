// router.js - Enhanced view routing for GeneTrace v1.1

export function initRouter() {
    const navItems = document.querySelectorAll('.nav-menu li[data-view], .nav-item[data-view], [data-view-target]');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const viewId = item.getAttribute('data-view') || item.getAttribute('data-view-target');
            if (viewId) {
                navigateTo(viewId);
            }
        });
    });
}

export function navigateTo(viewId) {
    // Update navigation active state
    document.querySelectorAll('.nav-menu li, .nav-item').forEach(li => li.classList.remove('active'));
    const navItem = document.querySelector(`.nav-menu li[data-view="${viewId}"], .nav-item[data-view="${viewId}"]`);
    if (navItem) navItem.classList.add('active');

    // Update view visibility
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
        // Scroll main content to top
        const mainContent = document.getElementById('main-content');
        if (mainContent) mainContent.scrollTop = 0;
    } else {
        // If view doesn't exist yet, show a placeholder
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const existingPlaceholder = document.getElementById('view-placeholder');
            if (existingPlaceholder) existingPlaceholder.remove();

            const placeholder = document.createElement('div');
            placeholder.id = 'view-placeholder';
            placeholder.className = 'view-section active card';
            placeholder.innerHTML = `
                <h2>${viewId.replace(/-/g, ' ').toUpperCase()}</h2>
                <p>This module is currently initializing.</p>
            `;
            mainContent.appendChild(placeholder);
        }
    }

    // Dispatch custom navigation event for sub-modules to react
    window.dispatchEvent(new CustomEvent('genetrace:navigated', { detail: { viewId } }));
}

if (typeof window !== 'undefined') {
    window.navigateTo = navigateTo;
}
