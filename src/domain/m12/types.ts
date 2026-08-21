/** M12 — Planning (réf schema.sql §5). Domaine pur. */

export interface Task {
  id: string;
  tenantId: string;
  operationId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isMilestone: boolean;
  isCritical: boolean;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isMilestone?: boolean;
  isCritical?: boolean;
  progress?: number;
}

export type TaskPatch = Partial<
  Pick<Task, 'name' | 'startDate' | 'endDate' | 'isMilestone' | 'isCritical' | 'progress'>
>;
