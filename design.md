# Design system — PP2 Starter Supabase

Este documento es la referencia visual del starter. Leelo antes de cambiar pantallas, estilos o componentes. El sistema es el mismo que el de la app de referencia [`ecommerce-ifts16-supabase`](https://github.com/fabioitaliano-coder/ecommerce-ifts16-supabase): CSS plano con variables en `src/index.css`. No se usa Tailwind ni se generan paletas automáticamente. No agregues shadcn/ui ni otra biblioteca visual.

## Dirección visual

Tienda clara y administrativa: fondo gris (`--fondo`), superficies blancas, azul `--azul` como acento, insignias de estado y stock. Priorizar jerarquía, el carrito al costado en escritorio y controles cómodos para el pulgar en celular. Evitar gradientes intensos y componentes que oculten el flujo de datos.

## Tokens manuales

Los valores viven en `:root` de `src/index.css`. Si se modifica uno, actualizar esta tabla y el CSS en el mismo cambio.

| Variable | Valor | Uso |
| --- | --- | --- |
| `--azul` | `#1a56db` | Acción principal, enlaces, insignia del carrito |
| `--azul-oscuro` | `#1747b8` | Hover de botones |
| `--borde` | `#cbd5e1` | Bordes y separadores |
| `--fondo` | `#f8fafc` | Fondo de página |
| `--texto` | `#0f172a` | Texto principal |
| `--error` | `#b91c1c` | Errores y “Quitar” |
| `--ok` | `#047857` | Éxito y stock disponible |
| `--radio` | `10px` | Botones, campos y tarjetas |
| `--sombra` | `0 1px 2px …, 0 4px 14px …` | Hover de tarjetas de producto |

Tipografía: pila del sistema. Foco: anillo azul semitransparente (`outline` 3px). Botones y campos con padding `.6rem .8rem`.

## Componentes y patrones

- **Barra:** sticky, con marca, `NavLink` (borde inferior en `.active`), insignia numérica del carrito y sesión (`Salir` / `Ingresar`).
- **Acción principal:** botón azul sólido; `Confirmar compra` y `Agregar al carrito` usan ancho completo (`.comprar`, `.comprar-grande`).
- **Acción secundaria:** `button.secundario` (blanco, texto azul). `peligro` para vaciar/quitar.
- **Campos y selects:** misma altura, radio y foco. El `select` oculta la flecha nativa y usa un chevron propio.
- **Catálogo:** `.tienda-layout` (productos + `.carrito-lateral` sticky desde 1000px). En angosto, `.barra-carrito` fija abajo.
- **Tarjeta de producto:** `.tarjeta.producto` con ilustración emoji (`.ilustracion` 4:3), insignia de stock, título, descripción, precio y botón al pie.
- **CartPanel:** el mismo panel al costado de la tienda y en `/carrito`. Stepper de cantidad, totales y nota de que el importe lo calcula el servidor.
- **Estados:** siempre `EstadoBadge` (`.estado`). Pendiente ámbar, confirmado azul, entregado verde, cancelado rojo. No indicar el estado solo con color.
- **Tablas:** encabezado `#f1f5f9`, scroll horizontal, detalle expandable.
- **Formularios:** `.tarjeta.formulario`, etiqueta visible, no depender del placeholder.
- **Errores y carga:** `role="alert"` / `role="status"`. Esqueletos (`.esqueleto`) en catálogo, tablas de pedidos y resumen admin. Spinner `.giro` en «Confirmar compra» mientras corre el RPC.
- **Responsive:** dos columnas de productos bajo 640px; nav de la barra en una fila con scroll; ocultar el email en celular.

## Cómo aplicar cambios

1. Reutilizá las clases de `src/index.css` (los mismos nombres que en la app de referencia).
2. Si hace falta un token compartido nuevo, documentalo acá y en `:root`.
3. No agregues Tailwind, shadcn/ui ni otra biblioteca visual.
4. Después del cambio, ejecutá `npm run build` y revisá escritorio (≥1000px, carrito al costado) y celular (~390px, barra inferior del carrito).
