import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { CREATE_WORKSPACE } from '@/graphql/project/project.mutations';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';
import { useUIStore } from '@/store/ui.store';
import styles from './CreateWorkspaceModal.module.scss';

/**
 * @interface CreateWorkspaceModalProps
 * @description Props del modal de creación de workspace.
 */
interface CreateWorkspaceModalProps {
  /** Controla si el modal está visible. Se gestiona desde el componente padre. */
  isOpen: boolean;
  /** Callback invocado al cerrar el modal, ya sea por cancelación o por éxito. */
  onClose: () => void;
  /**
   * Callback opcional invocado tras crear el workspace exitosamente.
   * Recibe el ID del workspace creado para permitir al padre tomar acciones adicionales.
   */
  onCreated?: (workspaceId: string) => void;
}

/**
 * Convierte un texto libre en un slug válido para URL.
 * Aplica las transformaciones en este orden:
 * 1. Convierte a minúsculas.
 * 2. Elimina espacios iniciales/finales.
 * 3. Elimina caracteres que no sean letras, números, espacios ni guiones.
 * 4. Reemplaza grupos de espacios por un guión.
 * 5. Colapsa múltiples guiones consecutivos en uno solo.
 *
 * Se usa tanto para la generación automática del slug a partir del nombre,
 * como para normalizar lo que el usuario escribe directamente en el campo slug.
 *
 * @param {string} value - Texto de entrada a convertir.
 * @returns {string} Slug normalizado con solo caracteres seguros para URL.
 *
 * @example
 * toSlug('Acme Corp!')  // → 'acme-corp'
 * toSlug('Mi  Empresa') // → 'mi-empresa'
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * @component CreateWorkspaceModal
 * @description Modal para crear un nuevo workspace multi-tenant en ScrumForge.
 *
 * Un workspace es el contenedor de nivel superior que agrupa proyectos y miembros
 * del equipo. Cada workspace tiene un slug único que forma parte de su URL
 * (p. ej. `/acme-corp`), lo que permite la navegación directa sin ID opacos.
 *
 * Comportamiento del campo slug:
 * - Se genera **automáticamente** a partir del nombre mientras el usuario no lo edite
 *   manualmente, usando `toSlug()` para normalizarlo.
 * - Una vez que el usuario modifica el slug directamente (`slugEdited = true`),
 *   deja de actualizarse automáticamente para respetar su elección.
 * - Si el backend devuelve un error de slug duplicado o inválido, se muestra
 *   debajo del campo de slug en lugar de en un toast genérico.
 *
 * Tras la creación exitosa:
 * 1. Se persiste el ID del nuevo workspace en localStorage como workspace activo.
 * 2. Se muestra un toast de éxito.
 * 3. Se llama a `onCreated` si el padre necesita reaccionar.
 * 4. Se navega automáticamente a `/{slug}` para llevar al usuario a su nuevo workspace.
 *
 * @param {CreateWorkspaceModalProps} props
 * @returns {JSX.Element} Modal con formulario de nombre y slug del workspace.
 */
export function CreateWorkspaceModal({ isOpen, onClose, onCreated }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  // Flag que indica si el usuario editó el slug manualmente.
  // Mientras sea false, el slug se deriva automáticamente del nombre.
  const [slugEdited, setSlugEdited] = useState(false);

  // Error específico de slug (p. ej. "ya existe") que se muestra en el FormField
  // en lugar de en un toast para mayor proximidad al campo problemático.
  const [slugError, setSlugError] = useState('');

  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const [createWorkspace, { loading }] = useMutation<any>(CREATE_WORKSPACE, {
    // Refrescar la lista de workspaces para que WorkspaceSelector refleje el nuevo
    refetchQueries: [{ query: GET_WORKSPACES }],
  });

  /**
   * Actualiza el nombre y, si el slug aún no fue editado manualmente,
   * sincroniza el slug derivándolo automáticamente del nuevo nombre.
   */
  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(toSlug(value));
    }
  }

  /**
   * Actualiza el slug cuando el usuario lo edita directamente.
   * Activa el flag `slugEdited` para romper la sincronización automática con el nombre.
   */
  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(toSlug(value));
    setSlugError('');
  }

  /**
   * Restablece todos los campos del formulario al cerrar el modal.
   * Es importante resetear `slugEdited` para que en la próxima apertura
   * el slug vuelva a derivarse automáticamente del nombre.
   */
  function handleClose() {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setSlugError('');
    onClose();
  }

  /**
   * Envía la mutación de creación del workspace.
   * Los errores se bifurcan: los de slug van al campo correspondiente;
   * el resto se notifican con un toast de error global.
   */
  async function handleSubmit() {
    if (!name.trim() || !slug.trim()) return;
    setSlugError('');
    try {
      const { data } = await createWorkspace({
        variables: { input: { name: name.trim(), slug: slug.trim() } },
      });
      const newWorkspace = data?.createWorkspace;
      if (newWorkspace) {
        // Persistir el workspace creado como selección activa para la próxima carga
        localStorage.setItem('scrumforge-workspace', newWorkspace.id);
        addToast(`Workspace "${newWorkspace.name}" creado`, 'success');
        onCreated?.(newWorkspace.id);
        handleClose();
        navigate(`/${newWorkspace.slug}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear workspace';
      // Detectar errores relacionados con el slug para mostrarlos cerca del campo
      if (msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('identificador')) {
        setSlugError(msg);
      } else {
        addToast(msg, 'error');
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nuevo workspace"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          {/* Deshabilitado hasta que ambos campos requeridos tengan contenido */}
          <Button onClick={handleSubmit} loading={loading} disabled={!name.trim() || !slug.trim()}>
            Crear workspace
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <FormField label="Nombre del workspace" htmlFor="ws-name" required>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="ej. Acme Corp"
            autoFocus
          />
        </FormField>

        {/* El campo slug muestra una pista de formato y errores del servidor */}
        <FormField
          label="Identificador (slug)"
          htmlFor="ws-slug"
          hint="Solo letras minúsculas, números y guiones"
          required
          error={slugError}
        >
          <Input
            id="ws-slug"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="ej. acme-corp"
          />
        </FormField>

        {/* Vista previa de la URL resultante, visible solo cuando hay un slug */}
        {slug && (
          <p className={styles.preview}>
            URL: <code>/workspace/{slug}</code>
          </p>
        )}
      </div>
    </Modal>
  );
}
