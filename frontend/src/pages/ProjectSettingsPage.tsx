/**
 * @file ProjectSettingsPage.tsx
 * @description Página de configuración de un proyecto. Agrupa en secciones
 * todas las opciones de administración disponibles para el proyecto activo:
 *
 * - **General**: edición del nombre del proyecto (la clave/key es inmutable).
 * - **Miembros del equipo**: lista de miembros con roles, invitación y eliminación.
 * - **Definition of Done (DoD)**: criterios de aceptación estándar del proyecto.
 * - **Auditoría y exportación**: descarga del historial de actividad en CSV.
 * - **Integración GitHub**: vinculación de un repositorio y vista de commits recientes.
 * - **Zona de peligro**: eliminación permanente del proyecto.
 *
 * La página obtiene los datos del proyecto y su equipo con una sola query GraphQL
 * (`GET_PROJECT_SETTINGS`) y usa `refetchQueries` en las mutaciones para mantener
 * la UI sincronizada sin gestionar el caché manualmente.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { buildRoute, ROUTES } from '@/constants/routes';
import {
  GITHUB_LINKED_REPO,
  GITHUB_ACTIVITY,
  LINK_GITHUB_REPO,
} from '@/graphql/integrations/integrations.queries';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { Badge } from '@/components/atoms/Badge/Badge';
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog/ConfirmDialog';
import { useUIStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import { InviteMemberModal } from '@/features/team/components/InviteMemberModal';
import { REMOVE_MEMBER } from '@/graphql/team/team.operations';
import { DodSettings } from '@/features/definition-of-done/DodSettings';
import { useLazyQuery } from '@apollo/client/react';
import { EXPORT_AUDIT_CSV } from '@/graphql/audit/audit.queries';
import type { TeamRole } from '@/types/api.types';
import styles from './ProjectSettingsPage.module.scss';

/**
 * Query GraphQL para obtener la configuración completa del proyecto.
 * Incluye el equipo y sus miembros para poder renderizar la sección de gestión
 * de equipo sin necesitar una query adicional.
 * Se usa `$id: ID!` para que Apollo pueda normalizar el caché por entidad.
 */
const GET_PROJECT_SETTINGS = gql`
  query GetProjectSettings($id: ID!) {
    project(id: $id) {
      id name key teamId
      team {
        id name workspaceId
        members {
          id role joinedAt
          user { id name email avatarUrl }
        }
      }
    }
  }
`;

/**
 * Mutación para actualizar propiedades del proyecto.
 * Solo se puede cambiar el `name`; el `key` es inmutable una vez creado el proyecto
 * para no romper referencias externas (integraciones, URLs, etc.).
 */
const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: ID!, $name: String) {
    updateProject(id: $id, name: $name) {
      id name key
    }
  }
`;

/**
 * Mutación para eliminar un proyecto de forma permanente.
 * Devuelve un booleano (no el objeto eliminado) porque el proyecto ya no existe
 * tras la operación y no tiene sentido devolver sus datos.
 */
const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`;

/**
 * Página de configuración del proyecto activo.
 *
 * Gestiona múltiples secciones de configuración en una sola página para que
 * el administrador del proyecto no necesite navegar entre varias rutas.
 * Cada sección tiene su propio estado local y mutaciones independientes.
 *
 * @returns JSX con todas las secciones de configuración o un spinner de carga.
 */
export default function ProjectSettingsPage() {
  const { t } = useTranslation();
  const { projectId } = useCurrentProject();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuthStore();

  /** Valor editable del nombre del proyecto en el formulario de configuración general. */
  const [name, setName] = useState('');

  /** Controla la visibilidad del modal de invitación de nuevos miembros. */
  const [showInvite, setShowInvite] = useState(false);

  /**
   * Almacena los datos del miembro a eliminar cuando el usuario inicia el flujo de
   * confirmación. `null` significa que no hay eliminación pendiente (dialog cerrado).
   */
  const [confirmRemove, setConfirmRemove] = useState<{ teamId: string; userId: string; name: string } | null>(null);

  /** Controla la visibilidad del diálogo de confirmación de eliminación del proyecto. */
  const [showDeleteProject, setShowDeleteProject] = useState(false);

  const { data, loading } = useQuery<any>(GET_PROJECT_SETTINGS, {
    variables: { id: projectId },
    // Omitir la query si aún no se conoce el projectId (puede ocurrir al montar
    // el componente antes de que el router haya propagado los params)
    skip: !projectId,
  });

  const [updateProject, { loading: saving }] = useMutation<any>(UPDATE_PROJECT, {
    // Refetch para sincronizar el nombre actualizado en el formulario y en el sidebar
    refetchQueries: [{ query: GET_PROJECT_SETTINGS, variables: { id: projectId } }],
  });

  // useLazyQuery en lugar de useQuery porque la descarga CSV es una acción manual,
  // no una carga automática al montar la página. Esto evita ejecutar una query
  // pesada que genere el CSV sin que el usuario lo haya solicitado.
  const [fetchCsvQuery] = useLazyQuery<any>(EXPORT_AUDIT_CSV, { fetchPolicy: 'network-only' });

  /**
   * Descarga el CSV de auditoría del proyecto usando una técnica de descarga programática.
   *
   * La API del backend devuelve el contenido CSV como string en el campo
   * `exportProjectAuditCsv`. Se crea un Blob, se genera una URL temporal con
   * `createObjectURL`, se simula un clic en un elemento `<a>` invisible y se
   * revoca la URL para liberar memoria. Este patrón evita abrir una pestaña nueva.
   *
   * @param vars - Variables de la query GraphQL que incluyen el `projectId`.
   */
  function fetchCsv(vars: { variables: { projectId: string | null } }) {
    fetchCsvQuery(vars as any).then(({ data: d }) => {
      if (!d?.exportProjectAuditCsv) return;
      // Crear un objeto Blob con el CSV para que el navegador lo trate como descarga
      const blob = new Blob([d.exportProjectAuditCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${projectId}.csv`;
      // Clic programático para disparar la descarga sin intervención del usuario
      a.click();
      // Revocar la URL después del clic para liberar la referencia en memoria
      URL.revokeObjectURL(url);
    });
  }

  const [removeMember, { loading: removing }] = useMutation<any>(REMOVE_MEMBER, {
    refetchQueries: [{ query: GET_PROJECT_SETTINGS, variables: { id: projectId } }],
  });

  const [deleteProject, { loading: deleting }] = useMutation<any>(DELETE_PROJECT, {
    onCompleted: () => {
      addToast(t('settings.projectDeleted'), 'success');
      // Redirigir al dashboard del workspace tras eliminar el proyecto,
      // ya que la ruta del proyecto ya no existe
      navigate(buildRoute(ROUTES.DASHBOARD, { workspaceSlug: workspaceSlug ?? '' }));
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  // --- Estado para la integración de GitHub ---

  /** URL del repositorio de GitHub que el usuario quiere vincular. */
  const [githubRepoUrl, setGithubRepoUrl] = useState('');

  /** Indica si el repositorio fue guardado exitosamente en esta sesión. */
  const [githubSaved, setGithubSaved] = useState(false);

  /** Datos del repositorio GitHub actualmente vinculado al proyecto (puede ser null). */
  const { data: linkedRepoData } = useQuery<{ githubLinkedRepo: string | null }>(
    GITHUB_LINKED_REPO,
    { variables: { projectId }, skip: !projectId },
  );

  /**
   * Actividad reciente de GitHub (últimos commits) del repositorio vinculado.
   * Se omite la query si no hay repositorio vinculado para evitar errores del servidor
   * y peticiones innecesarias.
   */
  const { data: githubActivityData, loading: githubActivityLoading } = useQuery<{
    githubActivity: { sha: string; message: string; author: string; date: string; url: string }[];
  }>(
    GITHUB_ACTIVITY,
    { variables: { projectId }, skip: !projectId || !linkedRepoData?.githubLinkedRepo },
  );

  const [linkGithubRepo, { loading: linkingRepo }] = useMutation<any>(LINK_GITHUB_REPO, {
    // Refetch tanto el repo vinculado como la actividad para mostrar los nuevos datos
    refetchQueries: ['GithubLinkedRepo', 'GithubActivity'],
    onCompleted: () => setGithubSaved(true),
  });

  const project = data?.project;

  /**
   * Sincronizar el estado local `name` con el nombre del proyecto cargado desde
   * la API. Se usa `useEffect` en lugar de inicializar con `data?.project?.name`
   * directamente porque los datos llegan de forma asíncrona tras el montaje.
   */
  useEffect(() => {
    if (project) setName(project.name);
  }, [project]);

  /**
   * Inicia el flujo de confirmación para eliminar un miembro del equipo.
   * Almacena los datos necesarios para la mutación y el mensaje del diálogo,
   * sin ejecutar la eliminación todavía (requiere confirmación del usuario).
   *
   * @param teamId - ID del equipo del que se elimina el miembro.
   * @param userId - ID del usuario a eliminar.
   * @param memberName - Nombre del miembro para mostrarlo en el mensaje de confirmación.
   */
  function handleRemoveMember(teamId: string, userId: string, memberName: string) {
    setConfirmRemove({ teamId, userId, name: memberName });
  }

  /**
   * Ejecuta la eliminación del miembro tras la confirmación del usuario en el diálogo.
   * Usa try/finally para garantizar que el diálogo siempre se cierra, tanto en éxito
   * como en error, evitando que quede bloqueado si la mutación falla.
   */
  async function handleConfirmRemove() {
    if (!confirmRemove) return;
    try {
      await removeMember({ variables: { teamId: confirmRemove.teamId, userId: confirmRemove.userId } });
      addToast(t('settings.memberRemoved', { name: confirmRemove.name }), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      // Siempre cerrar el diálogo, independientemente del resultado
      setConfirmRemove(null);
    }
  }

  /**
   * Guarda los cambios del nombre del proyecto.
   * Valida que el nombre no esté vacío y que haya cambiado respecto al valor
   * original (el botón de guardar también está deshabilitado en ese caso,
   * pero esta doble validación protege ante envíos programáticos).
   */
  async function handleSave() {
    if (!projectId || !name.trim()) return;
    try {
      await updateProject({ variables: { id: projectId, name: name.trim() } });
      addToast(t('settings.projectUpdated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Mostrar spinner mientras se carga la configuración del proyecto
  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Si la query terminó pero no devolvió proyecto (ID inválido o sin permisos), no renderizar
  if (!project) return null;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('settings.projectSettings')}</h1>

      {/* Sección: Configuración general del proyecto */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.general')}</h2>
        <div className={styles.form}>
          <FormField label={t('settings.projectName')} htmlFor="proj-name" required>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          {/* La clave del proyecto es de solo lectura: se genera al crear el proyecto
              y no puede cambiarse para mantener consistencia en integraciones externas */}
          <FormField label={t('settings.projectKey')} htmlFor="proj-key" hint={t('settings.projectKeyHint')}>
            <Input id="proj-key" value={project.key} disabled />
          </FormField>
          <div>
            {/* El botón se deshabilita si el nombre está vacío O no ha cambiado,
                para evitar llamadas innecesarias al servidor con el mismo valor */}
            <Button onClick={handleSave} loading={saving} disabled={!name.trim() || name === project.name}>
              {t('settings.saveChanges')}
            </Button>
          </div>
        </div>
      </section>

      {/* Sección: Gestión de miembros del equipo */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {t('settings.team', { name: project.team.name })}
            <span className={styles.memberCount}>{t('settings.membersCount', { count: project.team.members.length })}</span>
          </h2>
          <Button size="sm" variant="secondary" onClick={() => setShowInvite(true)}>
            + {t('settings.inviteMember')}
          </Button>
        </div>
        <div className={styles.memberList}>
          {project.team.members.map((m: { id: string; role: TeamRole; userId: string; user: { id: string; name: string; email: string; avatarUrl?: string | null } }) => (
            <div key={m.id} className={styles.memberRow}>
              <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="sm" />
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>{m.user.name}</span>
                <span className={styles.memberEmail}>{m.user.email}</span>
              </div>
              <Badge variant={m.role}>{t(`roles.${m.role}`)}</Badge>
              {/* Solo mostrar el botón de eliminar para miembros distintos al usuario actual.
                  El usuario no puede eliminarse a sí mismo para evitar quedarse sin acceso. */}
              {m.user.id !== currentUser?.id && (
                <button
                  className={styles.removeMemberBtn}
                  title={t('settings.removeMember')}
                  disabled={removing}
                  onClick={() => handleRemoveMember(project.team.id, m.user.id, m.user.name)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Modal de invitación: se monta condicionalmente para limpiar su estado al cerrar */}
      {showInvite && (
        <InviteMemberModal
          workspaceId={project.team.workspaceId}
          onClose={() => setShowInvite(false)}
          refetchQueries={['GetProjectSettings']}
        />
      )}

      {/* Sección: Definición de Done — componente especializado con su propia lógica */}
      <section className={styles.section}>
        <DodSettings projectId={projectId ?? ''} />
      </section>

      {/* Sección: Auditoría y exportación de actividad */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.audit')}</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '0.75rem' }}>
          {t('settings.auditDesc')}
        </p>
        {/* La descarga CSV se dispara con fetchCsv que usa un elemento <a> temporal */}
        <Button variant="secondary" onClick={() => fetchCsv({ variables: { projectId } })}>
          {t('settings.exportAudit')}
        </Button>
      </section>

      {/* Sección: Integración con GitHub */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('settings.github')}</h2>

        {/* Mostrar el repo vinculado actual si existe, como referencia antes de cambiar */}
        {linkedRepoData?.githubLinkedRepo && (
          <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '12px' }}>
            {t('settings.githubLinked')}{' '}
            <a
              href={linkedRepoData.githubLinkedRepo}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#6366F1' }}
            >
              {linkedRepoData.githubLinkedRepo}
            </a>
          </p>
        )}

        {/* Formulario inline (sin usar el componente FormField) para mayor control
            sobre el layout horizontal del campo + botón */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569', display: 'block', marginBottom: '6px' }}>
              {t('settings.githubRepoUrl')}
            </label>
            <input
              type="url"
              placeholder="https://github.com/org/repo"
              value={githubRepoUrl}
              onChange={(e) => { setGithubRepoUrl(e.target.value); setGithubSaved(false); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* El color del botón cambia dinámicamente según su estado habilitado/deshabilitado
              para reforzar visualmente cuándo la acción está disponible */}
          <button
            disabled={!githubRepoUrl.trim() || linkingRepo}
            onClick={async () => {
              if (!projectId || !githubRepoUrl.trim()) return;
              setGithubSaved(false);
              await linkGithubRepo({ variables: { projectId, repoUrl: githubRepoUrl.trim() } });
            }}
            style={{
              padding: '8px 16px',
              background: githubRepoUrl.trim() && !linkingRepo ? '#6366F1' : '#CBD5E1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: githubRepoUrl.trim() && !linkingRepo ? 'pointer' : 'not-allowed',
            }}
          >
            {linkingRepo ? t('settings.githubLinking') : t('settings.githubLink')}
          </button>
        </div>

        {/* Confirmación visual de guardado exitoso */}
        {githubSaved && (
          <p style={{ fontSize: '0.8125rem', color: '#22C55E' }}>{t('settings.githubSaved')}</p>
        )}

        {/* Lista de commits recientes: solo se muestra si hay un repo vinculado */}
        {linkedRepoData?.githubLinkedRepo && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
              {t('settings.githubRecentCommits')}
            </p>
            {githubActivityLoading ? (
              <p style={{ fontSize: '0.875rem', color: '#64748B' }}>{t('settings.githubLoading')}</p>
            ) : (githubActivityData?.githubActivity ?? []).length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#94A3B8' }}>{t('settings.githubNoActivity')}</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {/* Limitar a los 5 commits más recientes para no sobrecargar la sección */}
                {(githubActivityData?.githubActivity ?? []).slice(0, 5).map((commit) => (
                  <li
                    key={commit.sha}
                    style={{
                      padding: '10px 0',
                      borderBottom: '1px solid #F1F5F9',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Mostrar solo los primeros 7 caracteres del SHA (convención estándar de git) */}
                    <code style={{ fontSize: '0.75rem', color: '#6366F1', minWidth: '58px', paddingTop: '2px' }}>
                      {commit.sha.slice(0, 7)}
                    </code>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#1E293B' }}>{commit.message}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                        {commit.author} · {new Date(commit.date).toLocaleDateString()}
                      </p>
                    </div>
                    {/* Enlace externo al commit en GitHub, solo si la URL está disponible */}
                    {commit.url && (
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#6366F1', paddingTop: '2px' }}
                      >
                        {t('settings.githubView')}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Sección: Zona de peligro — acciones destructivas e irreversibles */}
      <section className={styles.dangerSection}>
        <h2 className={styles.dangerTitle}>{t('settings.dangerZone')}</h2>
        <div className={styles.dangerRow}>
          <div>
            <p className={styles.dangerLabel}>{t('settings.deleteProject')}</p>
            <p className={styles.dangerDesc}>{t('settings.deleteProjectDesc')}</p>
          </div>
          {/* El botón `danger` abre un diálogo de confirmación, no elimina directamente */}
          <Button variant="danger" onClick={() => setShowDeleteProject(true)}>
            {t('settings.deleteProject')}
          </Button>
        </div>
      </section>

      {/* Diálogo de confirmación para eliminar miembro */}
      <ConfirmDialog
        isOpen={confirmRemove !== null}
        title={t('settings.removeConfirmTitle')}
        message={t('settings.removeConfirmMsg', { name: confirmRemove?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* Diálogo de confirmación para eliminar el proyecto completo */}
      <ConfirmDialog
        isOpen={showDeleteProject}
        title={t('settings.deleteProject')}
        message={t('settings.deleteProjectConfirm', { name: project.name })}
        confirmLabel={t('settings.deleteProjectBtn')}
        variant="danger"
        loading={deleting}
        onConfirm={() => deleteProject({ variables: { id: projectId } })}
        onCancel={() => setShowDeleteProject(false)}
      />

    </div>
  );
}
