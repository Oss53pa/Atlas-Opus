import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label?: string;
}

export function Textarea({ id, label, className = '', ...rest }: TextareaProps) {
  return (
    <label className="ax-field" htmlFor={id}>
      {label && <span className="ax-label">{label}</span>}
      <textarea id={id} className={['ax-textarea', className].filter(Boolean).join(' ')} {...rest} />
    </label>
  );
}
