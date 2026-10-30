import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useConsulta } from '../../hooks/useConsulta';
import { CLAVES, guardarDireccion, guardarNombre, pedirMiCuenta, pedirMisPedidos } from '../../lib/consultas';
import { Campo, CampoSelect, enfocarPrimerError } from '../../components/Campo';
import { EstadoBadge } from '../../components/EstadoBadge';
import { FormSeguimiento } from '../../components/FormSeguimiento';
import { EsqueletoFilas } from '../../components/Esqueleto';
import { dinero, facturaDe, fechaCorta, numeroPedido } from '../../lib/formato';
import { PROVINCIAS, type Direccion } from '../../types';
import { CP_VALIDO, TELEFONO_VALIDO } from '../checkout/validacion';

type Aviso = { tipo: 'exito' | 'error'; texto: string } | null;

export function MiCuenta() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const cuenta = useConsulta(uid ? CLAVES.miCuenta(uid) : null, () => pedirMiCuenta(uid));
  const historial = useConsulta(CLAVES.misPedidos(1), () => pedirMisPedidos(1));

  return (
    <div className="cuenta">
      <header>
        <h1>Mi cuenta</h1>
        <p className="vacio">Tus datos, tu domicilio de entrega y tus compras.</p>
      </header>
      {cuenta.error && <p role="alert" className="alerta error">{cuenta.error}</p>}
      <div className="cuenta-grilla">
        <div className="cuenta-columna">
          <DatosPersonales uid={uid} nombreActual={cuenta.data?.full_name} cargando={cuenta.cargando} />
          <CambioEmail emailActual={user?.email ?? ''} pendiente={user?.new_email ?? null} />
          <DomicilioEntrega uid={uid} actual={cuenta.data?.direccion ?? null} cargando={cuenta.cargando} />
        </div>
        <div className="cuenta-columna">
          <section className="tarjeta" aria-labelledby="titulo-historial">
            <div className="encabezado-panel">
              <h2 id="titulo-historial">Historial de compras</h2>
              <Link to="/mis-pedidos" className="enlace-azul">Ver todos</Link>
            </div>
            <ul className="historial" aria-busy={historial.cargando}>
              {historial.cargando && <li><table><tbody><EsqueletoFilas columnas={2} filas={3} /></tbody></table></li>}
              {(historial.data?.pedidos ?? []).slice(0, 5).map((p) => {
                const factura = facturaDe(p);
                return (
                  <li key={p.id}>
                    <div>
                      <strong>Pedido {numeroPedido(p.numero)}</strong> <EstadoBadge estado={p.estado} />
                      <small className="nota">{fechaCorta(p.created_at)} · {dinero(p.total)}</small>
                    </div>
                    <div className="acciones-fila">
                      <Link to={`/pedidos/${p.id}`}>Seguimiento</Link>
                      {factura && <Link to={`/pedidos/${p.id}/factura`}>Factura</Link>}
                    </div>
                  </li>
                );
              })}
              {!historial.cargando && (historial.data?.pedidos.length ?? 0) === 0 && (
                <li className="vacio">Todavía no compraste nada. <Link to="/">Ir a la tienda</Link></li>
              )}
            </ul>
          </section>
          <FormSeguimiento />
        </div>
      </div>
    </div>
  );
}

function DatosPersonales({ uid, nombreActual, cargando }: { uid: string; nombreActual?: string; cargando: boolean }) {
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (nombreActual) setNombre(nombreActual); }, [nombreActual]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (limpio.length < 2 || limpio.length > 80) { setAviso({ tipo: 'error', texto: 'Entre 2 y 80 caracteres.' }); return; }
    setGuardando(true);
    setAviso(null);
    try {
      await guardarNombre(uid, limpio);
      setAviso({ tipo: 'exito', texto: 'Nombre actualizado.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta formulario-cuenta" onSubmit={onSubmit} aria-labelledby="titulo-datos">
      <h2 id="titulo-datos">Datos personales</h2>
      <Campo nombre="full_name" etiqueta="Nombre y apellido" autoComplete="name" value={nombre}
        disabled={cargando} onChange={(e) => setNombre(e.target.value)}
        error={aviso?.tipo === 'error' ? aviso.texto : undefined} />
      {aviso?.tipo === 'exito' && <p role="status" className="exito">{aviso.texto}</p>}
      <button type="submit" disabled={guardando || cargando || nombre.trim() === nombreActual}>
        {guardando ? 'Guardando…' : 'Guardar nombre'}
      </button>
    </form>
  );
}

function CambioEmail({ emailActual, pendiente }: { emailActual: string; pendiente: string | null }) {
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nuevo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) { setAviso({ tipo: 'error', texto: 'Escribí un email válido.' }); return; }
    if (nuevo === emailActual.toLowerCase()) { setAviso({ tipo: 'error', texto: 'Es el mismo email que ya usás.' }); return; }
    setEnviando(true);
    setAviso(null);
    // Concepto · El email vive en Supabase Auth (auth.users), no en profiles. updateUser
    // manda un enlace de confirmación; recién al confirmarlo cambia, y un trigger copia
    // el valor nuevo a profiles.email. Hasta entonces seguís entrando con el actual.
    const { error } = await supabase.auth.updateUser(
      { email: nuevo },
      { emailRedirectTo: `${window.location.origin}/cuenta` },
    );
    setEnviando(false);
    if (error) { setAviso({ tipo: 'error', texto: error.message }); return; }
    setEmail('');
    setAviso({ tipo: 'exito', texto: `Listo. Te mandamos un enlace a ${nuevo}. Abrilo para confirmar el cambio.` });
  };

  return (
    <form className="tarjeta formulario-cuenta" onSubmit={onSubmit} aria-labelledby="titulo-email">
      <h2 id="titulo-email">Email</h2>
      <p>Actual: <strong>{emailActual}</strong></p>
      {pendiente && (
        <p className="alerta info">Cambio pendiente a <strong>{pendiente}</strong>: falta confirmar el enlace que te mandamos.</p>
      )}
      <Campo nombre="email_nuevo" etiqueta="Email nuevo" type="email" autoComplete="email" value={email}
        onChange={(e) => { setEmail(e.target.value); setAviso(null); }}
        error={aviso?.tipo === 'error' ? aviso.texto : undefined}
        ayuda="Te llega un mail de confirmación (según la configuración del proyecto, también al email actual). El cambio se aplica al confirmar. Las cuentas demo (@demo.test) no reciben correos." />
      {aviso?.tipo === 'exito' && <p role="status" className="exito">{aviso.texto}</p>}
      <button type="submit" className="secundario" disabled={enviando || !email}>
        {enviando ? 'Enviando…' : 'Cambiar email'}
      </button>
    </form>
  );
}

const DIRECCION_VACIA: Direccion = { calle: '', piso_depto: '', ciudad: '', provincia: '', codigo_postal: '', telefono: '' };

function DomicilioEntrega({ uid, actual, cargando }: { uid: string; actual: Direccion | null; cargando: boolean }) {
  const [d, setD] = useState<Direccion>(DIRECCION_VACIA);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [aviso, setAviso] = useState<Aviso>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (actual) setD({ ...actual, piso_depto: actual.piso_depto ?? '', telefono: actual.telefono ?? '' }); }, [actual]);

  const cambiar = (campo: keyof Direccion, valor: string) => {
    setD((prev) => ({ ...prev, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
    setAviso(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string | undefined> = {};
    if (d.calle.trim().length < 3) err.calle = 'Indicá calle y número.';
    if (d.ciudad.trim().length < 2) err.ciudad = 'Indicá la localidad.';
    if (!d.provincia) err.provincia = 'Elegí la provincia.';
    if (!CP_VALIDO.test(d.codigo_postal.trim())) err.codigo_postal = 'Ej.: 1406 o C1406ABC.';
    if (d.telefono?.trim() && !TELEFONO_VALIDO.test(d.telefono.trim())) err.telefono = 'Solo números, espacios, +, ( ) y guiones.';
    setErrores(err);
    if (Object.values(err).some(Boolean)) { requestAnimationFrame(() => enfocarPrimerError(err)); return; }
    setGuardando(true);
    try {
      await guardarDireccion(uid, {
        calle: d.calle.trim(), piso_depto: d.piso_depto?.trim() || null, ciudad: d.ciudad.trim(),
        provincia: d.provincia, codigo_postal: d.codigo_postal.trim().toUpperCase(), telefono: d.telefono?.trim() || null,
      });
      setAviso({ tipo: 'exito', texto: 'Domicilio guardado. Lo usamos para prellenar tus próximas compras.' });
    } catch (er) {
      setAviso({ tipo: 'error', texto: er instanceof Error ? er.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta formulario-cuenta" onSubmit={onSubmit} noValidate aria-labelledby="titulo-domicilio">
      <h2 id="titulo-domicilio">Domicilio de entrega</h2>
      <fieldset className="grilla-campos" disabled={cargando}>
        <Campo nombre="calle" etiqueta="Calle y número" autoComplete="address-line1" value={d.calle}
          error={errores.calle} onChange={(e) => cambiar('calle', e.target.value)} ancho="medio" />
        <Campo nombre="piso_depto" etiqueta="Piso / depto (opcional)" autoComplete="address-line2" value={d.piso_depto ?? ''}
          onChange={(e) => cambiar('piso_depto', e.target.value)} ancho="medio" />
        <Campo nombre="ciudad" etiqueta="Localidad" autoComplete="address-level2" value={d.ciudad}
          error={errores.ciudad} onChange={(e) => cambiar('ciudad', e.target.value)} ancho="medio" />
        <CampoSelect nombre="provincia" etiqueta="Provincia" value={d.provincia} error={errores.provincia}
          onChange={(e) => cambiar('provincia', e.target.value)} ancho="medio">
          <option value="">Elegí…</option>
          {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
        </CampoSelect>
        <Campo nombre="codigo_postal" etiqueta="Código postal" autoComplete="postal-code" maxLength={8} value={d.codigo_postal}
          error={errores.codigo_postal} onChange={(e) => cambiar('codigo_postal', e.target.value)} ancho="medio" />
        <Campo nombre="telefono" etiqueta="Teléfono (opcional)" type="tel" autoComplete="tel" value={d.telefono ?? ''}
          error={errores.telefono} onChange={(e) => cambiar('telefono', e.target.value)} ancho="medio" />
      </fieldset>
      {aviso && <p role={aviso.tipo === 'error' ? 'alert' : 'status'} className={aviso.tipo === 'error' ? 'alerta error' : 'exito'}>{aviso.texto}</p>}
      <button type="submit" disabled={guardando || cargando}>{guardando ? 'Guardando…' : actual ? 'Guardar cambios' : 'Guardar domicilio'}</button>
      <p className="nota">Los pedidos ya hechos conservan el domicilio con el que se compraron.</p>
    </form>
  );
}
