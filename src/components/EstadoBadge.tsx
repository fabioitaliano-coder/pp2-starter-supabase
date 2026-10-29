import { ESTADO_ETIQUETA, type Estado } from '../types';

export function EstadoBadge({ estado }: { estado: Estado }) {
  return <span className={`estado ${estado}`}>{ESTADO_ETIQUETA[estado]}</span>;
}
