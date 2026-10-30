import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

// Concepto · Campo accesible: la etiqueta está asociada (htmlFor), el error se anuncia
// con aria-invalid + aria-describedby, y la ayuda no depende del placeholder.
interface Base {
  nombre: string;
  etiqueta: string;
  error?: string;
  ayuda?: ReactNode;
  ancho?: 'completo' | 'medio';
}

function describir(id: string, ayuda: unknown, error: unknown) {
  return [ayuda ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

function Pie({ id, ayuda, error }: { id: string; ayuda?: ReactNode; error?: string }) {
  return (
    <>
      {ayuda && <small id={`${id}-ayuda`} className="nota">{ayuda}</small>}
      {error && <small id={`${id}-error`} className="error-campo">{error}</small>}
    </>
  );
}

export function Campo({
  nombre, etiqueta, error, ayuda, ancho = 'completo', ...input
}: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = `campo-${nombre}`;
  return (
    <div className={`campo ${ancho}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, ayuda, error)}
        {...input}
      />
      <Pie id={id} ayuda={ayuda} error={error} />
    </div>
  );
}

export function CampoSelect({
  nombre, etiqueta, error, ayuda, ancho = 'completo', children, ...select
}: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `campo-${nombre}`;
  return (
    <div className={`campo ${ancho}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, ayuda, error)}
        {...select}
      >
        {children}
      </select>
      <Pie id={id} ayuda={ayuda} error={error} />
    </div>
  );
}

// Lleva el foco al primer campo con error (después de validar un paso).
export function enfocarPrimerError(errores: Record<string, string | undefined>) {
  const primero = Object.keys(errores).find((k) => errores[k]);
  if (primero) document.getElementById(`campo-${primero}`)?.focus();
}
