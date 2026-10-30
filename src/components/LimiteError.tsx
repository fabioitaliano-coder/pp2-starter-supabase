import { Component, type ReactNode } from 'react';

// Concepto · Error boundary: si una pantalla lazy no puede cargarse (sin red, deploy
// nuevo que ya recargó una vez), mostramos un mensaje en lugar de una página en blanco.
export class LimiteError extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <section className="tarjeta centro" role="alert">
        <h1>No se pudo abrir esta pantalla</h1>
        <p className="vacio">Puede ser la conexión o una versión nueva del sitio.</p>
        <button type="button" onClick={() => window.location.reload()}>Recargar</button>
      </section>
    );
  }
}
