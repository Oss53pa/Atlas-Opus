import { Badge } from '../../ui';
import type { Phase } from '../../domain/m1/types';
import { PHASE_TONE, phaseLabel } from './labels';

export function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <Badge tone={PHASE_TONE[phase]} dot>
      {phaseLabel(phase)}
    </Badge>
  );
}
