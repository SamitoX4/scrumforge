/**
 * @file DependenciesTab.tsx
 * Pestaña de dependencias entre historias de usuario.
 *
 * Permite al usuario ver qué historias bloquean o están relacionadas con la
 * historia actual, así como añadir o eliminar dependencias de forma inline.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { Button } from '@/components/atoms/Button/Button';
import {
  GET_STORY_DEPENDENCIES, ADD_DEPENDENCY, REMOVE_DEPENDENCY,
} from '@/graphql/dependencies/dependency.queries';

/**
 * Etiquetas legibles para cada tipo de dependencia entre historias.
 * El tipo se guarda en DB con las claves en mayúsculas; aquí se traduce al español.
 */
const TYPE_LABELS: Record<string, string> = {
  BLOCKS: 'Bloquea a', BLOCKED_BY: 'Bloqueada por', RELATED: 'Relacionada con',
};

/**
 * Colores de punto de estado para las historias relacionadas.
 * Ayuda a visualizar rápidamente si una dependencia está bloqueando el flujo.
 */
const STATUS_COLORS: Record<string, string> = {
  DONE: '#16A34A', IN_PROGRESS: '#2563EB', IN_REVIEW: '#7C3AED', TODO: '#64748B',
};

/** Dependencia entre dos historias de usuario. */
interface Dep {
  id: string;
  type: string;
  fromStoryId: string;
  toStoryId: string;
  fromStory: { id: string; title: string; status: string };
  toStory: { id: string; title: string; status: string };
}

/**
 * Props de DependenciesTab.
 * @property storyId - Historia actual desde cuyo punto de vista se muestran las dependencias.
 * @property projectStories - Lista de historias del proyecto para el selector de dependencia nueva.
 *   Si no se pasa, el selector de candidatos quedará vacío.
 */
interface Props { storyId: string; projectStories?: { id: string; title: string }[] }

/**
 * Pestaña de Dependencias de una historia de usuario.
 *
 * Muestra las dependencias existentes de la historia actual (tanto como origen
 * como como destino) y permite agregar nuevas o eliminar existentes.
 *
 * Lógica de candidatos:
 *  Para evitar dependencias duplicadas o circulares inmediatas, el selector de
 *  historias filtra las que ya forman parte de alguna dependencia de la historia actual.
 *
 * La etiqueta de cada dependencia se calcula según si la historia actual es
 * el origen (fromStory) o el destino (toStory) de la relación:
 *  - Si es origen: se muestra "Bloquea a <otra>"
 *  - Si es destino: se muestra "Bloqueada por <otra>"
 */
export function DependenciesTab({ storyId, projectStories = [] }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  // Tipo de dependencia seleccionado en el formulario (por defecto BLOCKED_BY, el más común)
  const [type, setType] = useState('BLOCKED_BY');
  const [targetId, setTargetId] = useState('');

  const { data, loading, refetch } = useQuery<any>(GET_STORY_DEPENDENCIES, { variables: { storyId } });
  const [add, { loading: adding }] = useMutation<any>(ADD_DEPENDENCY, { onCompleted: () => { setShowAdd(false); setTargetId(''); refetch(); } });
  const [remove] = useMutation<any>(REMOVE_DEPENDENCY, { onCompleted: () => refetch() });

  const deps: Dep[] = data?.storyDependencies ?? [];

  if (loading) return <p style={{ color: '#94A3B8', fontSize: '0.85rem' }}>Cargando...</p>;

  /**
   * IDs de todas las historias que ya tienen alguna dependencia con la historia actual.
   * Usado para excluirlas del selector de candidatos y evitar duplicados.
   */
  const relatedIds = new Set(deps.flatMap((d) => [d.fromStoryId, d.toStoryId]));
  // Filtrar candidatos: ni la propia historia ni las ya relacionadas
  const candidates = projectStories.filter((s) => s.id !== storyId && !relatedIds.has(s.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {deps.length === 0 && !showAdd && (
        <p style={{ color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0' }}>Sin dependencias.</p>
      )}

      {deps.map((dep) => {
        // Determinar la perspectiva: si esta historia es el origen o el destino
        const isFrom = dep.fromStoryId === storyId;
        // La "otra" historia es la que no es la historia actual
        const other = isFrom ? dep.toStory : dep.fromStory;
        const label = TYPE_LABELS[dep.type] ?? dep.type;
        return (
          <div key={dep.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
            <span style={{ color: '#64748B', flexShrink: 0 }}>{label}</span>
            <span style={{ flex: 1, color: '#1E293B', fontWeight: 500 }}>{other.title}</span>
            {/* Punto de color para indicar el estado de la historia relacionada */}
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[other.status] ?? '#94A3B8', flexShrink: 0 }} />
            <button onClick={() => remove({ variables: { id: dep.id } })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '0.8rem', padding: '0 2px' }}
              title="Eliminar">✕</button>
          </div>
        );
      })}

      {/* Formulario inline de nueva dependencia */}
      {showAdd && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', padding: '0.5rem', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
          <select value={type} onChange={(e) => setType(e.target.value)}
            style={{ padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
            style={{ flex: 1, minWidth: 120, padding: '0.3rem 0.5rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
            <option value="">Selecciona historia...</option>
            {candidates.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          {/* La historia actual siempre es el fromStory; el usuario selecciona el toStory */}
          <Button size="sm" variant="primary" disabled={!targetId || adding}
            onClick={() => add({ variables: { fromStoryId: storyId, toStoryId: targetId, type } })}>
            Agregar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>✕</Button>
        </div>
      )}

      {!showAdd && (
        <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>+ Agregar dependencia</Button>
      )}
    </div>
  );
}
