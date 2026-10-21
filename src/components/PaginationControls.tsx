interface Props {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({ currentPage, totalItems, pageSize, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const desde = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const hasta = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav className="paginacion" aria-label="Paginación">
      <span>Mostrando {desde}–{hasta} de {totalItems}</span>
      <span>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>← Anterior</button>
        {' '}Página {currentPage} de {totalPages}{' '}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente →</button>
      </span>
    </nav>
  );
}
