import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, guardarDireccion, invalidarTrasCompra, pedirMiCuenta } from '../../lib/consultas';
import { esRechazada, marcaDe, soloDigitos } from '../../lib/tarjetaSimulada';
import { dinero } from '../../lib/formato';
import { enfocarPrimerError } from '../../components/Campo';
import { ResumenCompra } from '../../components/ResumenCompra';
import { PasoEntrega } from './PasoEntrega';
import { PasoPago } from './PasoPago';
import { PasoRevision } from './PasoRevision';
import {
  ENVIO_VACIO, PAGO_VACIO, domicilioTexto, validarEnvio, validarPago,
  type DatosEnvio, type DatosPago, type Errores,
} from './validacion';

type Paso = 0 | 1 | 2;
const PASOS = ['Entrega', 'Pago', 'Revisión'] as const;
const BORRADOR = 'pp2-checkout-borrador';

// Concepto · El borrador sobrevive a un F5 (sessionStorage), pero SIN datos de tarjeta:
// esos solo viven en memoria mientras la pantalla está abierta.
function leerBorrador(): { envio: DatosEnvio; pago: DatosPago } | null {
  try {
    const crudo = sessionStorage.getItem(BORRADOR);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, cantidadTotal, vaciar } = useCart();
  const navigate = useNavigate();
  const cuenta = useConsulta(user ? CLAVES.miCuenta(user.id) : null, () => pedirMiCuenta(user!.id));

  const borrador = useRef(leerBorrador());
  const [paso, setPaso] = useState<Paso>(0);
  const [envio, setEnvio] = useState<DatosEnvio>(borrador.current?.envio ?? ENVIO_VACIO);
  const [pago, setPago] = useState<DatosPago>({ ...PAGO_VACIO, ...borrador.current?.pago });
  const [guardarDomicilio, setGuardarDomicilio] = useState(true);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<{ texto: string; volverAPago?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const prellenado = useRef(Boolean(borrador.current?.envio.calle));

  // Prellenar una sola vez con el perfil y el domicilio guardado.
  useEffect(() => {
    const c = cuenta.data;
    if (!c || prellenado.current) return;
    prellenado.current = true;
    const d = c.direccion;
    setEnvio((prev) => ({
      ...prev,
      nombre: prev.nombre || c.full_name,
      ...(d && !prev.calle ? {
        calle: d.calle, piso_depto: d.piso_depto ?? '', ciudad: d.ciudad, provincia: d.provincia,
        cp: d.codigo_postal, telefono: d.telefono ?? '',
      } : {}),
    }));
  }, [cuenta.data]);

  useEffect(() => {
    const { tarjeta_numero: _n, tarjeta_cvv: _c, tarjeta_vto: _v, tarjeta_nombre: _t, ...sinTarjeta } = pago;
    try { sessionStorage.setItem(BORRADOR, JSON.stringify({ envio, pago: sinTarjeta })); } catch { /* modo privado */ }
  }, [envio, pago]);

  // Al cambiar de paso, el foco va al título: el lector de pantalla anuncia dónde estás.
  useEffect(() => { titulo.current?.focus(); }, [paso]);

  if (items.length === 0) {
    return (
      <section className="tarjeta vacio-checkout">
        <span className="icono-grande" aria-hidden="true">🛒</span>
        <h1>Tu carrito está vacío</h1>
        <p className="vacio">Agregá productos para iniciar la compra.</p>
        <Link to="/" className="boton">Ir a la tienda</Link>
      </section>
    );
  }

  const cambiarEnvio = (campo: keyof DatosEnvio, valor: string) => {
    setEnvio((e) => ({ ...e, [campo]: valor }));
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
  };
  const cambiarPago = <K extends keyof DatosPago>(campo: K, valor: DatosPago[K]) => {
    setPago((p) => ({ ...p, [campo]: valor }));
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: undefined }));
    setAviso(null);
  };

  const continuar = () => {
    const err = paso === 0 ? validarEnvio(envio) : validarPago(pago);
    setErrores(err);
    if (Object.values(err).some(Boolean)) {
      // requestAnimationFrame: esperamos a que se pinten los mensajes antes de mover el foco.
      requestAnimationFrame(() => enfocarPrimerError(err));
      return;
    }
    setPaso((p) => (p + 1) as Paso);
  };

  const irA = (destino: Paso) => {
    if (destino < paso) { setErrores({}); setPaso(destino); }
  };

  const confirmar = async () => {
    if (enviando || !user) return;
    // Por si alguien editó el borrador o saltó pasos: revalidamos todo.
    const err = { ...validarEnvio(envio), ...validarPago(pago) };
    if (Object.values(err).some(Boolean)) {
      setErrores(err);
      setPaso(Object.keys(validarEnvio(envio)).length ? 0 : 1);
      return;
    }
    setAviso(null);
    if (pago.metodo === 'tarjeta' && esRechazada(pago.tarjeta_numero)) {
      setAviso({ texto: 'El pago fue rechazado (simulación con la tarjeta 4000 … 0002). Probá con otra tarjeta u otra forma de pago.', volverAPago: true });
      return;
    }
    setEnviando(true);
    // Concepto · Solo viajan producto_id y cantidad (precio y total los calcula la base),
    // el domicilio y el MÉTODO de pago. De la tarjeta: marca y últimos 4, nunca el número.
    const pPago = {
      metodo: pago.metodo,
      ...(pago.metodo === 'tarjeta'
        ? { marca: marcaDe(pago.tarjeta_numero), ultimos4: soloDigitos(pago.tarjeta_numero).slice(-4) }
        : {}),
      factura_nombre: pago.factura_nombre.trim() || null,
      factura_documento: pago.factura_documento || null,
      factura_domicilio: pago.factura_igual_envio ? null : pago.factura_domicilio.trim(),
    };
    const { data: pedidoId, error } = await supabase.rpc('crear_pedido', {
      p_items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
      p_envio: { ...envio, cp: envio.cp.trim().toUpperCase() },
      p_pago: pPago,
    });
    if (error) {
      setAviso({
        texto: error.code === 'P0002'
          ? 'Algún producto ya no está disponible. Volvé al carrito y quitalo.'
          : error.message || 'No se pudo completar la compra. Probá de nuevo.',
      });
      setEnviando(false);
      return;
    }
    if (guardarDomicilio) {
      // No bloquea la compra: si falla, el pedido ya quedó guardado con su domicilio.
      void guardarDireccion(user.id, {
        calle: envio.calle.trim(), piso_depto: envio.piso_depto.trim() || null, ciudad: envio.ciudad.trim(),
        provincia: envio.provincia, codigo_postal: envio.cp.trim().toUpperCase(), telefono: envio.telefono.trim() || null,
      }).catch(() => {});
    }
    invalidarTrasCompra();
    try { sessionStorage.removeItem(BORRADOR); } catch { /* noop */ }
    navigate(`/checkout/listo/${pedidoId as string}`, { replace: true });
    vaciar();
  };

  const lineas = items.map((i) => ({
    clave: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, emoji: i.emoji,
  }));
  const resumen = (
    <ResumenCompra lineas={lineas} total={subtotal} notaTotal="Total estimado. El importe final lo calcula el servidor al confirmar.">
      <Link to="/carrito" className="enlace-azul">Modificar carrito</Link>
    </ResumenCompra>
  );

  return (
    <div className="checkout">
      <header className="checkout-encabezado">
        <Link to="/" className="enlace-azul">← Seguir comprando</Link>
        <h1>Finalizar compra</h1>
        <ol className="pasos" aria-label="Pasos de la compra">
          {PASOS.map((nombre, i) => (
            <li key={nombre} className={i < paso ? 'hecho' : i === paso ? 'actual' : ''}
              aria-current={i === paso ? 'step' : undefined}>
              {i < paso ? (
                <button type="button" className="paso-boton" onClick={() => irA(i as Paso)}>
                  <span className="paso-num" aria-hidden="true">✓</span> {nombre}
                  <span className="sr-only"> (completado, volver a editar)</span>
                </button>
              ) : (
                <span className="paso-boton">
                  <span className="paso-num" aria-hidden="true">{i + 1}</span> {nombre}
                </span>
              )}
            </li>
          ))}
        </ol>
      </header>

      {/* En celular el resumen va arriba y plegado; en escritorio, a la derecha y fijo. */}
      <details className="resumen-movil tarjeta">
        <summary>Ver resumen · {cantidadTotal} {cantidadTotal === 1 ? 'unidad' : 'unidades'} · <strong>{dinero(subtotal)}</strong></summary>
        {resumen}
      </details>

      <div className="checkout-layout">
        <form className="tarjeta checkout-paso" noValidate
          onSubmit={(e) => { e.preventDefault(); if (paso < 2) continuar(); else void confirmar(); }}>
          <h2 ref={titulo} tabIndex={-1}>
            {paso === 0 && '¿Dónde lo entregamos?'}
            {paso === 1 && '¿Cómo querés pagar?'}
            {paso === 2 && 'Revisá y confirmá tu pedido'}
          </h2>

          {paso === 0 && (
            <PasoEntrega envio={envio} errores={errores} onCambio={cambiarEnvio}
              guardarDomicilio={guardarDomicilio} onGuardarDomicilio={setGuardarDomicilio}
              tieneGuardado={Boolean(cuenta.data?.direccion)} />
          )}
          {paso === 1 && (
            <PasoPago pago={pago} errores={errores} onCambio={cambiarPago} domicilioEnvio={domicilioTexto(envio)} />
          )}
          {paso === 2 && <PasoRevision envio={envio} pago={pago} onEditar={irA} />}

          {aviso && (
            <div role="alert" className="alerta error">
              {aviso.texto}
              {aviso.volverAPago && (
                <button type="button" className="secundario chico" onClick={() => { setAviso(null); irA(1); }}>
                  Cambiar forma de pago
                </button>
              )}
            </div>
          )}

          <div className="acciones-paso">
            {paso > 0 && (
              <button type="button" className="secundario" onClick={() => irA((paso - 1) as Paso)} disabled={enviando}>
                Volver
              </button>
            )}
            <button type="submit" className="comprar-grande" disabled={enviando} aria-busy={enviando}>
              {enviando ? (
                <><span className="giro" aria-hidden="true" /> Procesando pago…</>
              ) : paso === 0 ? 'Continuar al pago' : paso === 1 ? 'Revisar pedido' : `Confirmar y pagar ${dinero(subtotal)}`}
            </button>
          </div>
          {paso === 2 && (
            <p className="nota centro-texto">🔒 Compra simulada con fines educativos. No se realiza ningún cobro.</p>
          )}
        </form>

        <aside className="checkout-resumen">{resumen}</aside>
      </div>
    </div>
  );
}
