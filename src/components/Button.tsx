import type { FC } from 'hono/jsx';

interface ButtonProps {
  children: any;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  href?: string;
  icon?: string;
  onClick?: string;
}

const variantStyles = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-soft hover:shadow-medium',
  secondary: 'bg-secondary-600 hover:bg-secondary-700 text-white shadow-soft hover:shadow-medium',
  ghost: 'bg-transparent hover:bg-neutral-100 text-neutral-700',
  danger: 'bg-danger-600 hover:bg-danger-700 text-white shadow-soft hover:shadow-medium',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: FC<ButtonProps> = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  href,
  icon,
  onClick,
}) => {
  const baseClass = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const classes = `${baseClass} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (href) {
    return (
      <a href={href} class={classes}>
        {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      class={classes}
      disabled={disabled}
      onclick={onClick}
    >
      {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}
      {children}
    </button>
  );
};

