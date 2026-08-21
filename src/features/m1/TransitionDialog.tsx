import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Banner, Button, Modal, Select, Textarea, useToast } from '../../ui';
import { phaseLabel } from './labels';
import { useData } from '../../app/providers';
import { t, type MessageKey } from '../../i18n';
import { PHASES, type Operation, type Phase } from '../../domain/m1/types';
import { evaluateTransition, nextPhase, type TransitionContext } from '../../domain/m1/stateMachine';

export function TransitionDialog({
  op,
  open,
  onClose,
  onDone,
}: {
  op: Operation;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { ops, session } = useData();
  const toast = useToast();
  const [ctx, setCtx] = useState<TransitionContext | null>(null);
  const [target, setTarget] = useState<Phase>(nextPhase(op.phase) ?? op.phase);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      ops.getTransitionContext(op.id).then(setCtx);
      setTarget(nextPhase(op.phase) ?? op.phase);
      setJustification('');
    }
  }, [open, op.id, op.phase, ops]);

  const decision = useMemo(
    () =>
      ctx
        ? evaluateTransition(op.phase, target, ctx, { role: session.role, justification, tenantRequiresDirectorConfirm: false })
        : null,
    [ctx, op.phase, target, justification, session.role],
  );

  async function commit() {
    if (!decision?.ok) return;
    setBusy(true);
    try {
      await ops.setPhase(op.id, target);
      toast.push(
        decision.proposed ? t('transition.proposed') : t('transition.success', { phase: phaseLabel(target) }),
        decision.proposed ? 'info' : 'success',
      );
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const targets = PHASES.filter((p) => p !== op.phase);

  return (
    <Modal
      open={open}
      title={t('transition.title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!decision?.ok || busy} onClick={commit}>
            {decision?.ok && decision.proposed ? t('transition.propose') : t('transition.commit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          <span>{t('transition.from')} :</span>
          <span className="font-medium text-ink">{phaseLabel(op.phase)}</span>
        </div>
        <Select id="tr-target" label={t('transition.to')} value={target} onChange={(e) => setTarget(e.target.value as Phase)}>
          {targets.map((p) => (
            <option key={p} value={p}>
              {phaseLabel(p)}
            </option>
          ))}
        </Select>
        <Textarea
          id="tr-just"
          label={t('transition.justification')}
          placeholder={t('transition.justification.ph')}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />

        {decision && !decision.ok && decision.code === 'guard_unmet' && (
          <Banner tone="danger" icon={<AlertTriangle size={16} />}>
            <div className="font-medium">{t('transition.missing.title')}</div>
            <ul className="mt-1 list-disc pl-4">
              {decision.missing.map((k) => (
                <li key={k}>{t(k as MessageKey)}</li>
              ))}
            </ul>
          </Banner>
        )}
        {decision && !decision.ok && decision.code === 'needs_director' && (
          <Banner tone="danger" icon={<AlertTriangle size={16} />}>{t('transition.error.needsDirector')}</Banner>
        )}
        {decision && !decision.ok && decision.code === 'needs_justification' && (
          <Banner tone="info" icon={<Info size={16} />}>{t('transition.error.needsJustification')}</Banner>
        )}
        {decision && !decision.ok && decision.code === 'invalid_transition' && (
          <Banner tone="danger" icon={<AlertTriangle size={16} />}>{t('transition.error.invalid')}</Banner>
        )}
        {decision?.ok && decision.proposed && (
          <Banner tone="info" icon={<Info size={16} />}>{t('transition.proposed')}</Banner>
        )}
      </div>
    </Modal>
  );
}
