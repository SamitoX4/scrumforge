import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useActiveSprint } from '@/hooks/useActiveSprint';
import { Button } from '@/components/atoms/Button/Button';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import {
  GET_RETROSPECTIVES, CREATE_RETRO, ADD_RETRO_CARD, DELETE_RETRO_CARD,
  ADD_RETRO_ACTION, TOGGLE_RETRO_ACTION, CLOSE_RETRO,
} from '@/graphql/retrospective/retro.queries';

/**
 * Columnas por plantilla almacenadas en DB.
 * Las claves son los valores exactos guardados en el campo `column` de cada tarjeta,
 * por lo que nunca deben traducirse; solo se usan para filtrar y agrupar tarjetas.
 */
const TEMPLATE_COLUMNS: Record<string, string[]> = {
  START_STOP_CONTINUE: ['Start', 'Stop', 'Continue'],
  GLAD_SAD_MAD:       ['Glad', 'Sad', 'Mad'],
  FOUR_LS:            ['Liked', 'Learned', 'Lacked', 'Longed for'],
  SAILBOAT:           ['Anchors', 'Wind', 'Rocks', 'Land'],
  CUSTOM:             ['Column 1', 'Column 2', 'Column 3'],
};

/**
 * Mapea la clave de columna (guardada en DB) a la clave de traducción i18n.
 * De este modo el UI muestra el nombre localizado sin modificar los datos guardados.
 */
const COLUMN_I18N_KEYS: Record<string, string> = {
  Start: 'retro.colStart', Stop: 'retro.colStop', Continue: 'retro.colContinue',
  Glad: 'retro.colGlad', Sad: 'retro.colSad', Mad: 'retro.colMad',
  Liked: 'retro.colLiked', Learned: 'retro.colLearned', Lacked: 'retro.colLacked', 'Longed for': 'retro.colLongedFor',
  Anchors: 'retro.colAnchors', Wind: 'retro.colWind', Rocks: 'retro.colRocks', Land: 'retro.colLand',
  'Column 1': 'retro.colColumn1', 'Column 2': 'retro.colColumn2', 'Column 3': 'retro.colColumn3',
};

/** Mapea el identificador de plantilla a su clave de traducción para mostrarlo en la UI. */
const TEMPLATE_I18N_KEYS: Record<string, string> = {
  START_STOP_CONTINUE: 'retro.tmplStartStopContinue',
  GLAD_SAD_MAD: 'retro.tmplGladSadMad',
  FOUR_LS: 'retro.tmplFourLs',
  SAILBOAT: 'retro.tmplSailboat',
  CUSTOM: 'retro.tmplCustom',
};

/** Tarjeta de retrospectiva con votos y autor. */
interface Card { id: string; column: string; body: string; votes: number; authorId: string; author: { id: string; name: string } }

/** Ítem de acción asociado a la retro, con asignado opcional. */
interface Action { id: string; title: string; done: boolean; assignedTo?: { id: string; name: string } | null }

/** Retrospectiva completa con tarjetas y acciones. */
interface Retro {
  id: string; title: string; template: string; status: string; projectId: string;
  cards: Card[]; actions: Action[];
}

/**
 * Props del componente RetroBoard.
 * @property retro - Datos completos de la retrospectiva a renderizar.
 * @property projectId - ID del proyecto, necesario para refrescar la caché de Apollo.
 */
interface RetroBoardProps {
  retro: Retro;
  projectId: string;
}

/**
 * Tablero de una retrospectiva individual.
 *
 * Muestra las columnas según la plantilla elegida, permite agregar/borrar tarjetas
 * y gestionar ítems de acción. Si la retro está CLOSED, los formularios se ocultan.
 * El botón de votar se delega al ExtensionSlot 'retro-vote-button' para que la
 * extensión premium pueda intercambiar la lógica de votación.
 */
function RetroBoard({ retro, projectId }: RetroBoardProps) {
  const { t } = useTranslation();

  // Determinar columnas desde la plantilla; si es desconocida, usar CUSTOM como fallback
  const columns = TEMPLATE_COLUMNS[retro.template] ?? TEMPLATE_COLUMNS.CUSTOM;

  // Estado local de los inputs de nueva tarjeta por columna (clave = nombre de columna)
  const [newCard, setNewCard] = useState<Record<string, string>>({});
  const [newAction, setNewAction] = useState('');
  const [showActions, setShowActions] = useState(false);

  // Todas las mutaciones refrescan la lista de retros para mantener la UI sincronizada
  const [addCard] = useMutation<any>(ADD_RETRO_CARD, { refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }] });
  const [deleteCard] = useMutation<any>(DELETE_RETRO_CARD, { refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }] });
  const [addAction] = useMutation<any>(ADD_RETRO_ACTION, { refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }] });
  const [toggleAction] = useMutation<any>(TOGGLE_RETRO_ACTION, { refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }] });
  const [closeRetro] = useMutation<any>(CLOSE_RETRO, { refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }] });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{retro.title}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Badge de plantilla con color diferenciado según estado de la retro */}
          <span style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', borderRadius: 4, background: retro.status === 'CLOSED' ? '#D1FAE5' : '#DBEAFE', color: retro.status === 'CLOSED' ? '#065F46' : '#1E40AF' }}>
            {t(TEMPLATE_I18N_KEYS[retro.template] ?? retro.template, { defaultValue: retro.template })}
          </span>
          {/* El botón de cierre solo aparece si la retro sigue abierta */}
          {retro.status !== 'CLOSED' && (
            <Button size="sm" variant="ghost" onClick={() => closeRetro({ variables: { id: retro.id } })}>{t('retro.close')}</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setShowActions(!showActions)}>
            {t('retro.actions')} ({retro.actions.length})
          </Button>
        </div>
      </div>

      {/* Columnas — el número de columnas se calcula dinámicamente desde la plantilla */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: '1rem', marginBottom: '1rem' }}>
        {columns.map((col) => {
          // Ordenar tarjetas por votos descendente para mostrar las más populares primero
          const colCards = retro.cards.filter((c) => c.column === col).sort((a, b) => b.votes - a.votes);
          return (
            <div key={col} style={{ background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', padding: '0.75rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t(COLUMN_I18N_KEYS[col] ?? col, { defaultValue: col })} ({colCards.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {colCards.map((card) => (
                  <div key={card.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 6, padding: '0.5rem 0.6rem', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 0.4rem', color: '#1E293B' }}>{card.body}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94A3B8' }}>
                      <span>{card.author.name}</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {/*
                          El botón de votar se delega al slot 'retro-vote-button'.
                          Si la extensión premium no está instalada, se muestra un contador
                          de votos estático como fallback (sin posibilidad de votar).
                        */}
                        <ExtensionSlot
                          name="retro-vote-button"
                          slotProps={{ cardId: card.id, votes: card.votes, projectId }}
                          fallback={<span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>👍 {card.votes}</span>}
                        />
                        {retro.status !== 'CLOSED' && (
                          <button onClick={() => deleteCard({ variables: { id: card.id } })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Input de nueva tarjeta oculto cuando la retro está cerrada */}
              {retro.status !== 'CLOSED' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    value={newCard[col] ?? ''}
                    onChange={(e) => setNewCard((p) => ({ ...p, [col]: e.target.value }))}
                    placeholder={t('retro.addCard')}
                    onKeyDown={(e) => {
                      // Enviar con Enter para agilizar la dinámica de la ceremonia
                      if (e.key === 'Enter' && newCard[col]?.trim()) {
                        addCard({ variables: { retroId: retro.id, column: col, body: newCard[col].trim() } });
                        setNewCard((p) => ({ ...p, [col]: '' }));
                      }
                    }}
                    style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel de ítems de acción, visible solo cuando el usuario lo despliega */}
      {showActions && (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>{t('retro.actionItems')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {retro.actions.map((action) => (
              <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={action.done} onChange={() => toggleAction({ variables: { id: action.id } })} />
                {/* Tachado visual para acciones completadas — refuerza el feedback sin ocultar el ítem */}
                <span style={{ flex: 1, textDecoration: action.done ? 'line-through' : 'none', color: action.done ? '#94A3B8' : '#1E293B' }}>
                  {action.title}
                </span>
                {action.assignedTo && <span style={{ color: '#64748B', fontSize: '0.78rem' }}>{action.assignedTo.name}</span>}
              </div>
            ))}
          </div>
          {retro.status !== 'CLOSED' && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder={t('retro.addAction')}
                onKeyDown={(e) => {
                  // Enter para agregar acción rápidamente durante la ceremonia
                  if (e.key === 'Enter' && newAction.trim()) {
                    addAction({ variables: { retroId: retro.id, title: newAction.trim() } });
                    setNewAction('');
                  }
                }}
                style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Vista principal de Retrospectivas.
 *
 * Muestra la lista de retros del proyecto actual como pestañas y renderiza
 * el tablero de la retro seleccionada. Incluye el modal de creación y
 * el componente headless de sincronización en tiempo real (extensión premium).
 *
 * Flujo de datos:
 *  1. Se consultan todas las retros del proyecto via GraphQL.
 *  2. La extensión 'retro-realtime-sync' (si está instalada) actualiza el estado
 *     local `liveRetros` a través del prop `onRetroUpdate`, sobrescribiendo la
 *     caché de Apollo para reflejar cambios de otros usuarios en tiempo real.
 *  3. Se selecciona la retro activa por ID; si no hay selección explícita, se
 *     muestra la primera de la lista.
 */
export default function RetrospectivesView() {
  const { projectId } = useCurrentProject();
  const { sprint: activeSprint } = useActiveSprint(projectId);
  const { t } = useTranslation();
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [template, setTemplate] = useState('START_STOP_CONTINUE');
  const [selectedRetroId, setSelectedRetroId] = useState<string | null>(null);

  /**
   * Estado que puede ser actualizado por la extensión de sincronización en tiempo real.
   * Cuando es null, se usan los datos de Apollo; cuando tiene valor, tiene prioridad.
   */
  const [liveRetros, setLiveRetros] = useState<Retro[] | null>(null);

  const { data, loading } = useQuery<any>(GET_RETROSPECTIVES, {
    variables: { projectId },
    skip: !projectId,
  });

  // liveRetros tiene prioridad sobre los datos de Apollo para reflejar actualizaciones WS
  const retros: Retro[] = liveRetros ?? data?.retrospectives ?? [];

  // Si no hay retro seleccionada explícitamente, se muestra la primera de la lista
  const selectedRetro = retros.find((r) => r.id === selectedRetroId) ?? retros[0] ?? null;

  const [create, { loading: creating }] = useMutation<any>(CREATE_RETRO, {
    refetchQueries: [{ query: GET_RETROSPECTIVES, variables: { projectId } }],
    onCompleted: (d) => {
      // Seleccionar automáticamente la retro recién creada y cerrar el modal
      setSelectedRetroId(d.createRetrospective.id);
      setShowNew(false);
      setNewTitle('');
    },
  });

  if (loading) return <div style={{ padding: '2rem' }}><Spinner size="lg" /></div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      {/*
        Componente headless de sincronización en tiempo real (extensión premium).
        No renderiza nada en pantalla; solo suscribe al WebSocket y propaga
        los cambios al estado local mediante `onRetroUpdate`.
        Se monta únicamente cuando hay una retro seleccionada para evitar
        suscripciones innecesarias.
      */}
      {selectedRetro?.id && (
        <ExtensionSlot
          name="retro-realtime-sync"
          slotProps={{
            retroId: selectedRetro.id,
            retros: data?.retrospectives ?? [],
            onRetroUpdate: setLiveRetros as (r: unknown) => void,
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{t('retro.title')}</h1>
        <Button variant="primary" onClick={() => setShowNew(true)}>+ {t('retro.newRetro')}</Button>
      </div>

      {/* Pestañas de selección de retro — la activa se resalta con fondo azul */}
      {retros.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {retros.map((r) => (
            <button key={r.id} onClick={() => setSelectedRetroId(r.id)}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0',
                background: (selectedRetro?.id === r.id) ? '#3B82F6' : '#fff',
                color: (selectedRetro?.id === r.id) ? '#fff' : '#475569',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
              }}>
              {r.title}
              {/* Indicador visual de retro cerrada */}
              {r.status === 'CLOSED' && ' ✓'}
            </button>
          ))}
        </div>
      )}

      {selectedRetro ? (
        <RetroBoard retro={selectedRetro} projectId={projectId ?? ''} />
      ) : (
        <p style={{ color: '#94A3B8', textAlign: 'center', padding: '3rem 0' }}>
          {t('retro.noRetros')}
        </p>
      )}

      {/* Modal de creación de nueva retrospectiva */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 400, maxWidth: '90vw' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>{t('retro.newRetro')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* El placeholder sugiere el sprint activo para facilitar el nombrado */}
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus
                placeholder={`Retro Sprint ${activeSprint?.name ?? ''}`}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem' }} />
              <select value={template} onChange={(e) => setTemplate(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
                {Object.keys(TEMPLATE_I18N_KEYS).map((k) => (
                  <option key={k} value={k}>{t(TEMPLATE_I18N_KEYS[k])}</option>
                ))}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button variant="ghost" onClick={() => setShowNew(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" disabled={!newTitle.trim() || creating}
                  onClick={() => create({ variables: { projectId, title: newTitle.trim(), template, sprintId: activeSprint?.id } })}>
                  {t('common.create')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
