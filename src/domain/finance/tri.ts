/**
 * TRI — taux annulant la VAN des flux (réf CLAUDE.md §6).
 * Newton-Raphson en TS pur, repli par bissection si non-convergence.
 * Les flux sont des nombres (majeurs) ; le TRI est un ratio sans dimension.
 */

export function npv(rate: number, flows: number[]): number {
  let acc = 0;
  for (let t = 0; t < flows.length; t++) acc += flows[t] / Math.pow(1 + rate, t);
  return acc;
}

function dNpv(rate: number, flows: number[]): number {
  let acc = 0;
  for (let t = 1; t < flows.length; t++) acc += (-t * flows[t]) / Math.pow(1 + rate, t + 1);
  return acc;
}

/**
 * Renvoie le TRI, ou null si pas de solution (flux tous de même signe, divergence).
 */
export function tri(flows: number[], guess = 0.1): number | null {
  if (flows.length < 2) return null;
  const hasPos = flows.some((f) => f > 0);
  const hasNeg = flows.some((f) => f < 0);
  if (!hasPos || !hasNeg) return null;

  // Newton-Raphson
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate, flows);
    if (Math.abs(f) < 1e-7) return rate;
    const d = dNpv(rate, flows);
    if (Math.abs(d) < 1e-12) break;
    const next = rate - f / d;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < 1e-9) return next;
    rate = next;
  }

  // Repli : bissection sur [-0.9999, 10]
  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo, flows);
  const fhi = npv(hi, flows);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, flows);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}
