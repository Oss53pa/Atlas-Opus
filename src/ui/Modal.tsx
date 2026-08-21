import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { t } from '../i18n';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="ax-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ax-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-[18px] font-medium">{title}</h2>
          <Button variant="ghost" size="sm" icon aria-label={t('common.close')} onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="px-5 pb-1">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 p-5 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
