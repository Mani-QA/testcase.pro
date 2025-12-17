import type { FC } from 'hono/jsx';

interface CardProps {
  children: any;
  title?: string;
  subtitle?: string;
  className?: string;
  padding?: boolean;
}

export const Card: FC<CardProps> = ({ 
  children, 
  title, 
  subtitle, 
  className = '', 
  padding = true 
}) => {
  return (
    <div class={`bg-white rounded-xl border border-neutral-200 shadow-soft ${className}`}>
      {(title || subtitle) && (
        <div class="px-6 py-4 border-b border-neutral-100">
          {title && <h3 class="text-lg font-semibold text-neutral-900">{title}</h3>}
          {subtitle && <p class="text-sm text-neutral-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div class={padding ? 'p-6' : ''}>
        {children}
      </div>
    </div>
  );
};

