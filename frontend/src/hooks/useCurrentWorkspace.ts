/**
 * @file useCurrentWorkspace.ts
 * @description Hook que obtiene el workspace activo a partir del slug en la URL,
 * lo persiste en el store de auth y redirige a /404 si no existe.
 *
 * Este hook se monta en `WorkspaceLayout` (App.tsx) y corre para todas las rutas
 * protegidas bajo `/:workspaceSlug`. Es el responsable de:
 * 1. Resolver el workspace por slug desde el servidor.
 * 2. Actualizar `currentWorkspaceSlug` en el store para redirecciones futuras.
 * 3. Detectar slugs inválidos y redirigir a /404 automáticamente.
 *
 * Se usa `fetchPolicy: 'network-only'` para garantizar que el workspace
 * siempre refleje los datos actuales del servidor (ej. si el slug cambia).
 */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { GET_WORKSPACE_BY_SLUG } from '@/graphql/workspace/workspace.queries';
import { useAuthStore } from '@/store/auth.store';
import type { Workspace } from '@/types/api.types';

/**
 * Tipo de respuesta de la query `workspaceBySlug`.
 * El campo puede ser `null` si el slug no corresponde a ningún workspace.
 */
interface WorkspaceBySlugData {
  workspaceBySlug: Workspace | null;
}

/**
 * Hook que resuelve y expone el workspace activo desde el slug en la URL.
 *
 * @returns Objeto con el workspace, su slug, y el estado de la query.
 *          `workspace` es `null` mientras carga o si no existe.
 *
 * @example
 * const { workspace, loading } = useCurrentWorkspace();
 * if (loading) return <Spinner />;
 */
export function useCurrentWorkspace() {
  // Slug del workspace extraído del segmento de URL `/:workspaceSlug`
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const { setCurrentWorkspaceSlug } = useAuthStore();

  const { data, loading, error } = useQuery<WorkspaceBySlugData>(GET_WORKSPACE_BY_SLUG, {
    variables: { slug: workspaceSlug },
    // Omitir la query si no hay slug (rutas sin este parámetro)
    skip: !workspaceSlug,
    // `network-only` evita servir un workspace obsoleto desde el caché si el slug cambia
    fetchPolicy: 'network-only',
  });

  const workspace = data?.workspaceBySlug ?? null;

  // Persistir el slug en el store cuando cambia, para usarlo en redirecciones
  // futuras desde RootRedirect sin necesitar una query de red adicional.
  useEffect(() => {
    if (workspaceSlug) {
      setCurrentWorkspaceSlug(workspaceSlug);
    }
  }, [workspaceSlug, setCurrentWorkspaceSlug]);

  // Redirigir a /404 si la query terminó sin error pero el workspace no existe.
  // Se comprueba `data.workspaceBySlug === null` explícitamente (y no solo `!workspace`)
  // para distinguir entre "aún cargando" y "slug no encontrado".
  useEffect(() => {
    if (!loading && !error && workspaceSlug && data && data.workspaceBySlug === null) {
      navigate('/404', { replace: true });
    }
  }, [loading, error, workspaceSlug, data, navigate]);

  return {
    workspace,
    // Normalizar a null para que los consumidores no manejen `undefined`
    workspaceSlug: workspaceSlug ?? null,
    loading,
    error,
  };
}
