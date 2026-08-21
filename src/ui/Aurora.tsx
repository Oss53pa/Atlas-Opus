/** Nappe aurora animée (blobs flous) — décor de fond, derrière le contenu. */
export function Aurora() {
  return (
    <div className="ax-aurora-layer" aria-hidden="true">
      <span className="ax-blob ax-blob--a" />
      <span className="ax-blob ax-blob--b" />
      <span className="ax-blob ax-blob--c" />
    </div>
  );
}
