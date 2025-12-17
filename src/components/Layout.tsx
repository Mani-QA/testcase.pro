import type { FC } from 'hono/jsx';
import type { User } from '../types';

interface LayoutProps {
  children: any;
  user: User | null;
  currentPath: string;
  title?: string;
}

const navItems = [
  { href: '/dashboard', icon: 'home', label: 'Dashboard' },
  { href: '/test-plan', icon: 'folder', label: 'Test Plan' },
  { href: '/test-run', icon: 'play', label: 'Test Run' },
  { href: '/reports', icon: 'chart', label: 'Reports' },
];

const icons: Record<string, string> = {
  home: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
  folder: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>`,
  play: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  chart: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
  check: `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  user: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
  logout: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`,
  login: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>`,
};

export const Layout: FC<LayoutProps> = ({ children, user, currentPath, title }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ? `${title} | TestCase Pro` : 'TestCase Pro'}</title>
        <link rel="stylesheet" href="/static/styles.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="https://unpkg.com/htmx.org@1.9.10"></script>
        <script src="https://unpkg.com/alpinejs@3.13.3/dist/cdn.min.js" defer></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body class="bg-neutral-50">
        <div class="flex h-screen">
          {/* Sidebar */}
          <aside class="w-64 bg-white border-r border-neutral-200 flex flex-col shadow-soft">
            {/* Logo */}
            <div class="p-6 border-b border-neutral-200">
              <a href="/dashboard" class="flex items-center gap-3 group">
                <div class="w-10 h-10 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center shadow-medium group-hover:shadow-strong transition-shadow">
                  <span class="text-white" dangerouslySetInnerHTML={{ __html: icons.check }} />
                </div>
                <div>
                  <h1 class="text-lg font-bold text-neutral-900">TestCase Pro</h1>
                  <p class="text-xs text-neutral-500">QA Management</p>
                </div>
              </a>
            </div>

            {/* Navigation */}
            <nav class="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
              {navItems.map((item) => {
                const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    class={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 shadow-soft'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: icons[item.icon] }} />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            {/* User Section */}
            <div class="p-4 border-t border-neutral-200">
              {user ? (
                <div class="space-y-3">
                  <div class="flex items-center gap-3 px-3 py-2">
                    <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span class="text-primary-600" dangerouslySetInnerHTML={{ __html: icons.user }} />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-neutral-900 truncate">
                        {user.fullName || user.email}
                      </p>
                      <p class="text-xs text-neutral-500">QA Member</p>
                    </div>
                  </div>
                  <form action="/api/auth/signout" method="POST">
                    <button
                      type="submit"
                      class="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-600 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                    >
                      <span dangerouslySetInnerHTML={{ __html: icons.logout }} />
                      Sign Out
                    </button>
                  </form>
                </div>
              ) : (
                <div class="space-y-3">
                  <div class="px-3 py-2 bg-warning-50 border border-warning-200 rounded-lg">
                    <p class="text-xs font-medium text-warning-800 mb-1">Guest Mode</p>
                    <p class="text-xs text-warning-700">View only access. Sign in to create and edit.</p>
                  </div>
                  <a
                    href="/auth/signin"
                    class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-soft hover:shadow-medium"
                  >
                    <span dangerouslySetInnerHTML={{ __html: icons.login }} />
                    Sign In for Full Access
                  </a>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main class="flex-1 overflow-auto bg-neutral-50">
            <div class="min-h-full">
              {children}
            </div>
          </main>
        </div>

        {/* Toast Container */}
        <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>

        {/* Toast Script */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.showToast = function(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast-enter px-4 py-3 rounded-lg shadow-medium flex items-center gap-3 ' + 
              (type === 'success' ? 'bg-white border-l-4 border-success-500' : 
               type === 'error' ? 'bg-white border-l-4 border-danger-500' : 'bg-white border-l-4 border-primary-500');
            toast.innerHTML = '<span class="text-sm text-neutral-900">' + message + '</span>';
            container.appendChild(toast);
            setTimeout(() => {
              toast.classList.remove('toast-enter');
              toast.classList.add('toast-exit');
              setTimeout(() => toast.remove(), 300);
            }, 4000);
          };
        `}} />
      </body>
    </html>
  );
};

