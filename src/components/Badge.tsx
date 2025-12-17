import type { FC } from 'hono/jsx';

interface BadgeProps {
  children: any;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
}

const variantStyles = {
  primary: 'bg-primary-100 text-primary-800',
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-800',
  danger: 'bg-danger-100 text-danger-800',
  neutral: 'bg-neutral-100 text-neutral-800',
  info: 'bg-primary-100 text-primary-800',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export const Badge: FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'md' 
}) => {
  return (
    <span class={`inline-flex items-center font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
};

