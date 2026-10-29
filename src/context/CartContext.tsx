import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Producto } from '../types';

export interface ItemCarrito {
  producto_id: string;
  nombre: string;
  precio: number;
  stock: number;
  emoji: string;
  cantidad: number;
}

interface CartContextType {
  items: ItemCarrito[];
  agregar: (p: Producto) => void;
  setCantidad: (id: string, cantidad: number) => void;
  quitar: (id: string) => void;
  vaciar: () => void;
  subtotal: number;
  cantidadTotal: number;
}

const CLAVE = 'carrito-pp2-starter';
const CartContext = createContext<CartContextType | undefined>(undefined);

function leer(): ItemCarrito[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? '[]'); } catch { return []; }
}

// Concepto · El carrito es 100 % local: agregar, + y − cambian el estado al toque.
// No hay fetch. Los precios guardados NO son confiables: al comprar, crear_pedido()
// los ignora y recalcula con la fila real de productos (stock + precio).
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>(leer);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* modo privado */ }
  }, [items]);

  const limitar = (n: number, stock: number) => Math.max(1, Math.min(n, stock, 100));

  const agregar = (p: Producto) => setItems((prev) => {
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
  });
  const setCantidad = (id: string, cantidad: number) =>
    setItems((prev) => prev.map((i) => i.producto_id === id ? { ...i, cantidad: limitar(cantidad, i.stock) } : i));
  const quitar = (id: string) => setItems((prev) => prev.filter((i) => i.producto_id !== id));
  const vaciar = () => setItems([]);

  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cantidadTotal = items.reduce((s, i) => s + i.cantidad, 0);

  return (
    <CartContext.Provider value={{ items, agregar, setCantidad, quitar, vaciar, subtotal, cantidadTotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de un CartProvider');
  return ctx;
}
