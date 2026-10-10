// router.js - Simple view routing

export function initRouter() {
    const navItems = document.querySelectorAll('.nav-menu li[data-view]');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const viewId = item.getAttribute('data-view');
            navigateTo(viewId);
        });
    });
}

export function navigateTo(viewId) {
    // Update navigation active state
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    const navItem = document.querySelector(`.nav-menu li[data-view="${viewId}"]`);
    if (navItem) navItem.classList.add('active');

    // Update view visibility
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
    } else {
        // If view doesn't exist yet, show a placeholder
        const mainContent = document.getElementById('main-content');
        
        // Remove existing placeholder if any
        const existingPlaceholder = document.getElementById('view-placeholder');
        if (existingPlaceholder) existingPlaceholder.remove();

        const placeholder = document.createElement('div');
        placeholder.id = 'view-placeholder';
        placeholder.className = 'view-section active card';
        placeholder.innerHTML = `
            <h2>${viewId.replace('-', ' ').toUpperCase()}</h2>
            <p>This module is currently under development.</p>
        `;
        mainContent.appendChild(placeholder);
    }
}
