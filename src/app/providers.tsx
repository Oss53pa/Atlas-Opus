import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createMockDb,
  createOperationsRepo,
  createProgramRepo,
  createBilanRepo,
  createStakeholdersRepo,
  createComplianceRepo,
  createFinancingRepo,
  createCommercialisationRepo,
  createReportingRepo,
  createPaymentsRepo,
  createPlanningRepo,
  createTendersRepo,
  createGovernanceRepo,
  createStudiesRepo,
  createOffersRepo,
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
  FinancingRepo,
  CommercialisationRepo,
  ReportingRepo,
  PaymentsRepo,
  PlanningRepo,
  TendersRepo,
  GovernanceRepo,
  StudiesRepo,
  OffersRepo,
} from '../data/repo';
import type { Stakeholder } from '../domain/m2/types';
import type { Authorization } from '../domain/m2/authorizations';
import type { DueDiligenceItem } from '../domain/m2/dueDiligence';
import type { LandParcel, TitleDocument } from '../domain/m2/foncier';
import type { Financing, Drawdown } from '../domain/m5/types';
import type { Unit, Sale, Receipt } from '../domain/m6/types';
import type { ReportSnapshot } from '../domain/m21/reporting';
import type { Insurance, RaciAssignment, Decision } from '../domain/m7/types';
import type { Contract, Decompte } from '../domain/payments/types';
import type { Task } from '../domain/m12/types';
import type { Tender } from '../domain/m8/types';
import type { Study } from '../domain/m3/types';
import type { Offer } from '../domain/m9/types';
import { createTelemetry } from '../lib/telemetry';
import { COUNTRIES, type CountryConfig } from '../domain/country';
import type { Operation, ProgramItem, Role } from '../domain/m1/types';
import { Money } from '../domain/money/Money';
import { deriveOperationAlerts, type ConsolidatedAlert } from '../domain/m21';
import { bilanToAlertFacts } from '../features/m1/alerts';
import { supabase } from '../data/supabase/client';
import {
  createSupabaseBilanRepo,
  createSupabaseOperationsRepo,
  createSupabaseProgramRepo,
  createSupabaseStakeholdersRepo,
  createSupabaseComplianceRepo,
  createSupabaseFinancingRepo,
  createSupabaseCommercialisationRepo,
  createSupabaseReportingRepo,
  createSupabasePaymentsRepo,
  createSupabasePlanningRepo,
  createSupabaseTendersRepo,
  createSupabaseGovernanceRepo,
  createSupabaseStudiesRepo,
  createSupabaseOffersRepo,
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
  financing: FinancingRepo;
  commercialisation: CommercialisationRepo;
  reporting: ReportingRepo;
  payments: PaymentsRepo;
  planning: PlanningRepo;
  tenders: TendersRepo;
  governance: GovernanceRepo;
  studies: StudiesRepo;
  offers: OffersRepo;
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
    financing: createFinancingRepo(db, session, { telemetry }),
    commercialisation: createCommercialisationRepo(db, session, { telemetry }),
    reporting: createReportingRepo(db, session, { telemetry }),
    payments: createPaymentsRepo(db, session, { telemetry }),
    planning: createPlanningRepo(db, session, { telemetry }),
    tenders: createTendersRepo(db, session, { telemetry }),
    governance: createGovernanceRepo(db, session, { telemetry }),
    studies: createStudiesRepo(db, session, { telemetry }),
    offers: createOffersRepo(db, session, { telemetry }),
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
          financing: createSupabaseFinancingRepo(supabase, session),
          commercialisation: createSupabaseCommercialisationRepo(supabase, session),
          reporting: createSupabaseReportingRepo(supabase, session),
          payments: createSupabasePaymentsRepo(supabase, session),
          planning: createSupabasePlanningRepo(supabase, session),
          tenders: createSupabaseTendersRepo(supabase, session),
          governance: createSupabaseGovernanceRepo(supabase, session),
          studies: createSupabaseStudiesRepo(supabase, session),
          offers: createSupabaseOffersRepo(supabase, session),
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

export function useLandParcels(operationId: string): AsyncState<LandParcel[]> {
  const { compliance } = useData();
  return useAsync(() => compliance.landParcels(operationId), [compliance, operationId]);
}

export function useTitles(parcelId: string): AsyncState<TitleDocument[]> {
  const { compliance } = useData();
  return useAsync(() => compliance.titles(parcelId), [compliance, parcelId]);
}

export function useFinancings(operationId: string): AsyncState<Financing[]> {
  const { financing } = useData();
  return useAsync(() => financing.list(operationId), [financing, operationId]);
}

export function useDrawdowns(financingId: string): AsyncState<Drawdown[]> {
  const { financing } = useData();
  return useAsync(() => financing.drawdowns(financingId), [financing, financingId]);
}

export function useUnits(operationId: string): AsyncState<Unit[]> {
  const { commercialisation } = useData();
  return useAsync(() => commercialisation.units(operationId), [commercialisation, operationId]);
}

export function useSales(operationId: string): AsyncState<Sale[]> {
  const { commercialisation } = useData();
  return useAsync(() => commercialisation.sales(operationId), [commercialisation, operationId]);
}

export function useReceipts(saleId: string): AsyncState<Receipt[]> {
  const { commercialisation } = useData();
  return useAsync(() => commercialisation.receipts(saleId), [commercialisation, saleId]);
}

export function useReports(operationId: string): AsyncState<ReportSnapshot[]> {
  const { reporting } = useData();
  return useAsync(() => reporting.list(operationId), [reporting, operationId]);
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

export function useStudies(operationId: string): AsyncState<Study[]> {
  const { studies } = useData();
  return useAsync(() => studies.list(operationId), [studies, operationId]);
}

export function useOffers(operationId: string): AsyncState<Offer[]> {
  const { offers } = useData();
  return useAsync(() => offers.list(operationId), [offers, operationId]);
}

export function useRaci(operationId: string): AsyncState<RaciAssignment[]> {
  const { governance } = useData();
  return useAsync(() => governance.raci(operationId), [governance, operationId]);
}

export function useDecisions(operationId: string): AsyncState<Decision[]> {
  const { governance } = useData();
  return useAsync(() => governance.decisions(operationId), [governance, operationId]);
}

/** Marge agrégée du portefeuille, par devise (somme exacte via Money). */
/** Alertes consolidées par opération pour le classement par risque du portefeuille (M21). */
export function usePortfolioRisk(ops: Operation[] | null): { alertsByOp: Map<string, ConsolidatedAlert[]>; loading: boolean } {
  const { bilan } = useData();
  const [result, setResult] = useState<{ alertsByOp: Map<string, ConsolidatedAlert[]>; loading: boolean }>({
    alertsByOp: new Map(),
    loading: true,
  });
  const key = ops ? ops.map((o) => o.id).join(',') : '';

  useEffect(() => {
    if (!ops) return;
    let alive = true;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const entries = await Promise.all(
        ops.map((o) =>
          bilan
            .summary(o.id)
            .then((s) => ({ o, s }))
            .catch(() => ({ o, s: null })),
        ),
      );
      const alertsByOp = new Map<string, ConsolidatedAlert[]>();
      for (const { o, s } of entries) {
        alertsByOp.set(o.id, deriveOperationAlerts(bilanToAlertFacts(o, s, today)));
      }
      if (alive) setResult({ alertsByOp, loading: false });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bilan, key]);

  return result;
}

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
