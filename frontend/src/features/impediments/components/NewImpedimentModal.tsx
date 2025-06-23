import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { CREATE_IMPEDIMENT, GET_IMPEDIMENTS } from '@/graphql/impediments/impediment.queries';

/**
 * @interface Props
 * @description Props del modal de creación de impedimentos.
 */
interface Props {
  /** ID del proyecto al que pertenece el impedimento. */
  projectId: string;
  /**
   * ID del sprint activo en el momento de crear el impedimento.
   * Es opcional porque puede registrarse un impedimento fuera de un sprint activo.
   */
  sprintId?: string;
  /** Callback para cerrar el modal, invocado tanto al cancelar como al completar la creación. */
  onClose: () => void;
}

/**
 * Categorías válidas de impedimento según la taxonomía del sistema.
 * - TECHNICAL: problemas de deuda técnica, dependencias de herramientas, etc.
 * - EXTERNAL: bloqueos por terceros, proveedores o dependencias fuera del equipo.
 * - ORGANIZATIONAL: procesos internos, aprobaciones, estructura organizativa.
 * - OTHER: cualquier impedimento que no encaje en las anteriores.
 */
const CATEGORIES = ['TECHNICAL', 'EXTERNAL', 'ORGANIZATIONAL', 'OTHER'];

/**
 * Niveles de impacto disponibles, ordenados de mayor a menor severidad.
 * Se usan para priorizar la atención del Scrum Master.
 */
const IMPACTS = ['HIGH', 'MEDIUM', 'LOW'];

/**
 * Mapeo de claves de categoría a etiquetas en español para el selector.
 * Se mantiene separado del array de categorías para facilitar la localización futura.
 */
const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'Técnico', EXTERNAL: 'Externo', ORGANIZATIONAL: 'Organizacional', OTHER: 'Otro',
};

/**
 * Mapeo de claves de impacto a etiquetas en español para el selector.
 */
const IMPACT_LABELS: Record<string, string> = { HIGH: 'Alto', MEDIUM: 'Medio', LOW: 'Bajo' };

/**
 * @component NewImpedimentModal
 * @description Modal para registrar un nuevo impedimento que bloquea al equipo.
 *
 * Un impedimento es cualquier obstáculo que impide al equipo avanzar según lo planificado
 * y que requiere intervención del Scrum Master u otra persona fuera del equipo de desarrollo.
 *
 * El formulario captura:
 * - **Título** (obligatorio): descripción breve del problema.
 * - **Descripción** (opcional): contexto adicional para quien deba resolverlo.
 * - **Categoría**: tipo de impedimento para facilitar su asignación y análisis posterior.
 * - **Impacto**: severidad del bloqueo para priorizar la resolución.
 *
 * Los valores por defecto (categoría OTHER, impacto MEDIUM) son los más comunes en la práctica,
 * reduciendo el esfuerzo del usuario en el caso habitual.
 *
 * Al crearse exitosamente, se refrescan los impedimentos del proyecto y se cierra el modal.
 *
 * @param {Props} props
 * @returns {JSX.Element} Modal con formulario de creación de impedimento.
 */
export function NewImpedimentModal({ projectId, sprintId, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [impact, setImpact] = useState('MEDIUM');

  const [create, { loading }] = useMutation<any>(CREATE_IMPEDIMENT, {
    // Refrescar la lista de impedimentos del proyecto tras crear uno nuevo
    // para que la vista principal refleje inmediatamente el nuevo registro.
    refetchQueries: [{ query: GET_IMPEDIMENTS, variables: { projectId } }],
    onCompleted: onClose,
  });

  /**
   * Maneja el envío del formulario.
   * La descripción vacía se convierte en `undefined` para no enviar un string vacío
   * al backend, manteniendo la semántica de "campo no especificado".
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create({ variables: { input: { title: title.trim(), description: description || undefined, category, impact, projectId, sprintId } } });
  };

  return (
    <Modal isOpen title="Nuevo impedimento" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Título *
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Describe el impedimento..."
            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem', boxSizing: 'border-box' }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Contexto adicional..."
            style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {/* Selectores de categoría e impacto en fila para aprovechar el espacio horizontal */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Impacto</label>
            <select value={impact} onChange={(e) => setImpact(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem' }}>
              {IMPACTS.map((i) => <option key={i} value={i}>{IMPACT_LABELS[i]}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          {/* El botón de submit se deshabilita si el título está vacío o durante la mutación */}
          <Button variant="primary" type="submit" disabled={!title.trim() || loading}>
            {loading ? 'Creando...' : 'Crear impedimento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
