/**
 * @file graphql-ws-shims.d.ts
 * @description Shim de declaración de tipos para compatibilidad con graphql-ws v6.
 *
 * Problema: graphql-ws v6 reorganizó sus puntos de entrada. El path antiguo
 * `graphql-ws/lib/use/ws` fue reemplazado por `graphql-ws/use/ws`. Sin embargo,
 * bajo la configuración `moduleResolution: "node"` de TypeScript (que NO interpreta
 * el campo `exports` de package.json), el compilador no puede resolver el nuevo path.
 *
 * Solución: este módulo de declaración ambiental reexpone la función `useServer`
 * desde la ruta de distribución compilada (`graphql-ws/dist/use/ws`) bajo el
 * alias correcto que usa el código fuente, satisfaciendo al compilador sin
 * modificar la configuración de TypeScript del proyecto.
 */

// graphql-ws v6 moved exports from 'graphql-ws/lib/use/ws' to 'graphql-ws/use/ws'.
// This shim satisfies TypeScript under moduleResolution: "node" (which doesn't
// read the package.json `exports` field) by re-exporting the real types.
declare module 'graphql-ws/use/ws' {
  export { useServer } from 'graphql-ws/dist/use/ws';
}
