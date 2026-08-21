import type { SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label?: string;
  children: ReactNode;
}

export function Select({ id, label, className = '', children, ...rest }: SelectProps) {
  return (
    <label className="ax-field" htmlFor={id}>
      {label && <span className="ax-label">{label}</span>}
      <span className="relative block">
        <select id={id} className={['ax-input ax-input--select', className].filter(Boolean).join(' ')} {...rest}>
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}
