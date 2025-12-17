import type { FC } from 'hono/jsx';

interface ModalProps {
  id: string;
  title: string;
  children: any;
  footer?: any;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Modal: FC<ModalProps> = ({ 
  id, 
  title, 
  children, 
  footer,
  size = 'md' 
}) => {
  return (
    <div
      id={id}
      x-data="{ open: false }"
      x-show="open"
      x-cloak
      class="fixed inset-0 z-50 overflow-y-auto"
      style="display: none;"
    >
      {/* Backdrop */}
      <div
        class="fixed inset-0 modal-backdrop transition-opacity"
        x-show="open"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0"
        x-transition:enter-end="opacity-100"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100"
        x-transition:leave-end="opacity-0"
        onClick={() => { /* @ts-ignore */ document.dispatchEvent(new CustomEvent('close-modal', { detail: id })); }}
      />
      
      {/* Modal Content */}
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class={`relative bg-white rounded-xl shadow-strong w-full ${sizeStyles[size]} transform transition-all`}
          x-show="open"
          x-transition:enter="transition ease-out duration-200"
          x-transition:enter-start="opacity-0 scale-95"
          x-transition:enter-end="opacity-100 scale-100"
          x-transition:leave="transition ease-in duration-150"
          x-transition:leave-start="opacity-100 scale-100"
          x-transition:leave-end="opacity-0 scale-95"
        >
          {/* Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <h3 class="text-lg font-semibold text-neutral-900">{title}</h3>
            <button
              type="button"
              class="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              onClick={() => { /* @ts-ignore */ document.dispatchEvent(new CustomEvent('close-modal', { detail: id })); }}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Body */}
          <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
          
          {/* Footer */}
          {footer && (
            <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

