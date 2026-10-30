import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Concepto · Medimos manualChunks para react/router/supabase-js: el gzip del
  // primer load no baja (separar supabase-js peor: anula tree-shaking). Vite
  // ya parte Administración y Mis pedidos con React.lazy. Lo dejamos así.
});
