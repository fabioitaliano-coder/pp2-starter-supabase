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
- **Tarjeta de producto:** `.tarjeta.producto` con ilustración emoji. `.marco` reserva `aspect-ratio: 4 / 3` para que el emoji no provoque layout shift. Insignia de stock, título, descripción, precio y botón al pie.
- **CartPanel:** el mismo panel al costado de la tienda y en `/carrito`. Stepper de cantidad, totales y nota de que el importe lo calcula el servidor.
- **Estados:** siempre `EstadoBadge` (`.estado`). Pendiente ámbar, confirmado azul, despachado violeta (`#ede9fe` / `#5b21b6`), entregado verde, cancelado rojo. No indicar el estado solo con color.
- **CartPanel → checkout:** el panel ya no crea el pedido; el botón «Ir a pagar» lleva a `/checkout` (prefetch al pasar el mouse).
- **Checkout por pasos:** `.pasos` (Entrega → Pago → Revisión, con número/✓ y `aria-current="step"`), `.checkout-layout` con el formulario `.checkout-paso` y el `ResumenCompra` sticky a la derecha desde 1000px; en celular el resumen va arriba plegado en `<details class="resumen-movil">`. Acciones al pie en `.acciones-paso` (Volver secundario + principal `.comprar-grande`). Al cambiar de paso el foco va al `h2`.
- **Campos accesibles:** `Campo` / `CampoSelect` (`.campo`, `.error-campo`, ayuda en `.nota`) dentro de `.grilla-campos` (dos columnas, una bajo 640px; `ancho="medio"` ocupa una). Al validar, `enfocarPrimerError` lleva el foco al primer campo con error.
- **Pago simulado:** `.aviso-simulacion` (ámbar punteado, siempre visible), tarjetas de opción `.opcion-pago` / `.elegida` con radio real, `.tarjetas-prueba`, `.datos-transferencia`.
- **Revisión:** `.bloque-revision` con botón `.enlace-azul` «Editar».
- **ResumenCompra:** mismo bloque en checkout, confirmación y seguimiento (`.resumen-compra`, `.miniatura`, `.total-final`, envío `.gratis`).
- **Confirmación:** `.exito-hero` (borde superior verde, `.check-grande`, número de pedido grande) con «Seguir comprando» (principal) y «Seguir mi pedido» (secundario).
- **Seguimiento:** `.linea-tiempo` vertical (hecho verde con ✓, actual azul, futuro gris, cancelado rojo; el texto «completado / en curso» va en `.sr-only`), `.datos-pedido` (entrega, pago, factura) y `FormSeguimiento` para buscar por número.
- **Mi cuenta:** `.cuenta-grilla` (formularios a la izquierda, historial a la derecha desde 1000px), cada formulario en `.tarjeta.formulario-cuenta`.
- **Factura simulada:** `.factura` con letra en `.factura-tipo`, marca de agua «SIMULADA» y `@media print` que oculta barra y botones (`.no-imprimir`).
- **Tablas:** encabezado `#f1f5f9`, scroll horizontal, detalle expandable.
- **Formularios:** `.tarjeta.formulario`, etiqueta visible, no depender del placeholder.
- **Ingreso, registro y confirmación:** `.auth-tarjeta` (tarjeta centrada de 440px con sombra), `CampoClave` con botón «Mostrar/Ocultar» (`.clave-envoltura`, `.clave-ver`), confirmación de contraseña con `.ok-campo` cuando coincide, errores de formulario en `.alerta`, pasos del mail en `.pasos-correo`, ícono redondo `.icono-aviso` (`.icono-error` en rojo), bloque de reenvío `.reenviar` con cuenta regresiva y aviso de éxito en la tienda con `.aviso-banda`.
- **Errores y carga:** `role="alert"` / `role="status"`. Esqueletos (`.esqueleto`) en catálogo, tablas de pedidos y resumen admin. Esqueleto `EsqueletoPedido` en confirmación, seguimiento y factura. Spinner `.giro` en «Confirmar y pagar» mientras corre el RPC.
- **Responsive:** dos columnas de productos bajo 640px; nav de la barra en una fila con scroll; ocultar el email en celular.

No se agregaron tokens nuevos: los colores de estado e insignias son literales, igual que los existentes.

## Cómo aplicar cambios

1. Reutilizá las clases de `src/index.css` (los mismos nombres que en la app de referencia).
2. Si hace falta un token compartido nuevo, documentalo acá y en `:root`.
3. No agregues Tailwind, shadcn/ui ni otra biblioteca visual.
4. Después del cambio, ejecutá `npm run build` y revisá escritorio (≥1000px, carrito al costado) y celular (~390px, barra inferior del carrito).
