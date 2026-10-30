# Trabajar con agentes de IA en PP2

Los asistentes de código (Copilot, Antigravity, Cursor y otros) pueden escribir mucho código rápido. Eso es útil y también es el riesgo: **el código lo firmás vos**. Esta guía explica primero la **mecánica**, la **metodología** y los **resguardos**, que valen para cualquier herramienta. Las herramientas van al final, porque cambian todo el tiempo y el método no.

> Regla de oro: **si no podés explicar una línea, no la commitees.** En la evaluación se pide explicar el código entregado, lo haya escrito una persona o un agente.

---

## 1. La mecánica: el ciclo de trabajo

Trabajá en ciclos cortos. Cada vuelta termina con algo que compila, pasa las pruebas y se puede revertir.

```
 1. Planificar   → ¿qué querés lograr? ¿cómo te das cuenta de que está bien?
 2. Tarea chica  → una sola cosa (una pantalla, una política, un campo)
 3. El agente propone → primero un plan, después el código
 4. Leés el diff → línea por línea, entendiendo cada cambio
 5. Verificás    → npm run build + npm run test:rls + prueba manual
 6. Commit       → chico, con mensaje claro; si algo sale mal, se revierte fácil
```

### Una rama y un PR por tarea

```bash
git switch main && git pull
git switch -c feature/telefono-alternativo   # una rama por tarea
# … ciclo de trabajo …
git add src/features/client/MiCuenta.tsx supabase/schema.sql scripts/test-rls.mjs
git commit -m "Mi cuenta: agrega teléfono alternativo con su CHECK y su prueba"
git push -u origin feature/telefono-alternativo
gh pr create   # o desde la web de GitHub
```

- Agregá archivos **por nombre** (`git add archivo`), no con `git add .` a ciegas: así no se cuela un `.env` ni un archivo generado.
- El PR lo revisa otra persona del equipo (o vos mismo al día siguiente). El agente **no** hace merge.

### Checklist de cada vuelta

- [ ] La tarea entra en un párrafo y tiene criterio de aceptación.
- [ ] Pedí un plan antes del código y lo entendí.
- [ ] Leí todo el diff y puedo explicar cada línea.
- [ ] `npm run build` pasa.
- [ ] `npm run test:rls` pasa (si toqué datos, permisos o SQL) y hay prueba para lo nuevo.
- [ ] Probé a mano: sin sesión, cliente, admin; escritorio y celular.
- [ ] El commit no incluye `.env`, `dist/` ni secretos.

---

## 2. Cómo pedirle cosas a un agente (prompting)

Un buen pedido tiene **contexto**, **alcance** y **criterio de aceptación**. El agente no sabe lo que vos sabés: decíselo.

### Malo

> Agregá el teléfono al perfil.

### Bueno

> Leé `AGENTS.md` y `design.md`. Quiero que en **Mi cuenta** (`src/features/client/MiCuenta.tsx`) la persona pueda guardar un **teléfono alternativo** en su domicilio de entrega.
>
> - En la base: agregá la columna `telefono_alt` a `public.direcciones` en `supabase/schema.sql`, de forma idempotente. Revisá que las políticas RLS existentes la cubran.
> - Validación: 6 a 25 caracteres (números, espacios, `+`, `( )` y guiones), en el formulario **y** en un `CHECK` de la tabla, igual que `telefono`.
> - Agregá una prueba en `scripts/test-rls.mjs`: cliente1 no puede cambiar el teléfono alternativo de cliente2.
> - **Antes de escribir código, mostrame un plan** con los archivos que vas a tocar.
>
> Terminado = `npm run build` pasa y la prueba nueva está escrita.

### Patrones útiles

- **Plan primero:** "No escribas código todavía. Proponé un plan en pasos y qué archivos vas a modificar."
- **Prueba primero (para reglas de seguridad):** "Escribí primero la prueba en `test-rls.mjs` que demuestre que cliente1 **no** puede leer facturas de cliente2. Después el cambio."
- **Pedí explicación:** "Explicame qué hace esta política RLS línea por línea y qué pasaría si sacamos el `WITH CHECK`."
- **Acotá:** "Solo modificá `MisPedidos.tsx`. No cambies otros archivos sin preguntarme."
- **Pedí alternativas:** "Dame dos formas de resolverlo y sus ventajas y desventajas."
- **Contexto con archivos concretos:** mencioná o adjuntá los archivos relevantes en lugar de describirlos de memoria.

---

## 3. Revisar lo que propone el agente

El agente se equivoca con confianza. Tu trabajo es revisar como si lo hubiera escrito un compañero apurado.

### Al leer el diff, preguntate

- ¿Hace **solo** lo que pedí? ¿Tocó archivos que no tenían que ver?
- ¿Entiendo cada línea? Si no, pedile que la explique o buscala en la documentación oficial.
- ¿Valida en el cliente **y** en la base? ¿Quién calcula el total, el estado, el precio?
- ¿Agregó dependencias? ¿Existen de verdad? ¿Las necesito?
- ¿Cambió una política RLS, un `GRANT` o un trigger? → revisión manual obligatoria (ver resguardos).
- ¿Borró pruebas o las "ajustó" para que pasen? Eso es una alarma.

### Las pruebas son la red de seguridad

`npm run test:rls` intenta hacer lo que un atacante haría con la clave pública: leer datos ajenos, cambiar un total, emitirse una factura. Si un agente "arregla" algo y una prueba empieza a fallar, **el problema casi siempre está en el cambio, no en la prueba**.

Para reglas de seguridad, escribí (o pedí) la prueba **antes** del cambio: primero falla, después del cambio pasa. Así sabés que la prueba realmente controla algo.

---

## 4. Resguardos

| Riesgo | Resguardo |
| :--- | :--- |
| Filtrar secretos | No pegues `.env`, claves `sb_secret_…`, contraseñas ni tokens en el chat del agente. Si pasó, **rotá la clave** en Supabase. |
| Subir `.env` a GitHub | `.env` está en `.gitignore`. Revisá `git status` antes de cada commit y agregá archivos por nombre. |
| SQL y RLS incorrectos | Leé a mano todo cambio en `schema.sql`. Preguntate: ¿quién puede leer? ¿quién puede escribir? ¿qué columnas? Corré `test:rls`. |
| "Arreglos" que abren la base | **Nunca** aceptes `DISABLE ROW LEVEL SECURITY`, `USING (true)` para escribir, `GRANT ALL` o usar la clave secret en el frontend para "que funcione". Ese error es la seguridad haciendo su trabajo. |
| Comandos destructivos | No dejes que el agente ejecute `DROP`, `DELETE` sin `WHERE`, `rm -rf`, `git push --force` ni `git reset --hard` sin leerlos y aprobarlos. Configurá la herramienta para que **pida confirmación** antes de correr comandos. |
| Base de producción | Los agentes trabajan contra un proyecto Supabase **de prueba**. Nunca contra datos reales. |
| Paquetes alucinados | Los modelos a veces inventan nombres de paquetes o funciones. Antes de instalar, buscá el paquete en npmjs.com: que exista, tenga mantenimiento y descargas razonables. Hay paquetes maliciosos con nombres parecidos a los reales. |
| APIs inventadas | Si el agente usa una función que no conocés, verificala en la documentación oficial (Supabase, React, MDN). |
| Licencias | Si el agente copia código de un proyecto, verificá su licencia. Este repo es MIT. |
| Cambios gigantes | Commits chicos y revertibles. Si el diff no entra en una pantalla, partí la tarea. |
| Datos personales | Usá solo datos ficticios (Ley 25.326). No pegues datos reales en el chat. |

---

## 5. Integridad académica

- **Declará el uso de IA** en el PR o en la entrega: qué herramienta usaste y para qué (por ejemplo, "Copilot propuso la validación del formulario; la revisé y agregué la prueba").
- Vas a tener que **explicar el código** que entregás: qué hace, por qué está ahí y qué pasaría si se cambia.
- Las reglas de la cursada las define el o la docente. **Si una indicación de esta guía choca con las pautas de la materia, valen las pautas de la materia.**

---

## 6. Herramientas (resumen)

Todas pueden leer archivos del proyecto, proponer cambios en varios archivos y, si las autorizás, ejecutar comandos en la terminal. El método de arriba vale para cualquiera. Consultá siempre la documentación oficial para la versión que tengas instalada: las funciones y los planes cambian seguido.

| Herramienta | Qué es | Cómo toma las instrucciones de este repo |
| :--- | :--- | :--- |
| **VS Code + GitHub Copilot** | Extensión de Copilot en VS Code con chat y **modo agente** (edita varios archivos y propone comandos). | Lee `AGENTS.md` y `.github/copilot-instructions.md` (este repo trae los dos; el segundo remite al primero). |
| **Google Antigravity** | Entorno de desarrollo de Google pensado para trabajar con agentes. | Lee `AGENTS.md` como regla del proyecto. |
| **Cursor** | Editor basado en VS Code con agente integrado. | Lee `AGENTS.md`. |
| **Otras** (Claude Code, OpenAI Codex, Gemini CLI, etc.) | Agentes de terminal o de editor. | Codex lee `AGENTS.md`; otras usan su propio archivo (`CLAUDE.md`, `GEMINI.md`): creá uno corto que diga "Seguí AGENTS.md". |

Recomendaciones para cualquier herramienta:

- Abrí la **carpeta del repo** (no una carpeta padre) para que encuentre `AGENTS.md`.
- Dejá activada la **confirmación antes de ejecutar comandos** y revisá cada comando que propone.
- Usá el modo "preguntar" o "plan" para entender código; el modo agente para cambios ya acordados.
- No conectes la herramienta a tu base de producción ni le des la clave secret.

---

## Checklist final antes del PR

- [ ] Una tarea, una rama, un PR.
- [ ] Puedo explicar cada línea del diff.
- [ ] `npm run build` ✓ · `npm run test:rls` ✓ · prueba manual ✓
- [ ] Toda tabla/política nueva tiene su prueba.
- [ ] Sin secretos, sin `.env`, sin `dist/`.
- [ ] Declaré el uso de IA en la descripción del PR.
