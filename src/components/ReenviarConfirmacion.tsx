import { useEffect, useState, type FormEvent } from 'react';
import { Campo } from './Campo';
import { ESPERA_REENVIO_S, reenviarConfirmacion } from '../lib/auth';
import { mensajeErrorAuth } from '../lib/retornoAuth';

interface Props {
  // Si no se pasa, se pide el email (por ejemplo, al volver de un enlace vencido).
  email?: string;
  // Segundos de espera al montar (recién se mandó un mail: no tiene sentido reenviar ya).
  esperaInicial?: number;
}

// Concepto · Reenviar con "enfriamiento": el botón se deshabilita y muestra la cuenta
// regresiva. Evita clics repetidos que Supabase igual rechazaría (límite por email y por hora).
export function ReenviarConfirmacion({ email, esperaInicial = 0 }: Props) {
  const [emailLibre, setEmailLibre] = useState('');
  const [restante, setRestante] = useState(esperaInicial);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const destino = (email ?? emailLibre).trim();

  useEffect(() => {
    if (restante <= 0) return;
    const t = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restante]);

  const reenviar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (enviando || restante > 0) return;
    if (!/^\S+@\S+\.\S+$/.test(destino)) {
      setError('Escribí el email con el que te registraste.');
      return;
    }
    setEnviando(true);
    setError(null);
    setMensaje(null);
    const { error: err } = await reenviarConfirmacion(destino);
    if (err) {
      setError(mensajeErrorAuth(err));
      const espera = /after (\d+) seconds?/i.exec(err.message)?.[1];
      if (espera) setRestante(Number(espera));
    } else {
      setMensaje(`Listo: te mandamos un enlace nuevo a ${destino}. Usá el último que llegue.`);
      setRestante(ESPERA_REENVIO_S);
    }
    setEnviando(false);
  };

  const textoBoton = enviando ? 'Reenviando…' : restante > 0 ? `Reenviar mail (${restante} s)` : 'Reenviar mail';

  return (
    <form className="reenviar" onSubmit={reenviar} noValidate>
      <p className="reenviar-titulo">¿No te llegó o se venció?</p>
      {email === undefined && (
        <Campo
          nombre="email-reenvio"
          etiqueta="Email con el que te registraste"
          type="email"
          autoComplete="email"
          value={emailLibre}
          onChange={(e) => setEmailLibre(e.target.value)}
        />
      )}
      <button type="submit" className="secundario" disabled={enviando || restante > 0} aria-disabled={enviando || restante > 0}>
        {textoBoton}
      </button>
      <p className="nota" role="status" aria-live="polite">{mensaje ?? ''}</p>
      {error && <p role="alert" className="alerta">{error}</p>}
    </form>
  );
}
