import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createMockDb,
  createOperationsRepo,
  createProgramRepo,
  createBilanRepo,
  createStakeholdersRepo,
  createComplianceRepo,
  createPaymentsRepo,
  createPlanningRepo,
  createTendersRepo,
} from '../data/mock';
import type {
  BilanLineRecord,
  BilanRepo,
  BilanView,
  OperationFilter,
  OperationsRepo,
  ProgramRepo,
  Session,
  StakeholdersRepo,
  ComplianceRepo,
  PaymentsRepo,
  PlanningRepo,
  TendersRepo,
} from '../data/repo';
import type { Stakeholder } from '../domain/m2/types';
import type { Authorization } from '../domain/m2/authorizations';
import type { DueDiligenceItem } from '../domain/m2/dueDiligence';
import type { Insurance } from '../domain/m7/types';
import type { Contract, Decompte } from '../domain/payments/types';
import type { Task } from '../domain/m12/types';
import type { Tender } from '../domain/m8/types';
import { createTelemetry } from '../lib/telemetry';
import { COUNTRIES, type CountryConfig } from '../domain/country';
import type { Operation, ProgramItem, Role } from '../domain/m1/types';
import { Money } from '../domain/money/Money';
import { supabase } from '../data/supabase/client';
import {
  createSupabaseBilanRepo,
  createSupabaseOperationsRepo,
  createSupabaseProgramRepo,
  createSupabaseStakeholdersRepo,
  createSupabaseComplianceRepo,
  createSupabasePaymentsRepo,
  createSupabasePlanningRepo,
  createSupabaseTendersRepo,
} from '../data/supabase/adapter';
import { useAuth } from './auth';
import { EmptyState } from '../ui';
import { t } from '../i18n';

interface DataApi {
  ops: OperationsRepo;
  program: ProgramRepo;
  bilan: BilanRepo;
  stakeholders: StakeholdersRepo;
  compliance: ComplianceRepo;
  payments: PaymentsRepo;
  planning: PlanningRepo;
  tenders: TendersRepo;
  session: Session;
  countries: CountryConfig[];
}

const DataCtx = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error('useData doit être utilisé dans un DataProvider');
  return ctx;
}

function buildMockApi(): DataApi {
  const db = createMockDb();
  // Session de démonstration (sera fournie par l'auth Supabase).
  const session: Session = { userId: 'u-demo', tenantId: 'tenant-demo', role: 'moa_director', operationScope: null };
  const telemetry = createTelemetry((e) => console.debug('[telemetry]', e));
  return {
    ops: createOperationsRepo(db, session, { telemetry }),
    program: createProgramRepo(db, session, { telemetry }),
    bilan: createBilanRepo(db, session, { telemetry }),
    stakeholders: createStakeholdersRepo(db, session, { telemetry }),
    compliance: createComplianceRepo(db, session, { telemetry }),
    payments: createPaymentsRepo(db, session, { telemetry }),
    planning: createPlanningRepo(db, session, { telemetry }),
    tenders: createTendersRepo(db, session, { telemetry }),
    session,
    countries: COUNTRIES,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [api, setApi] = useState<DataApi | null>(null);
  const [noTenant, setNoTenant] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (mode === 'mock') {
        if (alive) setApi(buildMockApi());
        return;
      }
      // Backend Supabase : l'AuthGate garantit un utilisateur ici.
      if (!supabase || !user) return;
      const { data: ut } = await supabase
        .from('user_tenants')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!ut) {
        if (alive) setNoTenant(true);
        return;
      }
      const session: Session = {
        userId: user.id,
        tenantId: (ut as { tenant_id: string }).tenant_id,
        role: ((ut as { role: string | null }).role as Role) ?? 'viewer',
        operationScope: null,
      };
      const telemetry = createTelemetry((e) => console.debug('[telemetry]', e));
      if (alive)
        setApi({
          ops: createSupabaseOperationsRepo(supabase, session, telemetry),
          program: createSupabaseProgramRepo(supabase, session, telemetry),
          bilan: createSupabaseBilanRepo(supabase, session),
          stakeholders: createSupabaseStakeholdersRepo(supabase, session),
          compliance: createSupabaseComplianceRepo(supabase, session),
          payments: createSupabasePaymentsRepo(supabase, session),
          planning: createSupabasePlanningRepo(supabase, session),
          tenders: createSupabaseTendersRepo(supabase, session),
          session,
          countries: COUNTRIES,
        });
    })();
    return () => {
      alive = false;
    };
  }, [mode, user]);

  if (noTenant) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <EmptyState title={t('auth.noTenant.title')} description={t('auth.noTenant.desc')} />
      </div>
    );
  }
  if (!api) return null;
  return <DataCtx.Provider value={api}>{children}</DataCtx.Provider>;
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

function useAsync<T>(run: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    run()
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, loading: data === null && !error, error, refetch };
}

export function useOperations(filter: OperationFilter): AsyncState<Operation[]> {
  const { ops } = useData();
  return useAsync(() => ops.list(filter), [ops, JSON.stringify(filter)]);
}

export function useOperation(id: string): AsyncState<Operation | null> {
  const { ops } = useData();
  return useAsync(() => ops.get(id), [ops, id]);
}

export function useProgram(operationId: string, version?: number): AsyncState<ProgramItem[]> {
  const { program } = useData();
  return useAsync(() => program.list(operationId, version), [program, operationId, version]);
}

export function useBilan(operationId: string): AsyncState<BilanView | null> {
  const { bilan } = useData();
  return useAsync(() => bilan.summary(operationId), [bilan, operationId]);
}

export function useBilanLines(operationId: string): AsyncState<BilanLineRecord[]> {
  const { bilan } = useData();
  return useAsync(() => bilan.lines(operationId), [bilan, operationId]);
}

export function useStakeholders(operationId: string): AsyncState<Stakeholder[]> {
  const { stakeholders } = useData();
  return useAsync(() => stakeholders.list(operationId), [stakeholders, operationId]);
}

export function useAuthorizations(operationId: string): AsyncState<Authorization[]> {
  const { compliance } = useData();
  return useAsync(() => compliance.authorizations(operationId), [compliance, operationId]);
}

export function useInsurances(operationId: string): AsyncState<Insurance[]> {
  const { compliance } = useData();
  return useAsync(() => compliance.insurances(operationId), [compliance, operationId]);
}

export function useDueDiligence(operationId: string): AsyncState<DueDiligenceItem[]> {
  const { compliance } = useData();
  return useAsync(() => compliance.dueDiligence(operationId), [compliance, operationId]);
}

export function useContracts(operationId: string): AsyncState<Contract[]> {
  const { payments } = useData();
  return useAsync(() => payments.contracts(operationId), [payments, operationId]);
}

export function useDecomptes(operationId: string): AsyncState<Decompte[]> {
  const { payments } = useData();
  return useAsync(() => payments.decomptes(operationId), [payments, operationId]);
}

export function useTasks(operationId: string): AsyncState<Task[]> {
  const { planning } = useData();
  return useAsync(() => planning.list(operationId), [planning, operationId]);
}

export function useTenders(operationId: string): AsyncState<Tender[]> {
  const { tenders } = useData();
  return useAsync(() => tenders.list(operationId), [tenders, operationId]);
}

/** Marge agrégée du portefeuille, par devise (somme exacte via Money). */
export function useAggregatedMarge(ops: Operation[] | null): { byCurrency: Map<string, Money>; loading: boolean } {
  const { bilan } = useData();
  const [result, setResult] = useState<{ byCurrency: Map<string, Money>; loading: boolean }>({
    byCurrency: new Map(),
    loading: true,
  });
  const key = ops ? ops.map((o) => o.id).join(',') : '';

  useEffect(() => {
    if (!ops) return;
    let alive = true;
    (async () => {
      const summaries = await Promise.all(
        ops.map((o) =>
          bilan
            .summary(o.id)
            .then((s) => ({ o, s }))
            .catch(() => ({ o, s: null })),
        ),
      );
      const byCurrency = new Map<string, Money>();
      for (const { o, s } of summaries) {
        if (!s) continue;
        byCurrency.set(o.currency, (byCurrency.get(o.currency) ?? Money.zero(o.currency)).add(s.summary.marge));
      }
      if (alive) setResult({ byCurrency, loading: false });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilan, key]);

  return result;
}
