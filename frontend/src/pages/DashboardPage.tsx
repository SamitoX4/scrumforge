/**
 * @file DashboardPage.tsx
 * @description Página principal del dashboard del workspace. Muestra todos los proyectos
 * pertenecientes al workspace activo y permite crear nuevos proyectos desde aquí.
 *
 * La página obtiene todos los workspaces del usuario autenticado mediante GraphQL y luego
 * filtra localmente el workspace cuyo slug coincide con el parámetro de la URL. Esto evita
 * una query adicional por workspace y reutiliza los datos que Apollo ya puede tener en caché.
 */

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { buildRoute, ROUTES } from '@/constants/routes';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { CreateProjectModal } from '@/features/project/components/CreateProjectModal';
import styles from './DashboardPage.module.scss';

/**
 * Query GraphQL para obtener todos los workspaces del usuario autenticado,
 * junto con sus equipos y los proyectos de cada equipo.
 * Se piden los campos mínimos necesarios para renderizar las tarjetas del dashboard,
 * evitando over-fetching de datos que no se muestran en esta vista.
 */
const GET_WORKSPACES = gql`
  query GetWorkspaces {
    workspaces {
      id name slug
      teams {
        id name
        projects { id name key }
      }
    }
  }
`;

/** Representa un proyecto dentro de un equipo. */
type Project = { id: string; name: string; key: string };

/** Representa un equipo que agrupa proyectos dentro de un workspace. */
type Team = { id: string; name: string; projects: Project[] };

/** Representa un workspace multi-tenant con sus equipos anidados. */
type Workspace = { id: string; name: string; slug: string; teams: Team[] };

/**
 * Página principal del dashboard del workspace.
 *
 * Flujo de datos:
 * 1. Obtiene todos los workspaces vía Apollo (con caché automática).
 * 2. Identifica el workspace activo comparando el slug de la URL con los slugs devueltos.
 * 3. Aplana la lista de proyectos de todos los equipos del workspace en un array único.
 * 4. Renderiza tarjetas de proyectos o un estado vacío con CTA de creación.
 *
 * Al cerrar el modal de creación se llama a `refetch()` para sincronizar los datos
 * recién creados sin necesidad de invalidar la caché manualmente.
 *
 * @returns JSX con el header de bienvenida, grid de proyectos o estado vacío,
 *          y el modal de creación de proyectos.
 */
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { t } = useTranslation();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const { data, loading, refetch } = useQuery<{ workspaces: Workspace[] }>(GET_WORKSPACES);

  // Mostrar spinner mientras Apollo resuelve la query inicial
  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Usar coalescencia nula para evitar errores si data aún no está disponible
  const workspaces = data?.workspaces ?? [];

  // Filtrar el workspace activo según el slug extraído de la URL
  const currentWorkspace = workspaces.find((ws) => ws.slug === workspaceSlug);

  // Aplanar todos los proyectos de todos los equipos del workspace en una sola lista,
  // ya que el dashboard no necesita distinguir a qué equipo pertenece cada proyecto
  const allProjects = currentWorkspace?.teams.flatMap((t) => t.projects) ?? [];

  /**
   * Cierra el modal de creación de proyecto y recarga los workspaces.
   * Se hace refetch (y no solo cierre) para que el nuevo proyecto aparezca
   * inmediatamente en el grid sin que el usuario tenga que recargar la página.
   */
  function handleModalClose() {
    setShowCreateProject(false);
    refetch();
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          {/* Se extrae solo el primer nombre del usuario para el saludo más personal */}
          <h1 className={styles.greeting}>
            {t('dashboard.greeting', { name: user?.name?.split(' ')[0] })}
          </h1>
          <p className={styles.subtitle}>{t('dashboard.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateProject(true)}>
          {t('dashboard.newProject')}
        </Button>
      </header>

      {/* Estado vacío: se muestra cuando el workspace existe pero no tiene proyectos todavía */}
      {allProjects.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🚀</div>
          <h2 className={styles.emptyTitle}>{t('dashboard.noProjects')}</h2>
          <p className={styles.emptyText}>{t('dashboard.noProjectsText')}</p>
          <Button onClick={() => setShowCreateProject(true)}>
            {t('dashboard.createFirst')}
          </Button>
        </div>
      ) : (
        // Grid de tarjetas: cada tarjeta enlaza directamente al tablero del proyecto
        <div className={styles.grid}>
          {allProjects.map((project) => (
            <Link
              key={project.id}
              to={buildRoute(ROUTES.BOARD, { workspaceSlug: workspaceSlug ?? '', projectId: project.id })}
              className={styles.card}
            >
              {/* La clave del proyecto (ej. "SCRUM-1") sirve como identificador visual corto */}
              <span className={styles['card__key']}>{project.key}</span>
              <span className={styles['card__name']}>{project.name}</span>
              <span className={styles['card__arrow']}>→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Modal de creación: se monta/desmonta según el estado showCreateProject */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={handleModalClose}
      />
    </main>
  );
}
