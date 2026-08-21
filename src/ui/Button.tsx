import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'glass' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: boolean;
  children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'ax-btn--primary',
  glass: 'ax-btn--glass',
  ghost: 'ax-btn--ghost',
};

export function Button({
  variant = 'glass',
  size = 'md',
  icon = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'ax-btn',
    variantClass[variant],
    size === 'sm' && 'ax-btn--sm',
    icon && 'ax-btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
