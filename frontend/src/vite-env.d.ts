/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CSV de extensiones UI a cargar. Si no está definida, se cargan todas las locales (dev). */
  readonly VITE_ENABLED_EXTENSIONS?: string;
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}
