import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveSprint } from '@/hooks/useActiveSprint';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { NewImpedimentModal } from './NewImpedimentModal';
import { ResolveImpedimentModal } from './ResolveImpedimentModal';
import { GET_IMPEDIMENTS, UPDATE_IMPEDIMENT_STATUS, DELETE_IMPEDIMENT } from '@/graphql/impediments/impediment.queries';
import styles from './ImpedimentsView.module.scss';
import clsx from 'clsx';

/**
 * @interface Impediment
 * @description Estructura completa de un impedimento tal como se recibe del servidor GraphQL.
 */
interface Impediment {
  /** Identificador único del impedimento. */
  id: string;
  /** Título breve del impedimento. */
  title: string;
  /** Descripción detallada del contexto y del problema. */
  description?: string;
  /** Categoría del impedimento: TECHNICAL | EXTERNAL | ORGANIZATIONAL | OTHER. */
  category: string;
  /** Severidad del bloqueo: HIGH | MEDIUM | LOW. */
  impact: string;
  /** Estado actual del ciclo de vida: OPEN | IN_PROGRESS | RESOLVED. */
  status: string;
  /** ID del proyecto al que pertenece. */
  projectId: string;
  /** ID del sprint en el que se registró, si aplica. */
  sprintId?: string;
  /** Timestamp ISO de cuándo fue escalado a una instancia superior, si aplica. */
  escalatedAt?: string;
  /** Miembro del equipo que reportó el impedimento. */
  reportedBy: { id: string; name: string; avatarUrl?: string };
  /** Persona asignada para resolver el impedimento, si ya fue asignado. */
  assignedTo?: { id: string; name: string } | null;
  /** Comentario que describe cómo se resolvió el impedimento, presente solo en estado RESOLVED. */
  resolvedComment?: string;
}

/**
 * @component ImpedimentsView
 * @description Vista principal del módulo de gestión de impedimentos del proyecto.
 *
 * Los impedimentos son bloqueos que impiden al equipo avanzar y que requieren
 * intervención externa (Scrum Master, dirección, proveedores, etc.). Esta vista
 * permite al equipo registrarlos, seguir su evolución y cerrarlos con documentación.
 *
 * Funcionalidades:
 * - **Listado filtrable** por estado (Todos / Abierto / En progreso / Resuelto).
 * - **Ciclo de vida**: OPEN → IN_PROGRESS (botón "Iniciar") → RESOLVED (botón "Resolver").
 * - **Creación**: modal `NewImpedimentModal` con datos del proyecto y sprint activo.
 * - **Resolución**: modal `ResolveImpedimentModal` que requiere un comentario obligatorio
 *   para documentar cómo se eliminó el bloqueo.
 * - **Eliminación**: confirmación nativa del navegador antes de ejecutar la mutación.
 * - **Escalado**: los impedimentos marcados como escalados muestran una badge especial
 *   de advertencia para llamar la atención en el daily scrum.
 *
 * La lista se recarga automáticamente (via `refetchQueries`) tras cada mutación,
 * manteniendo el estado del servidor como fuente de verdad.
 *
 * @returns {JSX.Element} Vista completa de impedimentos o spinner de carga.
 */
export default function ImpedimentsView() {
  const { projectId } = useCurrentProject();
  const { sprint: activeSprint } = useActiveSprint(projectId);
  const { t } = useTranslation();

  // Filtro de estado activo (undefined = "Todos")
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Controla la visibilidad del modal de creación
  const [showNew, setShowNew] = useState(false);

  // Impedimento seleccionado para el modal de resolución (null cuando no hay ninguno abierto)
  const [resolving, setResolving] = useState<Impediment | null>(null);

  const { data, loading } = useQuery<any>(GET_IMPEDIMENTS, {
    variables: { projectId, status: statusFilter },
    // Evitar la query si el proyecto aún no está disponible (navegación inicial)
    skip: !projectId,
  });

  const [updateStatus] = useMutation<any>(UPDATE_IMPEDIMENT_STATUS, {
    refetchQueries: [{ query: GET_IMPEDIMENTS, variables: { projectId } }],
  });
  const [deleteImpediment] = useMutation<any>(DELETE_IMPEDIMENT, {
    refetchQueries: [{ query: GET_IMPEDIMENTS, variables: { projectId } }],
  });

  // Mostrar spinner centralizado mientras se carga la primera vez
  if (loading) return <div className={styles.page}><Spinner size="lg" /></div>;

  const impediments: Impediment[] = data?.impediments ?? [];

  // Definición de los botones de filtro con sus valores de estado correspondientes.
  // `undefined` como valor se interpreta en la query como "sin filtro de estado".
  const FILTERS = [
    { label: t('impediment.filter.all'),        value: undefined },
    { label: t('impediment.filter.open'),       value: 'OPEN' },
    { label: t('impediment.filter.inProgress'), value: 'IN_PROGRESS' },
    { label: t('impediment.filter.resolved'),   value: 'RESOLVED' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('impediment.title')}</h1>
        <Button variant="primary" onClick={() => setShowNew(true)}>+ {t('impediment.new')}</Button>
      </div>

      {/* Barra de filtros por estado: el filtro activo recibe clase CSS adicional */}
      <div className={styles.filters}>
        {FILTERS.map(({ label, value }) => (
          <button
            key={label}
            className={clsx(styles.filterBtn, statusFilter === value && styles['filterBtn--active'])}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {impediments.length === 0 ? (
        // Mensaje de estado vacío: incluye el filtro activo para dar contexto al usuario
        <p className={styles.empty}>
          {t('impediment.empty')}{statusFilter ? ` — ${t(`impediment.status.${statusFilter}`)}` : ''}.
        </p>
      ) : (
        <div className={styles.list}>
          {impediments.map((imp) => (
            <div key={imp.id} className={styles.card}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{imp.title}</h3>

                {/* Grupo de badges: estado, impacto y (condicionalmente) escalado */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {/* El modificador CSS del badge se construye dinámicamente con el valor del campo */}
                  <span className={clsx(styles.badge, styles[`badge--${imp.status}`])}>
                    {t(`impediment.status.${imp.status}`) ?? imp.status}
                  </span>
                  <span className={clsx(styles.badge, styles[`badge--${imp.impact}`])}>
                    {t(`impediment.impact.${imp.impact}`) ?? imp.impact}
                  </span>
                  {/* Badge de escalado: solo visible si el impedimento fue escalado a dirección */}
                  {imp.escalatedAt && (
                    <span className={clsx(styles.badge, styles['badge--escalated'])}>
                      ⚠ {t('impediment.escalated')}
                    </span>
                  )}
                </div>
              </div>

              {/* Metadatos secundarios: categoría, reportador y asignado (condicional) */}
              <div className={styles.cardMeta}>
                <span>{t(`impediment.category.${imp.category}`) ?? imp.category}</span>
                <span>·</span>
                <span>{t('impediment.reportedBy')} {imp.reportedBy.name}</span>
                {imp.assignedTo && (
                  <><span>·</span><span>{t('impediment.assignedTo')} {imp.assignedTo.name}</span></>
                )}
              </div>

              {imp.description && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                  {imp.description}
                </p>
              )}

              {/* Comentario de resolución: visible solo en impedimentos RESOLVED */}
              {imp.resolvedComment && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-gray-500)', fontStyle: 'italic' }}>
                  {t('impediment.resolvedWith')} {imp.resolvedComment}
                </p>
              )}

              {/* Acciones del ciclo de vida: no se muestran en impedimentos ya resueltos */}
              {imp.status !== 'RESOLVED' && (
                <div className={styles.actions}>
                  {/* Transición OPEN → IN_PROGRESS: el Scrum Master toma ownership del bloqueo */}
                  {imp.status === 'OPEN' && (
                    <Button size="sm" variant="secondary"
                      onClick={() => updateStatus({ variables: { id: imp.id, status: 'IN_PROGRESS' } })}>
                      {t('impediment.start')}
                    </Button>
                  )}
                  {/* Transición IN_PROGRESS → RESOLVED: abre el modal para documentar la solución */}
                  {imp.status === 'IN_PROGRESS' && (
                    <Button size="sm" variant="primary" onClick={() => setResolving(imp)}>
                      {t('impediment.resolve')}
                    </Button>
                  )}
                  {/* Eliminación con confirmación nativa para prevenir borrados accidentales */}
                  <Button size="sm" variant="ghost"
                    onClick={() => { if (confirm(t('common.confirm') + '?')) deleteImpediment({ variables: { id: imp.id } }); }}>
                    {t('common.delete')}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de creación: se pasa el sprint activo para asociar el impedimento al sprint en curso */}
      {showNew && (
        <NewImpedimentModal
          projectId={projectId ?? ''}
          sprintId={activeSprint?.id}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Modal de resolución: montado condicionalmente cuando hay un impedimento seleccionado */}
      {resolving && (
        <ResolveImpedimentModal
          impediment={resolving}
          onClose={() => setResolving(null)}
          projectId={projectId ?? ''}
        />
      )}
    </div>
  );
}
