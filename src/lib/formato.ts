const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export const dinero = (n: number | string) => moneda.format(Number(n));
export const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
