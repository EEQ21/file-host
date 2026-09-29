export type NavId = "upload" | "about" | "terms" | "privacy" | "file";

const NAV: { id: NavId; href: string; label: string }[] = [
  { id: "upload", href: "/#upload", label: "Upload" },
  { id: "about", href: "/about", label: "About us" },
  { id: "terms", href: "/terms", label: "Terms" },
  { id: "privacy", href: "/privacy", label: "Privacy" },
];

function navItem(item: (typeof NAV)[0], active: NavId): string {
  const isActive = item.id === active;
  return `<a href="${item.href}" class="sidebar-link${isActive ? " sidebar-link--active" : ""}"${isActive ? ' aria-current="page"' : ""}>${item.label}</a>`;
}

export function sidebar(active: NavId): string {
  const links = NAV.map((item) => navItem(item, active)).join("\n        ");
  return `<aside class="sidebar" id="site-sidebar" aria-label="Site navigation">
    <div class="sidebar-top">
      <a href="/" class="logo sidebar-logo">Fike</a>
      <button type="button" class="sidebar-close" id="sidebar-close" aria-label="Close menu">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <nav class="sidebar-nav" aria-label="Pages">
      ${links}
    </nav>
  </aside>
  <div class="sidebar-backdrop" id="sidebar-backdrop" hidden></div>`;
}

export function layout(opts: {
  title: string;
  active: NavId;
  content: string;
  mainClass?: string;
  pageClass?: string;
  scripts?: string;
}): string {
  const mainClass = opts.mainClass ? ` ${opts.mainClass}` : "";
  const pageClass = opts.pageClass ? ` ${opts.pageClass}` : "";
  const scripts = opts.scripts ?? "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${opts.title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body class="page page--with-sidebar${pageClass}">
  <div class="app-shell">
    ${sidebar(opts.active)}
    <div class="content-shell">
      <header class="content-header">
        <button type="button" class="sidebar-toggle" id="sidebar-open" aria-controls="site-sidebar" aria-expanded="false" aria-label="Open menu">
          <span class="sidebar-toggle-bar"></span>
          <span class="sidebar-toggle-bar"></span>
          <span class="sidebar-toggle-bar"></span>
        </button>
        <span class="content-header-title">Fike</span>
      </header>
      <main class="main${mainClass} animate-in">
        ${opts.content}
      </main>
      <footer class="site-footer">
        <p>Fike. Simple file hosting.</p>
      </footer>
    </div>
  </div>
  <script src="/js/sidebar.js" defer></script>
  ${scripts}
</body>
</html>`;
}
