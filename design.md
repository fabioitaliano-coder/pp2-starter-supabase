# Design system — PP2 Starter Supabase

Este documento es la referencia visual para la interfaz del starter. Leelo antes de cambiar pantallas, estilos, componentes o dependencias visuales. La implementación usa Tailwind CSS v4; los valores de la paleta se eligieron manualmente para este proyecto. No se generan tokens, paletas ni temas automáticamente.

## Dirección visual

Interfaz académica y administrativa: clara, sobria y actual, con superficies blancas, fondo gris azulado, azul como acento y estados semánticos. Priorizar legibilidad, jerarquía y feedback útil sobre decoración. Evitar gradientes intensos, sombras pesadas, animaciones llamativas y componentes que oculten el flujo de datos.

## Tokens manuales

Los valores se mantienen explícitos en `src/index.css`, dentro de `@theme`. Si se modifica un valor, actualizar esta tabla y el CSS en el mismo cambio.

| Token Tailwind | Valor | Uso |
| --- | --- | --- |
| `brand-50` | `#eff6ff` | Fondo azul de interacción suave |
| `brand-100` | `#dbeafe` | Anillo de foco y bordes suaves |
| `brand-600` | `#2563eb` | Acción principal y enlaces |
| `brand-700` | `#1d4ed8` | Hover y títulos de marca |
| `ink` | `#172033` | Texto principal |
| `muted` | `#64748b` | Ayuda, metadatos y texto secundario |
| `line` | `#e2e8f0` | Bordes y separadores |
| `canvas` | `#f5f7fb` | Fondo de página |
| `danger` | `#b91c1c` | Errores |

Tipografía: pila del sistema con alternativas sans-serif; no requiere descargar fuentes para mostrar contenido. Radio de controles: `0.75rem`; tarjetas: `1rem`; foco: borde azul más anillo visible. Mantener `min-h-10` en botones y `min-h-11` en campos para facilitar el uso táctil.

## Componentes y patrones

- **Acción principal:** botón azul sólido; usarlo para enviar formularios o confirmar la acción más importante.
- **Acción secundaria:** botón blanco con borde; reservar para navegación y acciones de menor prioridad.
- **Formularios:** etiqueta visible, controles de ancho completo y estado de foco perceptible. No depender del placeholder como etiqueta.
- **Tarjetas:** superficies blancas con borde fino y sombra discreta; agrupan formularios y resúmenes.
- **Tablas:** conservar encabezados claros, separadores discretos y scroll horizontal en pantallas estrechas.
- **Estados:** pendiente ámbar, confirmado azul, entregado verde y cancelado rojo. No indicar el estado solo con color: conservar también el texto.
- **Errores y carga:** usar `role="alert"` para errores y `role="status"` para estados de carga; el mensaje debe explicar qué ocurre.
- **Responsive y accesibilidad:** mantener navegación por teclado, foco visible, contraste suficiente y adaptación a móvil. No eliminar atributos ARIA ni etiquetas existentes al estilizar.

## Cómo aplicar cambios

1. Identificá el componente que representa el patrón y reutilizá sus clases actuales cuando sea posible.
2. Usá utilidades Tailwind y los tokens definidos aquí; evitá valores arbitrarios repetidos.
3. Si hace falta un nuevo token realmente compartido, proponelo y documentá su valor y uso en este archivo y en `src/index.css`. Para un único detalle local, usá una utilidad existente.
4. No agregues shadcn/ui ni otra biblioteca de componentes sin pedirlo explícitamente: este starter adopta Tailwind directamente para mantener el ejemplo pequeño y transparente.
5. Después del cambio, ejecutá `npm run build` y revisá la pantalla en móvil y escritorio.

## Instrucción para pedir trabajo a un agente

Incluí una indicación como esta en la solicitud:

> Antes de modificar la UI, leé `design.md` y seguí sus decisiones de diseño y accesibilidad. Implementá el cambio con Tailwind CSS y los tokens manuales existentes. No generes ni regeneres tokens, no agregues una biblioteca visual y no alteres valores globales sin documentar el motivo y actualizar `design.md`.
