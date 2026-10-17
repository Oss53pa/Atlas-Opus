import { AtlasLogoHorizontal, AtlasLogoVertical } from './AtlasLogo';

/**
 * Marque de l'application — logo officiel Atlas Studio (cf. AtlasLogo).
 * La déclinaison dépend de l'emplacement : `horizontal` dans les bandeaux et
 * la barre latérale (le défaut), `vertical` dans les blocs centrés (connexion).
 */
export function Brand({
  height,
  orientation = 'horizontal',
  decorative = false,
}: {
  /** Hauteur du logo en px ; défaut adapté à la déclinaison. */
  height?: number;
  orientation?: 'horizontal' | 'vertical';
  /** true quand le parent porte déjà le nom accessible (bouton, lien). */
  decorative?: boolean;
}) {
  const label = decorative ? null : undefined;
  return orientation === 'vertical' ? (
    <AtlasLogoVertical height={height ?? 84} label={label} />
  ) : (
    <AtlasLogoHorizontal height={height ?? 30} label={label} />
  );
}
