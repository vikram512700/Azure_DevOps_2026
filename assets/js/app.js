document.addEventListener('DOMContentLoaded', () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const contentArea = document.getElementById('content-area');
    const breadcrumb = document.getElementById('breadcrumb');
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    // Configure Marked.js
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (Prism.languages[lang]) {
                return Prism.highlight(code, Prism.languages[lang], lang);
            } else {
                return code;
            }
        }
    });

    // Custom marked renderer to fix local links
    const renderer = new marked.Renderer();
    let currentBasePath = '';

    renderer.link = function(href, title, text) {
        // If it's a relative link to another markdown file
        if (href && !href.startsWith('http') && !href.startsWith('#') && href.endsWith('.md')) {
            // Convert to a click handler instead of a standard link navigation
            const targetPath = resolvePath(currentBasePath, href);
            return `<a href="#" class="internal-link" data-path="${targetPath}">${text}</a>`;
        }
        return marked.Renderer.prototype.link.call(this, href, title, text);
    };

    renderer.image = function(href, title, text) {
        if (href && !href.startsWith('http')) {
            href = resolvePath(currentBasePath, href);
        }
        return marked.Renderer.prototype.image.call(this, href, title, text);
    };

    marked.use({ renderer });

    // Path resolution helper
    function resolvePath(base, relative) {
        const stack = base.split('/');
        stack.pop(); // Remove current filename
        
        const parts = relative.split('/');
        for (let part of parts) {
            if (part === '.') continue;
            if (part === '..') {
                stack.pop();
            } else {
                stack.push(part);
            }
        }
        return stack.join('/');
    }

    // Render Navigation recursively
    function renderNav(structure, container, path = '') {
        structure.forEach(item => {
            const el = document.createElement('div');
            el.className = 'nav-item';

            if (item.type === 'directory') {
                const folder = document.createElement('div');
                folder.className = 'nav-folder';
                folder.textContent = item.title;
                
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'nav-children';

                folder.addEventListener('click', () => {
                    childrenContainer.classList.toggle('expanded');
                });

                renderNav(item.children, childrenContainer, `${path}${item.title}/`);
                
                el.appendChild(folder);
                el.appendChild(childrenContainer);
            } else if (item.type === 'file' && item.title.endsWith('.md')) {
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'nav-file';
                link.textContent = item.title.replace('.md', '').replace(/^[0-9]+_/, '').replace(/_/g, ' ');
                link.dataset.path = item.path;

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.querySelectorAll('.nav-file').forEach(n => n.classList.remove('active'));
                    link.classList.add('active');
                    loadMarkdown(item.path);
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('open');
                    }
                });

                el.appendChild(link);
            }

            container.appendChild(el);
        });
    }

    // Load Markdown Content
    async function loadMarkdown(filePath) {
        try {
            contentArea.innerHTML = `
                <div class="welcome-screen">
                    <div class="loader"></div>
                    <p>Loading ${filePath}...</p>
                </div>
            `;
            
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            
            // Set base path for renderer
            currentBasePath = filePath;
            
            // Parse markdown to HTML
            const html = marked.parse(text);
            
            // Render HTML
            contentArea.innerHTML = `<div class="markdown-body fade-in">${html}</div>`;
            breadcrumb.textContent = filePath.replace(/\\/g, '/');
            
            // Re-run prism highlighting
            Prism.highlightAllUnder(contentArea);

            // Add click listeners to internal links
            document.querySelectorAll('.internal-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const path = e.target.getAttribute('data-path');
                    // Find and activate the sidebar item
                    document.querySelectorAll('.nav-file').forEach(n => {
                        n.classList.remove('active');
                        if (n.dataset.path === path) {
                            n.classList.add('active');
                            // Expand parents if collapsed
                            let parent = n.parentElement.parentElement;
                            while (parent && parent.classList.contains('nav-children')) {
                                parent.classList.add('expanded');
                                parent = parent.parentElement.parentElement;
                            }
                        }
                    });
                    loadMarkdown(path);
                });
            });
            
            // Scroll to top
            contentArea.scrollTop = 0;
            
        } catch (error) {
            console.error("Error loading markdown:", error);
            contentArea.innerHTML = `
                <div class="welcome-screen">
                    <h2>⚠️ Error loading content</h2>
                    <p>Could not load <code>${filePath}</code>.</p>
                    <p style="font-size: 0.8rem; margin-top: 1rem; color: var(--text-secondary)">Please ensure you are running a local web server (e.g., using live server) as direct file:// protocol prevents fetching files due to CORS.</p>
                </div>
            `;
        }
    }

    // Initialize
    if (typeof repoStructure !== 'undefined') {
        renderNav(repoStructure, sidebarNav);
    } else {
        sidebarNav.innerHTML = '<p style="padding:1rem;">Error: config.js not loaded.</p>';
    }

    // Load README on start
    if (repoStructure) {
        const readme = repoStructure.find(item => item.title.toLowerCase() === 'readme.md');
        if (readme) {
            loadMarkdown(readme.path);
        }
    }

    // Mobile Menu
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    contentArea.addEventListener('click', () => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
});
