import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { GET_DOD_ITEMS, CREATE_DOD_ITEM, DELETE_DOD_ITEM, UPDATE_DOD_ITEM } from '@/graphql/dod/dod.queries';
import { Button } from '@/components/atoms/Button/Button';

/**
 * @interface DodItem
 * @description Representa un criterio individual dentro de la Definition of Done del proyecto.
 */
interface DodItem {
  /** Identificador único del criterio en base de datos. */
  id: string;
  /** Texto descriptivo del criterio (p. ej. "Código revisado por un par"). */
  text: string;
  /** Posición del criterio en la lista ordenada, usada para mantener el orden de visualización. */
  order: number;
}

/**
 * @interface Props
 * @description Props del componente DodSettings.
 */
interface Props {
  /** ID del proyecto al que pertenece esta Definition of Done. */
  projectId: string;
}

/**
 * @component DodSettings
 * @description Panel de configuración de la Definition of Done (DoD) de un proyecto.
 *
 * Permite al equipo gestionar la lista de criterios que una historia de usuario debe
 * cumplir antes de considerarse "Done". Es parte de la configuración del proyecto y
 * generalmente accesible solo para Scrum Masters y Product Owners.
 *
 * Funcionalidades:
 * - **Ver** todos los criterios actuales del proyecto via GraphQL.
 * - **Crear** nuevos criterios con el campo de texto inferior (soporta Enter para enviar).
 * - **Editar inline** un criterio existente: al hacer clic en "Editar" se convierte en
 *   un input con confirmación por botón o tecla Enter, y cancelación con Escape.
 * - **Eliminar** un criterio con el botón ✕.
 *
 * Cada mutación incluye `refetchQueries` apuntando a `GET_DOD_ITEMS` para mantener
 * la lista sincronizada con el servidor sin necesitar actualización manual de caché.
 *
 * @param {Props} props
 * @returns {JSX.Element} Panel con la lista de criterios DoD y controles de edición.
 */
export function DodSettings({ projectId }: Props) {
  const { t } = useTranslation();

  // Estado para el campo de creación de nuevo criterio
  const [newText, setNewText] = useState('');

  // Estado del modo edición inline: almacena el ID del ítem que se está editando
  // (null cuando ninguno está en edición) y el texto temporal del editor.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const { data, loading } = useQuery<any>(GET_DOD_ITEMS, { variables: { projectId } });

  // Mutación de creación: al completar limpia el campo de texto para permitir
  // crear otro criterio de forma inmediata sin interacción extra del usuario.
  const [create, { loading: creating }] = useMutation<any>(CREATE_DOD_ITEM, {
    refetchQueries: [{ query: GET_DOD_ITEMS, variables: { projectId } }],
    onCompleted: () => setNewText(''),
  });

  // Mutación de actualización: al completar sale del modo edición inline.
  const [update] = useMutation<any>(UPDATE_DOD_ITEM, {
    refetchQueries: [{ query: GET_DOD_ITEMS, variables: { projectId } }],
    onCompleted: () => setEditingId(null),
  });

  const [remove] = useMutation<any>(DELETE_DOD_ITEM, {
    refetchQueries: [{ query: GET_DOD_ITEMS, variables: { projectId } }],
  });

  // Fallback a array vacío para que el renderizado sea seguro mientras carga
  const items: DodItem[] = data?.dodItems ?? [];

  return (
    <div>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('dod.title')}</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {t('dod.hint')}
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('dod.loading')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {items.map((item) => (
            <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
              {/* Modo edición inline: se activa cuando editingId coincide con el id del ítem */}
              {editingId === item.id ? (
                <>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      // Enter confirma la edición; Escape la cancela sin guardar cambios
                      if (e.key === 'Enter') update({ variables: { id: item.id, text: editText.trim() } });
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    style={{ flex: 1, padding: '0.25rem 0.4rem', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                  <Button size="sm" variant="primary" onClick={() => update({ variables: { id: item.id, text: editText.trim() } })}>✓</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                </>
              ) : (
                /* Modo lectura: muestra el texto con ícono de checklist y botones de acción */
                <>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>☑ {item.text}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(item.id); setEditText(item.text); }}>{t('dod.edit')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove({ variables: { id: item.id } })}>✕</Button>
                </>
              )}
            </li>
          ))}
          {/* Estado vacío: guía al usuario a añadir el primer criterio */}
          {items.length === 0 && (
            <li style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
              {t('dod.empty')}
            </li>
          )}
        </ul>
      )}

      {/* Formulario de adición rápida: soporta tanto clic en botón como tecla Enter */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder={t('dod.placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && newText.trim()) create({ variables: { projectId, text: newText.trim() } }); }}
          style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.85rem', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        />
        <Button variant="secondary" disabled={!newText.trim() || creating}
          onClick={() => create({ variables: { projectId, text: newText.trim() } })}>
          {t('dod.add')}
        </Button>
      </div>
    </div>
  );
}
