interface Props {
  currentPage: number;
  hayMas: boolean;
  onPageChange: (page: number) => void;
}

// Concepto · Sin COUNT(*): si la página vino llena (POR_PAGINA filas), quizás hay más.
export function PaginationControls({ currentPage, hayMas, onPageChange }: Props) {
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>Página {currentPage}</span>
      <span>
        <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
          ← Anterior
        </button>
        {' '}
        <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={!hayMas}>
          Siguiente →
        </button>
      </span>
    </nav>
  );
}
