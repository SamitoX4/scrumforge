import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { CREATE_WORKSPACE, CREATE_TEAM, CREATE_PROJECT } from '@/graphql/project/project.mutations';
import { useUIStore } from '@/store/ui.store';
import { buildRoute, ROUTES } from '@/constants/routes';
import styles from './CreateProjectModal.module.scss';

/**
 * Query inline para obtener los workspaces del usuario junto con sus equipos.
 * Se ejecuta solo cuando el modal está abierto (`skip: !isOpen`) para no
 * hacer llamadas innecesarias mientras está cerrado.
 */
const GET_WORKSPACES_TEAMS = gql`
  query GetWorkspacesTeams {
    workspaces {
      id name slug
      teams { id name }
    }
  }
`;

/**
 * Estructura de un workspace tal como lo devuelve `GET_WORKSPACES_TEAMS`.
 *
 * @property id    - Identificador único del workspace.
 * @property name  - Nombre visible del workspace.
 * @property slug  - Slug URL-safe usado para construir rutas.
 * @property teams - Equipos que pertenecen a este workspace.
 */
interface Workspace {
  id: string;
  name: string;
  slug: string;
  teams: Array<{ id: string; name: string }>;
}

/**
 * Props del componente CreateProjectModal.
 *
 * @property isOpen  - Controla la visibilidad del modal.
 * @property onClose - Callback para cerrar el modal (éxito o cancelación).
 */
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Convierte un texto libre en un slug URL-safe para nombres de workspace.
 *
 * Reglas aplicadas (en orden):
 * 1. Convierte a minúsculas.
 * 2. Elimina espacios al inicio y fin.
 * 3. Reemplaza espacios internos por guiones.
 * 4. Elimina cualquier carácter que no sea letra minúscula, número o guion.
 * 5. Trunca a 50 caracteres como máximo.
 *
 * @param text - Texto de entrada (nombre del workspace).
 * @returns Slug apto para usar en URLs.
 *
 * @example
 * slugify('Acme Corp 2025') // => 'acme-corp-2025'
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 50);
}

/**
 * Deriva la clave corta del proyecto a partir del nombre introducido.
 *
 * La clave se usa como prefijo en los tickets (p.ej. "SF-1", "ACME-42").
 * Reglas: solo letras mayúsculas y números, máximo 6 caracteres.
 *
 * @param text - Nombre del proyecto introducido por el usuario.
 * @returns Clave del proyecto en mayúsculas, sin espacios ni caracteres especiales.
 *
 * @example
 * toProjectKey('ScrumForge')  // => 'SCRUM' (primeras 6 letras válidas)
 * toProjectKey('Mi Proyecto') // => 'MIPROY'
 */
function toProjectKey(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

/**
 * CreateProjectModal — modal de creación de proyecto con flujo adaptativo.
 *
 * Gestiona dos flujos distintos según el estado del usuario:
 *
 * **Flujo para usuario nuevo (sin workspaces):**
 * 1. Solicita el nombre del workspace (se creará uno nuevo).
 * 2. Crea automáticamente un equipo "Mi Equipo" dentro del workspace.
 * 3. Crea el proyecto y navega al backlog del nuevo proyecto.
 *
 * **Flujo para usuario existente (con workspaces):**
 * 1. Muestra selector de workspace (solo si hay más de uno).
 * 2. Muestra selector de equipo (solo si el workspace tiene más de uno).
 * 3. Si no hay equipo, crea uno automáticamente antes del proyecto.
 * 4. Crea el proyecto y navega al backlog.
 *
 * La clave del proyecto se genera automáticamente al escribir el nombre,
 * pero el usuario puede editarla manualmente antes de confirmar.
 *
 * Todos los errores se muestran como toasts del store global de UI.
 *
 * @param props - Ver {@link CreateProjectModalProps}.
 *
 * @example
 * <CreateProjectModal
 *   isOpen={showCreateProject}
 *   onClose={() => setShowCreateProject(false)}
 * />
 */
export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  // workspaceSlug de la URL actual — se usa para construir la ruta post-creación
  const { workspaceSlug: paramSlug } = useParams<{ workspaceSlug: string }>();
  const { addToast } = useUIStore();

  // Campos del formulario de creación
  const [workspaceName, setWorkspaceName] = useState('');       // Solo para usuarios nuevos
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');             // Derivada del nombre, editable

  // La query solo se ejecuta cuando el modal está abierto para evitar fetches innecesarios
  const { data, loading: loadingWorkspaces } = useQuery<{ workspaces: Workspace[] }>(
    GET_WORKSPACES_TEAMS,
    { skip: !isOpen },
  );

  // Mutations separadas para cada paso de la creación (workspace → equipo → proyecto)
  const [createWorkspace, { loading: creatingWs }] = useMutation<any>(CREATE_WORKSPACE);
  const [createTeam, { loading: creatingTeam }] = useMutation<any>(CREATE_TEAM);
  const [createProject, { loading: creatingProject }] = useMutation<any>(CREATE_PROJECT);

  const workspaces: Workspace[] = data?.workspaces ?? [];
  // Determina si el usuario ya tiene al menos un workspace creado
  const hasWorkspace = workspaces.length > 0;

  // Workspace activo: el seleccionado en el selector o el primero disponible por defecto
  const activeWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId) ?? workspaces[0];
  // Equipos disponibles en el workspace activo
  const availableTeams = activeWorkspace?.teams ?? [];

  /**
   * Sincroniza el campo de clave del proyecto cuando el usuario escribe el nombre.
   * La clave se deriva automáticamente pero puede editarse manualmente después.
   *
   * @param value - Nuevo valor del campo de nombre del proyecto.
   */
  function handleProjectNameChange(value: string) {
    setProjectName(value);
    setProjectKey(toProjectKey(value));
  }

  /**
   * Limpia todos los campos del formulario y cierra el modal.
   * Se llama tanto al cancelar como después de crear el proyecto exitosamente.
   */
  function handleClose() {
    setWorkspaceName('');
    setSelectedWorkspaceId('');
    setSelectedTeamId('');
    setProjectName('');
    setProjectKey('');
    onClose();
  }

  // Indica si alguna mutation está en curso para deshabilitar controles y mostrar spinner
  const isSubmitting = creatingWs || creatingTeam || creatingProject;

  /**
   * Ejecuta el flujo completo de creación según el estado del usuario.
   *
   * Flujo para usuario nuevo: workspace → equipo → proyecto → navegar al backlog.
   * Flujo para usuario existente: (equipo si falta) → proyecto → navegar al backlog.
   *
   * Las mutations se encadenan secuencialmente porque cada una depende
   * del ID devuelto por la anterior (workspace.id → team.id → project.id).
   */
  async function handleSubmit() {
    // Validación básica: no enviar si faltan campos obligatorios
    if (!projectName.trim() || !projectKey.trim()) return;

    try {
      // Toma el equipo seleccionado o el primero disponible como valor inicial
      let teamId = selectedTeamId || availableTeams[0]?.id;

      if (!hasWorkspace) {
        // Flujo de usuario nuevo: crear workspace + equipo + proyecto en secuencia
        if (!workspaceName.trim()) return;
        const wsResult = await createWorkspace({
          variables: {
            input: {
              name: workspaceName.trim(),
              // El slug se deriva del nombre para garantizar que sea URL-safe
              slug: slugify(workspaceName),
            },
          },
        });
        const newWorkspace = wsResult.data.createWorkspace;

        // Se crea un equipo por defecto; el usuario puede renombrarlo después
        const teamResult = await createTeam({
          variables: {
            input: {
              name: 'Mi Equipo',
              workspaceId: newWorkspace.id,
            },
          },
        });
        teamId = teamResult.data.createTeam.id;
      } else if (!teamId) {
        // Caso borde: el usuario tiene workspace pero aún no tiene ningún equipo
        const teamResult = await createTeam({
          variables: {
            input: {
              name: 'Mi Equipo',
              workspaceId: activeWorkspace.id,
            },
          },
        });
        teamId = teamResult.data.createTeam.id;
      }

      const projectResult = await createProject({
        variables: {
          input: {
            name: projectName.trim(),
            key: projectKey,
            teamId,
          },
        },
      });

      const newProject = projectResult.data.createProject;
      addToast(`Proyecto "${newProject.name}" creado`, 'success');
      handleClose();
      // Navega al backlog del proyecto recién creado; usa el slug de la URL actual
      // o el del workspace activo como fallback si no hay parámetro en la URL
      const wsSlug = paramSlug ?? activeWorkspace?.slug ?? '';
      navigate(buildRoute(ROUTES.BACKLOG, { workspaceSlug: wsSlug, projectId: newProject.id }));
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear el proyecto', 'error');
    }
  }

  // El botón de crear solo se habilita cuando todos los campos obligatorios tienen valor
  const canSubmit =
    projectName.trim() &&
    projectKey.trim() &&
    // Para usuarios nuevos también se requiere el nombre del workspace
    (hasWorkspace || workspaceName.trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nuevo proyecto"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={!canSubmit}>
            Crear proyecto
          </Button>
        </>
      }
    >
      {/* Muestra spinner mientras se cargan los workspaces del usuario */}
      {loadingWorkspaces ? (
        <div className={styles.loading}>
          <Spinner size="md" />
        </div>
      ) : (
        <div className={styles.form}>
          {/* Sección de workspace — solo visible para usuarios sin workspaces previos */}
          {!hasWorkspace && (
            <div className={styles.section}>
              <p className={styles.sectionHint}>
                Primero, dale nombre a tu espacio de trabajo.
              </p>
              <FormField label="Nombre del workspace" htmlFor="ws-name" required>
                {/* autoFocus aquí porque es el primer campo que debe rellenar el usuario nuevo */}
                <Input
                  id="ws-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="ej. Acme Corp"
                  autoFocus
                />
              </FormField>
            </div>
          )}

          {/* Selector de workspace — solo si el usuario tiene más de uno */}
          {hasWorkspace && workspaces.length > 1 && (
            <FormField label="Workspace" htmlFor="ws-select">
              <select
                id="ws-select"
                className={styles.select}
                value={selectedWorkspaceId || activeWorkspace?.id}
                onChange={(e) => {
                  setSelectedWorkspaceId(e.target.value);
                  // Resetea el equipo al cambiar de workspace para evitar inconsistencias
                  setSelectedTeamId('');
                }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* Selector de equipo — solo si el workspace activo tiene más de uno */}
          {hasWorkspace && availableTeams.length > 1 && (
            <FormField label="Equipo" htmlFor="team-select">
              <select
                id="team-select"
                className={styles.select}
                value={selectedTeamId || availableTeams[0]?.id}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                {availableTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* Separador visual entre la sección de contexto y los datos del proyecto */}
          <div className={styles.divider} />

          {/* autoFocus en el nombre del proyecto para usuarios existentes (el workspace ya está) */}
          <FormField label="Nombre del proyecto" htmlFor="proj-name" required>
            <Input
              id="proj-name"
              value={projectName}
              onChange={(e) => handleProjectNameChange(e.target.value)}
              placeholder="ej. ScrumForge"
              autoFocus={hasWorkspace}
            />
          </FormField>

          {/* La clave se auto-completa al escribir el nombre pero es editable manualmente */}
          <FormField
            label="Clave del proyecto"
            htmlFor="proj-key"
            required
            hint="2–6 letras mayúsculas. Se usa como prefijo en los tickets (ej. SF-1)"
          >
            {/* Normaliza en tiempo real: mayúsculas, sin especiales, máximo 6 caracteres */}
            <Input
              id="proj-key"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ej. SF"
              maxLength={6}
            />
          </FormField>
        </div>
      )}
    </Modal>
  );
}
