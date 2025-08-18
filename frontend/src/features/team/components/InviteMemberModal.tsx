import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { FormField } from '@/components/molecules/FormField/FormField';
import { INVITE_MEMBER } from '@/graphql/team/team.operations';
import { useUIStore } from '@/store/ui.store';
import type { TeamRole } from '@/types/api.types';
import styles from './InviteMemberModal.module.scss';

/**
 * Props del componente InviteMemberModal.
 *
 * @property workspaceId     - ID del workspace al que se invita al miembro.
 * @property onClose         - Callback para cerrar el modal (éxito o cancelación).
 * @property refetchQueries  - Nombres de queries Apollo a refrescar tras la invitación
 *                             (p.ej. lista de miembros del equipo). Por defecto vacío.
 */
interface InviteMemberModalProps {
  workspaceId: string;
  onClose: () => void;
  refetchQueries?: string[];
}

/**
 * Opciones de rol disponibles al invitar a un miembro.
 * Cada opción incluye la descripción de los permisos que otorga
 * para que el invitante elija con conocimiento.
 *
 * Se define fuera del componente para evitar recrear el array en cada render.
 */
const ROLE_OPTIONS: { value: TeamRole; label: string; description: string }[] = [
  { value: 'PRODUCT_OWNER', label: 'Product Owner', description: 'Gestiona el backlog y prioriza historias' },
  { value: 'SCRUM_MASTER', label: 'Scrum Master', description: 'Facilita ceremonias e inicia sprints' },
  { value: 'DEVELOPER', label: 'Developer', description: 'Mueve tareas en el tablero' },
  { value: 'STAKEHOLDER', label: 'Stakeholder', description: 'Solo puede ver reportes' },
];

/**
 * InviteMemberModal — modal para invitar a un nuevo miembro al equipo del workspace.
 *
 * Permite introducir el correo electrónico del usuario a invitar y asignarle
 * un rol Scrum (Product Owner, Scrum Master, Developer o Stakeholder).
 *
 * El usuario invitado debe tener cuenta en ScrumForge; si no la tiene,
 * recibirá el email de invitación pero necesitará registrarse primero.
 *
 * Validación:
 * - El campo de email se valida en tiempo real mientras el usuario escribe
 *   (solo si ya hubo un intento previo de envío con error).
 * - Se valida de nuevo en el envío antes de llamar a la mutation.
 *
 * El resultado de la invitación (éxito o error) se notifica mediante toasts
 * del store global de UI.
 *
 * @param props - Ver {@link InviteMemberModalProps}.
 *
 * @example
 * {showInvite && (
 *   <InviteMemberModal
 *     workspaceId={workspace.id}
 *     onClose={() => setShowInvite(false)}
 *     refetchQueries={['GetTeamMembers']}
 *   />
 * )}
 */
export function InviteMemberModal({ workspaceId, onClose, refetchQueries }: InviteMemberModalProps) {
  const { addToast } = useUIStore();
  // Campos del formulario de invitación
  const [email, setEmail] = useState('');
  // El rol por defecto es DEVELOPER, que es el más común en el equipo
  const [role, setRole] = useState<TeamRole>('DEVELOPER');
  // Error de validación del campo de email
  const [emailError, setEmailError] = useState('');

  // La mutation se dispara con las queries a refrescar que indique el padre
  const [inviteMember, { loading }] = useMutation<any>(INVITE_MEMBER, {
    refetchQueries: refetchQueries ?? [],
  });

  /**
   * Valida el formato del correo electrónico introducido.
   *
   * Se llama tanto en el submit como al escribir (si ya hay un error previo),
   * para dar feedback inmediato al usuario una vez que ha intentado enviar.
   *
   * @param value - Valor actual del campo de email.
   * @returns `true` si el email es válido, `false` en caso contrario.
   */
  function validateEmail(value: string): boolean {
    if (!value.trim()) {
      setEmailError('El correo es requerido');
      return false;
    }
    // Expresión regular básica de validación de formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Ingresa un correo válido');
      return false;
    }
    setEmailError('');
    return true;
  }

  /**
   * Maneja el envío del formulario de invitación.
   *
   * Valida el email, llama a la mutation `inviteMember` y cierra el modal
   * si tiene éxito. En caso de error, muestra un toast con el mensaje del servidor.
   *
   * @param e - Evento de envío del formulario HTML.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Detiene el envío si el email no pasa la validación
    if (!validateEmail(email)) return;

    try {
      await inviteMember({ variables: { workspaceId, email: email.trim(), role } });
      // Toast de éxito que indica el email y el rol asignado
      addToast(`Invitación enviada a ${email} como ${ROLE_OPTIONS.find((r) => r.value === role)?.label}`, 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al invitar miembro', 'error');
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Invitar miembro al equipo"
      size="sm"
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {/* El botón de envío referencia el form por id para funcionar fuera del form */}
          <Button type="submit" form="invite-form" loading={loading} disabled={!email.trim()}>
            Invitar
          </Button>
        </div>
      }
    >
      {/* El id "invite-form" permite que el botón de submit del footer lo controle */}
      <form id="invite-form" onSubmit={handleSubmit} className={styles.form}>
        <FormField
          label="Correo electrónico"
          htmlFor="invite-email"
          error={emailError}
          required
          hint="El usuario debe tener una cuenta en ScrumForge"
        >
          <Input
            id="invite-email"
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Revalida en tiempo real solo si ya se mostró un error previo
              if (emailError) validateEmail(e.target.value);
            }}
            autoFocus
          />
        </FormField>

        {/* Selector de rol mediante radio buttons con tarjetas visuales */}
        <div className={styles.roleField}>
          <p className={styles.roleLabel}>Rol en el equipo *</p>
          <div className={styles.roleOptions}>
            {ROLE_OPTIONS.map((option) => (
              // El modificador CSS --selected se aplica a la tarjeta del rol activo
              <label
                key={option.value}
                className={`${styles.roleOption} ${role === option.value ? styles['roleOption--selected'] : ''}`}
              >
                {/* Radio input oculto visualmente — la tarjeta completa actúa como control */}
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className={styles.roleRadio}
                />
                <div className={styles.roleContent}>
                  <span className={styles.roleName}>{option.label}</span>
                  {/* Descripción de permisos para ayudar al invitante a elegir el rol correcto */}
                  <span className={styles.roleDesc}>{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
