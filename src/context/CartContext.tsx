import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Producto } from '../types';

export interface ItemCarrito {
  producto_id: string;
  nombre: string;
  precio: number;
  stock: number;
  emoji: string;
  cantidad: number;
}

interface CartActions {
  agregar: (p: Producto) => void;
  setCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
}

interface CartMeta {
  subtotal: number;
  cantidadTotal: number;
}

const CLAVE = 'carrito-pp2-starter';
const CartItemsContext = createContext<ItemCarrito[] | undefined>(undefined);
const CartMetaContext = createContext<CartMeta | undefined>(undefined);
const CartActionsContext = createContext<CartActions | undefined>(undefined);

function leer(): ItemCarrito[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); } catch { return []; }
}

function exigir<T>(ctx: T | undefined, hook: string): T {
  if (!ctx) throw new Error(`${hook} debe usarse dentro de un CartProvider`);
  return ctx;
}

// Concepto · Tres contextos: las acciones no cambian de identidad, el badge de la
// barra solo mira cantidadTotal, y la grilla no se entera de cada tecla del stepper
// si la tarjeta está memorizada (solo re-pinta la que cambió de cantidad).
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(leer);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* modo privado */ }
  }, [items]);

  const limitar = (n: number, stock: number) => Math.max(1, Math.min(n, stock, 100));

  const agregar = useCallback((p: Producto) => setItems((prev) => {
    const existe = prev.find((i) => i.producto_id === p.id);
    if (existe) {
      return prev.map((i) => i.producto_id === p.id
        ? { ...i, cantidad: limitar(i.cantidad + 1, p.stock), stock: p.stock }
        : i);
    }
    return [...prev, {
      producto_id: p.id, nombre: p.nombre, precio: Number(p.precio),
      stock: p.stock, emoji: p.emoji, cantidad: 1,
    }];
  }), []);

  const setCantidad = useCallback((id: string, cantidad: number) => {
    setItems((prev) => prev.map((i) => i.producto_id === id ? { ...i, cantidad: limitar(cantidad, i.stock) } : i));
  }, []);

  const quitar = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.producto_id !== id));
  }, []);

  const vaciar = useCallback(() => setItems([]), []);

  const actions = useMemo<CartActions>(
    () => ({ agregar, setCantidad, quitar, vaciar }),
    [agregar, setCantidad, quitar, vaciar],
  );

  const meta = useMemo<CartMeta>(() => ({
    subtotal: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
    cantidadTotal: items.reduce((s, i) => s + i.cantidad, 0),
  }), [items]);

  return (
    <CartActionsContext.Provider value={actions}>
      <CartItemsContext.Provider value={items}>
        <CartMetaContext.Provider value={meta}>
          {children}
        </CartMetaContext.Provider>
      </CartItemsContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCartItems() {
  return exigir(useContext(CartItemsContext), 'useCartItems');
}

export function useCartMeta() {
  return exigir(useContext(CartMetaContext), 'useCartMeta');
}

export function useCartActions() {
  return exigir(useContext(CartActionsContext), 'useCartActions');
}

export function useCart() {
  const items = useCartItems();
  const meta = useCartMeta();
  const actions = useCartActions();
  return { items, ...meta, ...actions };
}
