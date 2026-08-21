/**
 * Télémétrie M1 (réf Spec M1 §11). Événements typés et journalisés.
 * Implémentation pluggable : ici un collecteur mémoire + console (dev).
 */
export type TelemetryEvent =
  | { name: 'operation.created'; operationId: string; opType: string; countryCode: string }
  | { name: 'operation.updated'; operationId: string; changedFields: string[] }
  | { name: 'operation.phase_changed'; operationId: string; from: string; to: string; actor: string }
  | { name: 'program.version_created'; operationId: string; version: number };

export interface Telemetry {
  emit(event: TelemetryEvent): void;
  events: ReadonlyArray<TelemetryEvent>;
}

export function createTelemetry(sink?: (e: TelemetryEvent) => void): Telemetry {
  const events: TelemetryEvent[] = [];
  return {
    events,
    emit(event) {
      events.push(event);
      sink?.(event);
    },
  };
}
