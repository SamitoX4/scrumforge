import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { useUIStore } from '@/store/ui.store';
import { InviteMemberModal } from '@/features/team/components/InviteMemberModal';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { frontendExtensionRegistry } from '@/extensions/extension-registry';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';
import { UPDATE_WORKSPACE, DELETE_WORKSPACE } from '@/graphql/workspace/workspace.mutations';
import { REMOVE_MEMBER, UPDATE_MEMBER_ROLE } from '@/graphql/team/team.operations';
import { ROUTES } from '@/constants/routes';
import type { TeamRole } from '@/types/api.types';
import styles from './WorkspaceSettingsPage.module.scss';

/**
 * Unión discriminada de las pestañas disponibles en la página de configuración.
 * Las pestañas 'billing' e 'integrations' solo se añaden al array TABS cuando
 * el registro de extensiones dispone de los slots correspondientes,
 * manteniendo el menú limpio en instalaciones sin esos plugins.
 */
type Tab = 'general' | 'members' | 'billing' | 'integrations' | 'profile' | 'danger';


/**
 * Representa un equipo dentro del workspace con su lista de miembros.
 * Un workspace puede tener múltiples equipos; en ese caso, los miembros
 * se muestran agrupados por equipo en la pestaña "members".
 */
interface Team {
  id: string;
  name: string;
  members: TeamMemberRow[];
}

/**
 * Fila de miembro de equipo tal como la devuelve la query GET_WORKSPACES.
 * Combina el registro de pertenencia (id, role, joinedAt) con los datos
 * del usuario relacionado para renderizar nombre, email y avatar.
 */
interface TeamMemberRow {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

/**
 * Estructura del workspace devuelta por GET_WORKSPACES.
 * El campo `ownerId` se usa para calcular `isOwner` y decidir qué
 * acciones destructivas (editar nombre, eliminar workspace, gestionar miembros)
 * están disponibles para el usuario actual.
 */
interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  teams: Team[];
}

/**
 * Página de Configuración del Workspace.
 *
 * Centraliza toda la administración del workspace activo: nombre, miembros,
 * billing (via ExtensionSlot), integraciones (via ExtensionSlot), perfil del
 * usuario y zona de peligro (eliminación del workspace).
 *
 * Características clave:
 * - Selector de workspace cuando el usuario pertenece a más de uno.
 * - Pestañas dinámicas: billing e integrations solo aparecen si los plugins
 *   correspondientes están registrados en frontendExtensionRegistry.
 * - Acciones destructivas protegidas por verificación de rol (isOwner) y por
 *   confirmación textual explícita (el usuario debe escribir el nombre del workspace).
 * - Todas las mutaciones refrescan GET_WORKSPACES para mantener la caché sincronizada.
 *
 * @returns La interfaz completa de configuración del workspace.
 */
export default function WorkspaceSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  // Pestaña activa; arranca en 'general' que es la más consultada
  const [activeTab, setActiveTab] = useState<Tab>('general');
  // Campo controlado del nombre del workspace (sincronizado con el servidor vía useEffect)
  const [name, setName] = useState('');
  // ID del workspace seleccionado en el selector multi-workspace; null hasta que cargue
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // El texto que el usuario escribe debe coincidir exactamente con workspace.name
  // antes de habilitar el botón de eliminación (protección anti-borrado accidental)
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Members state
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data, loading } = useQuery<{ workspaces: Workspace[] }>(GET_WORKSPACES);

  const [updateWorkspace, { loading: saving }] = useMutation<any>(UPDATE_WORKSPACE, {
    // Refetch para que el sidebar y el header reflejen inmediatamente el nuevo nombre
    refetchQueries: [{ query: GET_WORKSPACES }],
  });

  const [deleteWorkspace, { loading: deleting }] = useMutation<any>(DELETE_WORKSPACE, {
    // Refetch necesario aunque se redirige a login, por si la navegación falla
    refetchQueries: [{ query: GET_WORKSPACES }],
  });

  const [removeMember] = useMutation<any>(REMOVE_MEMBER, {
    refetchQueries: [{ query: GET_WORKSPACES }],
  });

  const [updateMemberRole] = useMutation<any>(UPDATE_MEMBER_ROLE, {
    refetchQueries: [{ query: GET_WORKSPACES }],
  });

  const workspaces = data?.workspaces ?? [];
  // Si hay selección explícita se usa; si no, se toma el primero de la lista
  // (comportamiento de onboarding: el workspace recién creado es automáticamente el activo)
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    // Sincroniza el selectedWorkspaceId con el workspace resuelto solo la primera vez,
    // para que el selector refleje visualmente el workspace activo al cargar la página
    if (workspace && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspace.id);
    }
  }, [workspace, selectedWorkspaceId]);

  useEffect(() => {
    // Rellena el campo de nombre cada vez que cambia el workspace activo,
    // evitando que se quede un valor desactualizado al cambiar entre workspaces
    if (workspace) setName(workspace.name);
  }, [workspace]);

  /**
   * Guarda el nuevo nombre del workspace en el servidor.
   * Valida que el nombre no esté vacío antes de disparar la mutación.
   *
   * @async
   */
  async function handleSave() {
    if (!workspace || !name.trim()) return;
    try {
      await updateWorkspace({ variables: { id: workspace.id, input: { name: name.trim() } } });
      addToast(t('settings.workspaceUpdated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  /**
   * Elimina permanentemente el workspace activo y redirige al login.
   *
   * La doble protección (isOwner + coincidencia textual) es intencional:
   * un delete de workspace borra todos los proyectos, sprints e historias
   * asociados, por lo que se exige confirmación explícita para evitar errores.
   *
   * @async
   */
  async function handleDeleteWorkspace() {
    // Guarda secundaria: aunque el botón esté deshabilitado por UI, se verifica en el handler
    if (!workspace || deleteConfirmText !== workspace.name) return;
    try {
      await deleteWorkspace({ variables: { id: workspace.id } });
      addToast(t('settings.workspaceDeleted'), 'success');
      // Redirige a login porque el usuario ya no tiene workspace activo
      navigate(ROUTES.LOGIN);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    } finally {
      // Limpia el estado del diálogo en cualquier caso (éxito o error)
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  }

  /**
   * Elimina a un miembro de un equipo específico dentro del workspace.
   *
   * @param teamId - ID del equipo del que se elimina al miembro.
   * @param userId - ID del usuario que se elimina.
   * @async
   */
  async function handleRemoveMember(teamId: string, userId: string) {
    try {
      await removeMember({ variables: { teamId, userId } });
      addToast(t('settings.memberRemoved'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  /**
   * Actualiza el rol de un miembro dentro de un equipo.
   * El select del rol está deshabilitado para el propio usuario autenticado
   * (no puede degradarse a sí mismo) y para no-propietarios.
   *
   * @param teamId - ID del equipo donde se cambia el rol.
   * @param userId - ID del usuario cuyo rol se actualiza.
   * @param role   - Nuevo rol a asignar (TeamRole).
   * @async
   */
  async function handleChangeRole(teamId: string, userId: string, role: TeamRole) {
    try {
      await updateMemberRole({ variables: { teamId, userId, role } });
      addToast(t('settings.roleUpdated'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('settings.workspaceSettings')}</h1>
        <p className={styles.empty}>{t('settings.noWorkspace')}</p>
      </div>
    );
  }

  // El propietario del workspace tiene acceso completo a todas las acciones;
  // el resto solo puede ver la información sin modificarla
  const isOwner = workspace.ownerId === user?.id;
  // Aplanamos los miembros de todos los equipos para mostrar el contador total
  const allMembers: TeamMemberRow[] = workspace.teams.flatMap((t) => t.members ?? []);

  // Consulta el registro de extensiones en tiempo de render para saber qué tabs
  // opcionales están disponibles; los plugins se registran al arrancar la app
  const hasBilling      = !!frontendExtensionRegistry.getSlot('workspace-billing-tab');
  const hasIntegrations = !!frontendExtensionRegistry.getSlot('workspace-integrations-tab');

  // Construye el array de pestañas dinámicamente: billing e integrations solo
  // se incluyen si los plugins correspondientes han registrado su ExtensionSlot,
  // evitando mostrar tabs vacías en instalaciones sin esos plugins
  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: t('settings.general') },
    { key: 'members', label: t('settings.members') },
    ...(hasBilling      ? [{ key: 'billing'      as Tab, label: t('settings.billing') }] : []),
    ...(hasIntegrations ? [{ key: 'integrations' as Tab, label: t('settings.integrations') }] : []),
    { key: 'profile', label: t('settings.myProfile') },
    { key: 'danger', label: t('settings.dangerZone') },
  ];

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('settings.workspaceSettings')}</h1>

      {/* Workspace selector — only shown when user has multiple */}
      {workspaces.length > 1 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.activeWorkspace')}</h2>
          <div className={styles.workspaceList}>
            {workspaces.map((w) => (
              <button
                key={w.id}
                className={`${styles.workspaceOption} ${w.id === workspace.id ? styles['workspaceOption--active'] : ''}`}
                onClick={() => setSelectedWorkspaceId(w.id)}
              >
                <Avatar name={w.name} size="sm" />
                <div className={styles.workspaceInfo}>
                  <span className={styles.workspaceName}>{w.name}</span>
                  <span className={styles.workspaceSlug}>{w.slug}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles['tab--active'] : ''} ${tab.key === 'danger' ? styles['tab--danger'] : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === 'general' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.general')}</h2>
          <div className={styles.form}>
            <FormField
              label={t('settings.workspaceName')}
              htmlFor="ws-name"
              required
              hint={!isOwner ? t('settings.ownerOnlyEdit') : undefined}
            >
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner}
              />
            </FormField>
            <FormField label={t('settings.slug')} htmlFor="ws-slug" hint={t('settings.slugHint')}>
              <Input id="ws-slug" value={workspace.slug} disabled />
            </FormField>
            {isOwner && (
              <div>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  disabled={!name.trim() || name === workspace.name}
                >
                  {t('settings.saveChanges')}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Members */}
      {activeTab === 'members' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {t('settings.members')}
              <span className={styles.teamCount}>{t('settings.membersCount', { count: allMembers.length })}</span>
            </h2>
            {isOwner && workspace.teams[0] && (
              <Button
                size="sm"
                onClick={() => setShowInviteModal(true)}
              >
                {t('settings.inviteMember')}
              </Button>
            )}
          </div>

          {workspace.teams.map((team) => (
            <div key={team.id}>
              {workspace.teams.length > 1 && (
                <p className={styles.teamLabel}>{team.name}</p>
              )}
              {(team.members ?? []).length === 0 ? (
                <p className={styles.empty}>{t('settings.noMembers')}</p>
              ) : (
                <div className={styles.memberList}>
                  {(team.members ?? []).map((member) => (
                    <div key={member.id} className={styles.memberRow}>
                      <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="sm" />
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{member.user.name}</span>
                        <span className={styles.memberEmail}>{member.user.email}</span>
                      </div>
                      <select
                        className={styles.roleSelect}
                        value={member.role}
                        disabled={!isOwner || member.userId === user?.id}
                        onChange={(e) =>
                          handleChangeRole(team.id, member.userId, e.target.value as TeamRole)
                        }
                        aria-label={t('settings.changeRole')}
                      >
                        {(['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER', 'STAKEHOLDER'] as TeamRole[]).map((role) => (
                          <option key={role} value={role}>{t(`roles.${role}`)}</option>
                        ))}
                      </select>
                      {isOwner && member.userId !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(team.id, member.userId)}
                        >
                          {t('common.remove')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {showInviteModal && (
            <InviteMemberModal
              workspaceId={workspace.id}
              onClose={() => setShowInviteModal(false)}
              refetchQueries={['GetWorkspaces']}
            />
          )}
        </section>
      )}

      {/* Billing */}
      {activeTab === 'billing' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.billing')}</h2>
          <ExtensionSlot
            name="workspace-billing-tab"
            slotProps={{ workspaceId: workspace.id }}
          />
        </section>
      )}

      {/* Integrations */}
      {activeTab === 'integrations' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.integrations')}</h2>
          <ExtensionSlot
            name="workspace-integrations-tab"
            slotProps={{ workspaceId: workspace.id }}
          />
        </section>
      )}

      {/* My profile */}
      {activeTab === 'profile' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.myProfile')}</h2>
          <ExtensionSlot name="settings-anthropic-key" />
        </section>
      )}

      {/* Danger zone */}
      {activeTab === 'danger' && isOwner && (
        <section className={styles.dangerSection}>
          <h2 className={styles.dangerTitle}>{t('settings.dangerZone')}</h2>
          <div className={styles.dangerRow}>
            <div>
              <p className={styles.dangerLabel}>{t('settings.deleteWorkspace')}</p>
              <p className={styles.dangerDesc}>{t('settings.deleteWorkspaceDesc')}</p>
            </div>
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t('settings.deleteWorkspace')}
            </Button>
          </div>
        </section>
      )}

      {activeTab === 'danger' && !isOwner && (
        <section className={styles.section}>
          <p className={styles.empty}>{t('settings.ownerOnly')}</p>
        </section>
      )}

      {/* Delete confirm dialog */}
      {showDeleteConfirm && workspace && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ws-title"
        >
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '32px',
            maxWidth: '440px', width: '100%', margin: '0 16px',
          }}>
            <h2 id="delete-ws-title" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#EF4444', marginBottom: '12px' }}>
              {t('settings.deleteWorkspace')}
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '16px' }}>
              {t('settings.deleteWorkspaceConfirm')} <strong> {workspace.name}</strong>
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={workspace.name}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button
                variant="ghost"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteWorkspace}
                loading={deleting}
                disabled={deleteConfirmText !== workspace.name}
              >
                {t('settings.deleteWorkspaceBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
