import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { ActivityTab } from '@/features/audit/ActivityTab';
import { DependenciesTab } from '@/features/dependencies/DependenciesTab';
import { GET_USER_STORY, GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { UPDATE_USER_STORY } from '@/graphql/backlog/backlog.mutations';
import { GET_COMMENTS, ADD_COMMENT, DELETE_COMMENT } from '@/graphql/comment/comment.operations';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { CREATE_TASK } from '@/graphql/task/task.mutations';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { useUIStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';
import type { UserStory, Priority, StoryStatus, Epic } from '@/types/api.types';
import styles from './UserStoryDetailPanel.module.scss';

/**
 * Props del panel de detalle de historia de usuario.
 */
interface UserStoryDetailPanelProps {
  /** ID de la historia a mostrar; null cierra el panel sin desmontarlo del DOM */
  storyId: string | null;
  projectId: string;
  /** Lista de épicas disponibles para reasignación dentro del panel */
  epics: Epic[];
  onClose: () => void;
}

/** Secuencia de estados posibles de una historia, en orden de flujo. */
const STATUS_VALUES: StoryStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** Niveles de prioridad disponibles, de mayor a menor urgencia. */
const PRIORITY_VALUES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Secuencia de Fibonacci usada para la estimación de story points.
 * Se limita a 21 porque valores superiores indican que la historia
 * debería descomponerse en tareas más pequeñas.
 */
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

/**
 * @component UserStoryDetailPanel
 * @description Panel lateral deslizante que muestra y permite editar todos los
 * detalles de una historia de usuario seleccionada. Se monta fuera del árbol DOM
 * normal mediante `createPortal` (sobre `document.body`) para evitar problemas
 * de `z-index` y desbordamientos de contenedor.
 *
 * El panel implementa edición inline con guardado manual: los cambios se acumulan
 * en estado local y solo se persisten al pulsar "Guardar" (indicador `isDirty`).
 * Esto evita múltiples mutaciones mientras el usuario edita campos sucesivos.
 *
 * Secciones incluidas:
 * - Metadatos editables: título, estado, prioridad, puntos, épica
 * - Metadatos de solo lectura: responsable, sprint
 * - Campos personalizados clave-valor con persistencia independiente
 * - Subtareas con creación rápida
 * - Comentarios con autoría y eliminación propia
 * - Dependencias entre historias
 * - Historial de actividad (audit log)
 *
 * @param props.storyId - ID de la historia; null = panel cerrado
 * @param props.projectId - ID del proyecto para refrescar el backlog tras guardar
 * @param props.epics - Épicas disponibles para asignar/cambiar
 * @param props.onClose - Callback al cerrar (Escape, backdrop o botón X)
 */
export function UserStoryDetailPanel({
  storyId,
  projectId,
  epics,
  onClose,
}: UserStoryDetailPanelProps) {
  const { addToast } = useUIStore();
  const { t } = useTranslation();
  // Si no hay storyId el panel no se renderiza; this simplifies all conditional rendering below
  const isOpen = !!storyId;

  // fetchPolicy 'cache-and-network' muestra datos cacheados inmediatamente
  // y luego los refresca en background, evitando el spinner en aperturas repetidas
  const { data, loading } = useQuery<any>(GET_USER_STORY, {
    variables: { id: storyId },
    skip: !storyId,
    fetchPolicy: 'cache-and-network',
  });

  const [updateStory, { loading: saving }] = useMutation<any>(UPDATE_USER_STORY, {
    // Al guardar, invalidamos el backlog completo para que los badges de estado
    // y puntos se actualicen en la lista sin recargar la página
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  const story: UserStory | null = data?.userStory ?? null;
  // Necesitamos el usuario actual para determinar si puede borrar sus propios comentarios
  const { user: currentUser } = useAuthStore();

  // ── Estado local de edición ────────────────────────────────────────────────
  // Se sincroniza desde `story` cuando carga/cambia (ver useEffect más abajo).
  // Los cambios se acumulan aquí y solo se envían al pulsar "Guardar".
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<StoryStatus>('TODO');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [points, setPoints] = useState<number | null>(null);
  const [epicId, setEpicId] = useState<string | null>(null);
  // isDirty controla la visibilidad del botón "Guardar" para no guardarlo accidentalmente
  const [isDirty, setIsDirty] = useState(false);

  // ── Estado de campos personalizados ───────────────────────────────────────
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  /**
   * Guarda un nuevo campo personalizado mezclándolo con los existentes.
   * El servidor hace un merge profundo con el JSON existente, por lo que
   * solo enviamos el campo nuevo sin necesidad de enviar todos los campos.
   */
  async function handleSaveCustomField() {
    if (!newFieldKey.trim() || !storyId) return;
    const existing = (story?.customFields as Record<string, unknown>) ?? {};
    try {
      await updateStory({
        variables: {
          id: storyId,
          input: {
            // Spread de los campos existentes + el nuevo para preservar los demás
            customFields: { ...existing, [newFieldKey.trim()]: newFieldValue },
          },
        },
      });
      setNewFieldKey('');
      setNewFieldValue('');
      setShowAddField(false);
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  /**
   * Elimina un campo personalizado enviando null para esa clave.
   * El servicio del backend interpreta null como "borrar este campo" al hacer
   * el merge con el JSON existente. En el render, los campos null se filtran.
   */
  async function handleDeleteCustomField(key: string) {
    if (!storyId) return;
    // Enviamos null para la clave — el servidor hace merge y null marca eliminación
    try {
      await updateStory({
        variables: {
          id: storyId,
          input: { customFields: { [key]: null } },
        },
      });
      addToast(t('common.success'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Task creation state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const [createTask, { loading: creatingTask }] = useMutation<any>(CREATE_TASK, {
    refetchQueries: [{ query: GET_USER_STORY, variables: { id: storyId } }],
    onCompleted: () => {
      setNewTaskTitle('');
      setShowAddTask(false);
    },
  });

  async function handleCreateTask() {
    if (!newTaskTitle.trim() || !storyId) return;
    try {
      await createTask({ variables: { input: { title: newTaskTitle.trim(), userStoryId: storyId } } });
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Comments state
  const [newComment, setNewComment] = useState('');
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const { data: commentsData, refetch: refetchComments } = useQuery<any>(GET_COMMENTS, {
    variables: { userStoryId: storyId },
    skip: !storyId,
    fetchPolicy: 'cache-and-network',
  });

  const [addComment, { loading: addingComment }] = useMutation<any>(ADD_COMMENT, {
    onCompleted: () => {
      setNewComment('');
      refetchComments();
    },
  });

  const [deleteComment] = useMutation<any>(DELETE_COMMENT, {
    onCompleted: () => refetchComments(),
  });

  const comments: Array<{ id: string; body: string; createdAt: string; author: { id: string; name: string; avatarUrl?: string | null } }> =
    commentsData?.comments ?? [];

  async function handleAddComment() {
    if (!newComment.trim() || !storyId) return;
    try {
      await addComment({ variables: { input: { body: newComment, userStoryId: storyId } } });
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment({ variables: { id: commentId } });
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Sincroniza el estado local con los datos del servidor cuando la historia
  // carga o cuando el usuario abre una historia diferente (storyId cambia).
  // isDirty se resetea para que el botón "Guardar" desaparezca al abrir.
  useEffect(() => {
    if (story) {
      setTitle(story.title);
      setDescription(story.description ?? '');
      setStatus(story.status);
      setPriority(story.priority);
      setPoints(story.points ?? null);
      setEpicId(story.epicId ?? null);
      setIsDirty(false);
    }
  }, [story]);

  // Cierra el panel con Escape para mejorar la accesibilidad y productividad.
  // El listener se registra y limpia dinámicamente según si el panel está abierto
  // para no interferir con otros elementos que también manejan Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /** Marca el formulario como modificado para mostrar el botón de guardar. */
  function markDirty() {
    setIsDirty(true);
  }

  /**
   * Persiste los cambios acumulados en el estado local.
   * description y epicId se omiten si están vacíos (undefined en el input)
   * para que el servidor no sobreescriba con string vacío.
   */
  async function handleSave() {
    if (!storyId || !title.trim()) return;
    try {
      await updateStory({
        variables: {
          id: storyId,
          input: {
            title: title.trim(),
            description: description || undefined,
            status,
            priority,
            points: points ?? undefined,
            epicId: epicId || undefined,
          },
        },
      });
      addToast(t('common.success'), 'success');
      setIsDirty(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop (semi-transparent) */}
      <div className={styles.backdrop} onClick={onClose} />

      <aside className={styles.panel} role="complementary" aria-label={t('story.detailLabel')}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>{t('story.detailLabel')}</span>
          <div className={styles.panelActions}>
            {isDirty && (
              <Button size="sm" onClick={handleSave} loading={saving}>
                {t('common.save')}
              </Button>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
              ✕
            </button>
          </div>
        </div>

        {loading && !story ? (
          <div className={styles.loading}>
            <Spinner size="md" />
          </div>
        ) : story ? (
          <div className={styles.body}>
            {/* Title */}
            <textarea
              className={styles.titleInput}
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              rows={2}
              placeholder={t('story.titlePlaceholder')}
            />

            {/* Meta fields */}
            <div className={styles.meta}>
              {/* Status */}
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>{t('story.status')}</span>
                <select
                  className={styles.metaSelect}
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as StoryStatus); markDirty(); }}
                >
                  {STATUS_VALUES.map((v) => (
                    <option key={v} value={v}>{t(`status.${v}`)}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>{t('story.priority')}</span>
                <select
                  className={styles.metaSelect}
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value as Priority); markDirty(); }}
                >
                  {PRIORITY_VALUES.map((v) => (
                    <option key={v} value={v}>{t(`priority.${v}`)}</option>
                  ))}
                </select>
              </div>

              {/* Story points */}
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>{t('story.points')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div className={styles.pointsPicker}>
                    {FIBONACCI.map((n) => (
                      <button
                        key={n}
                        className={styles.pointBtn + (points === n ? ` ${styles['pointBtn--active']}` : '')}
                        onClick={() => { setPoints(points === n ? null : n); markDirty(); }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <ExtensionSlot
                    name="story-suggest-points"
                    slotProps={{
                      storyTitle: title,
                      projectId: projectId ?? '',
                      onPointsSuggested: (pts: unknown) => {
                        setPoints(pts as number);
                        setIsDirty(false);
                        void updateStory({ variables: { id: storyId, input: { points: pts as number } } })
                          .catch((err: Error) => addToast(err.message, 'error'));
                      },
                    }}
                  />
                </div>
              </div>

              {/* Epic */}
              {epics.length > 0 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Épica</span>
                  <select
                    className={styles.metaSelect}
                    value={epicId ?? ''}
                    onChange={(e) => { setEpicId(e.target.value || null); markDirty(); }}
                  >
                    <option value="">{t('story.noEpic')}</option>
                    {epics.map((e) => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assignee (read-only for now) */}
              {story.assignee && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('story.assignedLabel')}</span>
                  <div className={styles.assignee}>
                    <Avatar
                      name={story.assignee.name}
                      avatarUrl={story.assignee.avatarUrl}
                      size="xs"
                    />
                    <span>{story.assignee.name}</span>
                  </div>
                </div>
              )}

              {/* Sprint */}
              {story.sprint && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('story.sprint')}</span>
                  <Badge variant={story.sprint.status === 'ACTIVE' ? 'IN_PROGRESS' : story.sprint.status === 'COMPLETED' ? 'DONE' : 'TODO'}>
                    {story.sprint.name}
                  </Badge>
                </div>
              )}
            </div>

            {/* Description */}
            <div className={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>{t('story.description')}</h3>
                <ExtensionSlot
                  name="story-generate-criteria"
                  slotProps={{
                    storyTitle: title,
                    storyDescription: description,
                    onCriteriaGenerated: (text: unknown) => {
                      setDescription((prev) => (prev ? `${prev}\n\n${text as string}` : text as string));
                      setIsDirty(true);
                    },
                  }}
                />
              </div>
              <textarea
                className={styles.descriptionInput}
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                rows={5}
                placeholder={t('story.descriptionPlaceholder')}
              />
            </div>

            {/* Custom fields */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{t('story.customFields')}</h3>
                <button
                  className={styles.addTaskBtn}
                  onClick={() => setShowAddField((v) => !v)}
                  aria-label={t('story.addField')}
                >
                  {t('story.addField')}
                </button>
              </div>

              {story.customFields && Object.entries(story.customFields as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {Object.entries(story.customFields as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '80px', flexShrink: 0 }}>{key}:</span>
                      <span style={{ flex: 1, color: 'var(--color-text)', wordBreak: 'break-word' }}>{String(value ?? '')}</span>
                      <button
                        onClick={() => handleDeleteCustomField(key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.75rem',
                          padding: '0 4px',
                          flexShrink: 0,
                        }}
                        aria-label={`Eliminar campo ${key}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddField && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: 'var(--color-surface-raised)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                  <input
                    style={{ fontSize: '0.8125rem', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)' }}
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder={t('story.fieldName')}
                    autoFocus
                  />
                  <input
                    style={{ fontSize: '0.8125rem', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)' }}
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    placeholder={t('story.fieldValue')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveCustomField();
                      if (e.key === 'Escape') { setShowAddField(false); setNewFieldKey(''); setNewFieldValue(''); }
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button size="sm" onClick={handleSaveCustomField} disabled={!newFieldKey.trim()}>
                      {t('common.save')}
                    </Button>
                    <button
                      className={styles.cancelTaskBtn}
                      onClick={() => { setShowAddField(false); setNewFieldKey(''); setNewFieldValue(''); }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tasks */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  {t('story.subtasks')} {story.tasks && story.tasks.length > 0 && `(${story.tasks.length})`}
                </h3>
                <button
                  className={styles.addTaskBtn}
                  onClick={() => setShowAddTask((v) => !v)}
                  aria-label={t('story.addSubtask')}
                >
                  {t('story.addSubtask')}
                </button>
              </div>

              {story.tasks && story.tasks.length > 0 && (
                <ul className={styles.taskList}>
                  {story.tasks.map((task) => (
                    <li key={task.id} className={styles.taskItem}>
                      <span
                        className={styles.taskStatus}
                        style={{ color: task.status === 'DONE' ? '#10B981' : '#94A3B8' }}
                      >
                        {task.status === 'DONE' ? '✓' : '○'}
                      </span>
                      <span className={task.status === 'DONE' ? styles['taskTitle--done'] : styles.taskTitle}>
                        {task.title}
                      </span>
                      {task.assignee && (
                        <Avatar
                          name={task.assignee.name}
                          avatarUrl={task.assignee.avatarUrl}
                          size="xs"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {showAddTask && (
                <div className={styles.addTaskRow}>
                  <input
                    className={styles.taskInput}
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={t('story.subtaskTitle')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTask();
                      if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateTask}
                    loading={creatingTask}
                    disabled={!newTaskTitle.trim()}
                  >
                    {t('common.create')}
                  </Button>
                  <button
                    className={styles.cancelTaskBtn}
                    onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {t('story.comments')} {comments.length > 0 && `(${comments.length})`}
              </h3>

              {/* Comment list */}
              {comments.length > 0 && (
                <ul className={styles.commentList}>
                  {comments.map((c) => (
                    <li key={c.id} className={styles.comment}>
                      <Avatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="xs" />
                      <div className={styles.commentBody}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAuthor}>{c.author.name}</span>
                          <span className={styles.commentDate}>
                            {new Date(c.createdAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <p className={styles.commentText}>{c.body}</p>
                      </div>
                      {currentUser?.id === c.author.id && (
                        <button
                          className={styles.deleteCommentBtn}
                          onClick={() => handleDeleteComment(c.id)}
                          aria-label={t('common.delete')}
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Add comment */}
              <div className={styles.addComment}>
                <textarea
                  ref={commentInputRef}
                  className={styles.commentInput}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('story.commentPlaceholder')}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  loading={addingComment}
                  disabled={!newComment.trim()}
                >
                  {t('story.comment')}
                </Button>
              </div>
            </div>

            {/* Dependencies */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('story.dependencies')}</h3>
              <DependenciesTab storyId={story.id} projectStories={epics?.flatMap((e: { userStories?: { id: string; title: string }[] }) => e.userStories ?? []) ?? []} />
            </div>

            {/* Activity / Audit */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('story.activity')}</h3>
              <ActivityTab entityId={story.id} entityType="UserStory" />
            </div>

            {/* Dates */}
            <div className={styles.footer}>
              <span className={styles.date}>
                {t('story.createdAt')} {new Date(story.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ) : null}
      </aside>
    </>,
    document.body,
  );
}
