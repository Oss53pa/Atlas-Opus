import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
}

/** Champ texte verre dépoli + label. */
export function Field({ label, id, className = '', ...rest }: FieldProps) {
  return (
    <label className="ax-field" htmlFor={id}>
      <span className="ax-label">{label}</span>
      <input id={id} className={['ax-input', className].filter(Boolean).join(' ')} {...rest} />
    </label>
  );
}
