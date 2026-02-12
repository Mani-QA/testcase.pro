import type { Context } from 'hono';
import type { Bindings } from '../../types';
import { Button } from '../../components/Button';

const icons = {
  check: `<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
};

export async function signInPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (user) {
    return c.redirect('/dashboard');
  }
  
  const error = c.req.query('error');
  
  return c.html(
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign In | TestCase Pro</title>
        <link rel="stylesheet" href="/static/styles.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body class="bg-gradient-to-br from-primary-50 to-secondary-50 min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md">
          {/* Logo */}
          <div class="text-center mb-8">
            <a href="/" class="inline-flex items-center gap-3">
              <div class="w-12 h-12 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center shadow-medium">
                <span dangerouslySetInnerHTML={{ __html: icons.check }} />
              </div>
              <div class="text-left">
                <h1 class="text-2xl font-bold text-neutral-900">TestCase Pro</h1>
                <p class="text-sm text-neutral-500">QA Management</p>
              </div>
            </a>
          </div>
          
          {/* Card */}
          <div class="bg-white rounded-2xl shadow-strong p-8">
            <h2 class="text-2xl font-bold text-neutral-900 text-center mb-2">Welcome back</h2>
            <p class="text-neutral-600 text-center mb-6">Sign in to your account</p>
            
            {error && (
              <div class="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
                Invalid email or password. Please try again.
              </div>
            )}
            
            <form action="/api/auth/signin" method="POST" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  class="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  class="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
              </div>
              
              <button
                type="submit"
                class="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-soft hover:shadow-medium"
              >
                Sign In
              </button>
            </form>
            
            <div class="mt-6 text-center">
              <p class="text-neutral-600">
                Don't have an account?{' '}
                <a href="/auth/signup" class="text-primary-600 hover:text-primary-700 font-medium">
                  Sign up
                </a>
              </p>
            </div>
            
            <div class="mt-4 text-center">
              <a href="/dashboard" class="text-sm text-neutral-500 hover:text-neutral-700">
                Continue as guest (view only)
              </a>
            </div>
          </div>

          {/* Footer */}
          <footer class="mt-8 text-center text-sm text-neutral-500" role="contentinfo" data-testid="app-footer">
            Developed by{' '}
            <a
              href="https://ManiG.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              aria-label="Visit ManiG's website"
            >
              ManiG
            </a>
            {' '}with{' '}
            <span class="text-red-500" aria-label="love">&#10084;</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

export async function signUpPage(c: Context<{ Bindings: Bindings }>) {
  const user = c.get('user');
  
  if (user) {
    return c.redirect('/dashboard');
  }
  
  const error = c.req.query('error');
  
  return c.html(
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign Up | TestCase Pro</title>
        <link rel="stylesheet" href="/static/styles.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body class="bg-gradient-to-br from-primary-50 to-secondary-50 min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md">
          {/* Logo */}
          <div class="text-center mb-8">
            <a href="/" class="inline-flex items-center gap-3">
              <div class="w-12 h-12 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center shadow-medium">
                <span dangerouslySetInnerHTML={{ __html: icons.check }} />
              </div>
              <div class="text-left">
                <h1 class="text-2xl font-bold text-neutral-900">TestCase Pro</h1>
                <p class="text-sm text-neutral-500">QA Management</p>
              </div>
            </a>
          </div>
          
          {/* Card */}
          <div class="bg-white rounded-2xl shadow-strong p-8">
            <h2 class="text-2xl font-bold text-neutral-900 text-center mb-2">Create account</h2>
            <p class="text-neutral-600 text-center mb-6">Get started with TestCase Pro</p>
            
            {error && (
              <div class="mb-4 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg text-sm">
                {error === 'exists' ? 'Email already registered.' : 'Failed to create account.'}
              </div>
            )}
            
            <form action="/api/auth/signup" method="POST" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  class="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  class="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-neutral-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minlength={6}
                  class="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="••••••••"
                />
                <p class="text-xs text-neutral-500 mt-1">Minimum 6 characters</p>
              </div>
              
              <button
                type="submit"
                class="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors shadow-soft hover:shadow-medium"
              >
                Create Account
              </button>
            </form>
            
            <div class="mt-6 text-center">
              <p class="text-neutral-600">
                Already have an account?{' '}
                <a href="/auth/signin" class="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </div>

          {/* Footer */}
          <footer class="mt-8 text-center text-sm text-neutral-500" role="contentinfo" data-testid="app-footer">
            Developed by{' '}
            <a
              href="https://ManiG.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              aria-label="Visit ManiG's website"
            >
              ManiG
            </a>
            {' '}with{' '}
            <span class="text-red-500" aria-label="love">&#10084;</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

