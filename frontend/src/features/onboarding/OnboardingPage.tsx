// src/features/onboarding/OnboardingPage.tsx
/**
 * @file OnboardingPage.tsx
 * Wizard de configuración inicial de ScrumForge para nuevos usuarios.
 *
 * Guía al usuario a través de 3 pasos:
 *  1. Crear y nombrar su workspace (con validación de slug único).
 *  2. Invitar miembros del equipo (paso opcional).
 *  3. Crear el primer proyecto con nombre y key.
 *
 * Al completar el wizard, se crean el workspace, el proyecto y las invitaciones
 * de forma secuencial mediante mutaciones GraphQL, y se redirige al usuario a
 * la página de verificación de email.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { Button } from '@/components/atoms/Button/Button';
import { Input } from '@/components/atoms/Input/Input';
import { FormField } from '@/components/molecules/FormField/FormField';
import { useUIStore } from '@/store/ui.store';
import { CREATE_WORKSPACE } from '@/graphql/project/project.mutations';
import { CREATE_PROJECT } from '@/graphql/project/project.mutations';
import { INVITE_MEMBER } from '@/graphql/team/team.operations';
import { GET_WORKSPACE_BY_SLUG } from '@/graphql/workspace/workspace.queries';
import { ROUTES } from '@/constants/routes';
import type { TeamRole } from '@/types/api.types';
import styles from './OnboardingPage.module.scss';
import { useApolloClient } from '@apollo/client/react';

/** Número total de pasos del wizard de onboarding. */
const TOTAL_STEPS = 3;

/**
 * Convierte un texto libre en un slug válido para URL.
 * Reglas aplicadas (en orden):
 *  1. Todo a minúsculas.
 *  2. Elimina caracteres no alfanuméricos (excepto espacios y guiones).
 *  3. Reemplaza espacios por guiones.
 *  4. Colapsa guiones múltiples en uno solo.
 *  5. Trunca a 50 caracteres máximo.
 *
 * @param value - Texto a convertir en slug (p.ej. nombre del workspace).
 * @returns Slug normalizado listo para usarse en una URL.
 *
 * @example
 * slugify('Mi Empresa S.A.') // => 'mi-empresa-sa'
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Genera una key de proyecto (identificador corto) a partir del nombre.
 * Extrae solo letras, las convierte a mayúsculas y trunca a 4 caracteres.
 *
 * @param value - Nombre del proyecto del que derivar la key.
 * @returns Key en mayúsculas de máximo 4 letras (p.ej. `'MIPR'`).
 *
 * @example
 * projectKeyify('Mi Proyecto') // => 'MP'
 * projectKeyify('Alpha Release') // => 'AR'
 */
function projectKeyify(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

/**
 * Fila del formulario de invitación de miembro.
 * Representa una entrada con email y rol en el paso 2 del wizard.
 */
interface InviteeRow {
  /** Dirección de correo del invitado. */
  email: string;
  /** Rol que tendrá el invitado en el workspace. */
  role: TeamRole;
}

/**
 * Props del indicador de pasos del wizard.
 */
interface StepIndicatorProps {
  /** Número del paso actual (base 1). */
  current: number;
  /** Número total de pasos. */
  total: number;
}

/**
 * Indicador visual del progreso en el wizard de onboarding.
 * Renderiza un punto por cada paso con estilos diferenciados para
 * el paso activo, los completados y los pendientes.
 *
 * @param current - Número del paso actual.
 * @param total - Número total de pasos del wizard.
 */
function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className={styles.stepIndicator}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          // Aplica clases CSS diferenciadas según si el paso es activo, completado o pendiente
          className={`${styles.stepDot} ${i + 1 === current ? styles['stepDot--active'] : ''} ${i + 1 < current ? styles['stepDot--done'] : ''}`}
        />
      ))}
      <span className={styles.stepLabel}>Paso {current} de {total}</span>
    </div>
  );
}

/**
 * OnboardingPage
 *
 * Wizard de 3 pasos para configurar un nuevo workspace de ScrumForge.
 *
 * Estado del wizard:
 * - Paso 1: nombre y slug del workspace (validación de disponibilidad en tiempo real).
 * - Paso 2: invitación de miembros del equipo (opcional, se puede omitir).
 * - Paso 3: nombre y key del primer proyecto.
 *
 * Al finalizar (`handleFinish`), el wizard ejecuta en orden:
 *  1. Crea el workspace.
 *  2. Crea el proyecto dentro del equipo por defecto del workspace.
 *  3. Envía las invitaciones de forma no bloqueante (los errores individuales se ignoran).
 *  4. Redirige a la página de verificación de email.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  // Cliente Apollo usado para realizar la comprobación de disponibilidad del slug
  const apolloClient = useApolloClient();

  // ── Estado del paso 1: workspace ─────────────────────────────────────────
  /** Paso activo del wizard (1-3). */
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  /** `true` si el usuario ha editado manualmente el slug (desactiva la auto-generación). */
  const [slugManual, setSlugManual] = useState(false);
  /** `true` = disponible, `false` = ocupado, `null` = sin verificar / verificando. */
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  /** `true` mientras se verifica la disponibilidad del slug en el servidor. */
  const [checkingSlug, setCheckingSlug] = useState(false);

  // ── Estado del paso 2: invitados ─────────────────────────────────────────
  /** Lista de filas de invitados; comienza con una fila vacía por defecto. */
  const [invitees, setInvitees] = useState<InviteeRow[]>([{ email: '', role: 'DEVELOPER' }]);

  // ── Estado del paso 3: proyecto ──────────────────────────────────────────
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  /** `true` si el usuario ha editado manualmente la key del proyecto. */
  const [projectKeyManual, setProjectKeyManual] = useState(false);

  /** `true` mientras se ejecutan las mutaciones de creación al finalizar el wizard. */
  const [submitting, setSubmitting] = useState(false);

  const [createWorkspace] = useMutation<any>(CREATE_WORKSPACE);
  const [createProject] = useMutation<any>(CREATE_PROJECT);
  const [inviteMember] = useMutation<any>(INVITE_MEMBER);

  /**
   * Verifica si un slug de workspace está disponible consultando el servidor.
   * Usa `network-only` para evitar falsas disponibilidades desde caché.
   * En caso de error de red, deja `slugAvailable` en `null` y no bloquea el avance.
   *
   * @param slug - Slug a verificar.
   */
  const checkSlugAvailability = useCallback(
    async (slug: string) => {
      if (!slug) { setSlugAvailable(null); return; }
      setCheckingSlug(true);
      try {
        const result = await apolloClient.query<any>({
          query: GET_WORKSPACE_BY_SLUG,
          variables: { slug },
          // Siempre consultar al servidor para garantizar datos frescos
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
        });
        // Resultado no-nulo indica que el slug ya está en uso
        setSlugAvailable(result.data?.workspaceBySlug == null);
      } catch {
        // Fallo de red — se permite continuar de forma optimista sin bloquear al usuario
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    },
    [apolloClient],
  );

  /**
   * Maneja el cambio del nombre del workspace.
   * Si el usuario no ha editado el slug manualmente, lo genera automáticamente
   * a partir del nombre y verifica su disponibilidad.
   *
   * @param value - Nuevo valor del campo de nombre.
   */
  function handleWorkspaceNameChange(value: string) {
    setWorkspaceName(value);
    if (!slugManual) {
      // Auto-generación del slug a partir del nombre mientras no se ha editado manualmente
      const auto = slugify(value);
      setWorkspaceSlug(auto);
      void checkSlugAvailability(auto);
    }
  }

  /**
   * Maneja el cambio manual del slug del workspace.
   * A partir de este momento, la auto-generación queda desactivada.
   *
   * @param value - Valor introducido por el usuario en el campo de slug.
   */
  function handleSlugChange(value: string) {
    setSlugManual(true);
    const clean = slugify(value);
    setWorkspaceSlug(clean);
    void checkSlugAvailability(clean);
  }

  /**
   * Maneja el cambio del nombre del proyecto.
   * Si el usuario no ha editado la key manualmente, la genera automáticamente.
   *
   * @param value - Nuevo valor del campo de nombre de proyecto.
   */
  function handleProjectNameChange(value: string) {
    setProjectName(value);
    if (!projectKeyManual) {
      // Auto-generación de la key del proyecto a partir de las iniciales del nombre
      setProjectKey(projectKeyify(value).slice(0, 4));
    }
  }

  /**
   * Maneja el cambio manual de la key del proyecto.
   * Solo permite letras mayúsculas y hasta 4 caracteres.
   *
   * @param value - Valor introducido por el usuario.
   */
  function handleProjectKeyChange(value: string) {
    setProjectKeyManual(true);
    setProjectKey(value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));
  }

  /**
   * Añade una nueva fila vacía de invitado a la lista del paso 2.
   * El rol por defecto es `DEVELOPER`, el más común.
   */
  function addInvitee() {
    setInvitees((prev) => [...prev, { email: '', role: 'DEVELOPER' }]);
  }

  /**
   * Actualiza un campo concreto de una fila de invitado.
   *
   * @param index - Índice de la fila a actualizar.
   * @param field - Campo a modificar (`'email'` o `'role'`).
   * @param value - Nuevo valor del campo.
   */
  function updateInvitee(index: number, field: keyof InviteeRow, value: string) {
    setInvitees((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  /**
   * Elimina una fila de invitado por su índice.
   * Solo se llama si hay más de una fila (el botón de eliminar se oculta cuando queda una).
   *
   * @param index - Índice de la fila a eliminar.
   */
  function removeInvitee(index: number) {
    setInvitees((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Ejecuta la secuencia de creación al completar el wizard:
   *  1. Crea el workspace con nombre y slug.
   *  2. Obtiene el ID del equipo por defecto creado junto al workspace.
   *  3. Crea el proyecto con nombre, key y equipo.
   *  4. Envía invitaciones a los miembros (las que fallen se omiten silenciosamente).
   *  5. Redirige al usuario a la verificación de email.
   *
   * Si el backend devuelve un error que contiene 'slug', retrocede al paso 1
   * para que el usuario pueda cambiar el slug conflictivo.
   */
  async function handleFinish() {
    if (!workspaceName || !workspaceSlug || !projectName || !projectKey) return;
    setSubmitting(true);
    try {
      // 1. Crear workspace
      const wsResult = await createWorkspace({
        variables: { input: { name: workspaceName, slug: workspaceSlug } },
      });
      const createdWs = wsResult.data?.createWorkspace;
      if (!createdWs) throw new Error('No se pudo crear el workspace');

      // El workspace siempre crea un equipo por defecto; se usa su ID para el proyecto
      const teamId: string = createdWs.teams?.[0]?.id;
      if (!teamId) throw new Error('El workspace no tiene equipos');

      // 2. Crear proyecto dentro del equipo por defecto
      const projResult = await createProject({
        variables: { input: { name: projectName, key: projectKey, teamId } },
      });
      const createdProject = projResult.data?.createProject;
      if (!createdProject) throw new Error('No se pudo crear el proyecto');

      // 3. Invitar miembros (opcional) — los errores individuales no bloquean el flujo
      const validInvitees = invitees.filter((inv) => inv.email.trim());
      for (const inv of validInvitees) {
        try {
          await inviteMember({
            variables: { workspaceId: createdWs.id, email: inv.email.trim(), role: inv.role },
          });
        } catch {
          // Invitación fallida — se ignora para no bloquear el onboarding
        }
      }

      addToast('Workspace y proyecto creados con éxito', 'success');
      // Redirigir a verificación de email — el acceso al workspace requiere email verificado
      navigate(ROUTES.VERIFY_EMAIL);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el workspace';
      addToast(msg, 'error');
      // Si el error es de slug duplicado, volver al paso 1 para que el usuario lo cambie
      if (typeof msg === 'string' && msg.includes('slug')) {
        setSlugAvailable(false);
        setStep(1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <span className={styles['brand__icon']}>⚒</span>
            <span className={styles['brand__name']}>ScrumForge</span>
          </div>
          <h1 className={styles.title}>Configura tu workspace</h1>
          <p className={styles.subtitle}>Solo tarda 2 minutos</p>
          <StepIndicator current={step} total={TOTAL_STEPS} />
        </div>

        {/* Step 1: Workspace name & slug */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Nombra tu workspace</h2>
            <p className={styles.stepDescription}>
              El workspace es el espacio donde tu equipo colaborará.
            </p>
            <div className={styles.form}>
              <FormField label="Nombre del workspace" htmlFor="ws-name" required>
                <Input
                  id="ws-name"
                  value={workspaceName}
                  onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                  placeholder="Mi empresa"
                  autoFocus
                />
              </FormField>
              <FormField
                label="URL del workspace (slug)"
                htmlFor="ws-slug"
                hint={
                  checkingSlug
                    ? 'Verificando disponibilidad...'
                    : slugAvailable === true
                    ? '✓ Disponible'
                    : slugAvailable === false
                    ? 'Este slug ya está en uso'
                    : workspaceSlug
                    ? 'No se pudo verificar disponibilidad'
                    : 'Solo letras minúsculas, números y guiones'
                }
                error={slugAvailable === false ? 'Elige otro slug' : undefined}
              >
                <Input
                  id="ws-slug"
                  value={workspaceSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="mi-empresa"
                  error={slugAvailable === false}
                />
              </FormField>
              {workspaceSlug && (
                <p className={styles.urlPreview}>
                  scrumforge.dev/<strong>{workspaceSlug}</strong>
                </p>
              )}
            </div>
            <div className={styles.actions}>
              <Button
                onClick={() => setStep(2)}
                disabled={!workspaceName.trim() || !workspaceSlug.trim() || checkingSlug || slugAvailable !== true}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Invite teammates */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Invita a tu equipo</h2>
            <p className={styles.stepDescription}>
              Puedes invitar personas ahora o hacerlo más tarde desde configuración.
            </p>
            <div className={styles.inviteList}>
              {invitees.map((row, index) => (
                <div key={index} className={styles.inviteRow}>
                  <Input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateInvitee(index, 'email', e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className={styles.inviteEmail}
                  />
                  <select
                    value={row.role}
                    onChange={(e) => updateInvitee(index, 'role', e.target.value)}
                    className={styles.inviteRole}
                  >
                    <option value="DEVELOPER">Developer</option>
                    <option value="SCRUM_MASTER">Scrum Master</option>
                    <option value="PRODUCT_OWNER">Product Owner</option>
                    <option value="STAKEHOLDER">Stakeholder</option>
                  </select>
                  {invitees.length > 1 && (
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeInvitee(index)}
                      type="button"
                      aria-label="Eliminar"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={addInvitee} type="button">
                + Añadir otro
              </Button>
            </div>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setStep(3)}>
                Omitir por ahora
              </Button>
              <Button onClick={() => setStep(3)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Create first project */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Crea tu primer proyecto</h2>
            <p className={styles.stepDescription}>
              Un proyecto agrupa tu backlog, sprints y tablero.
            </p>
            <div className={styles.form}>
              <FormField label="Nombre del proyecto" htmlFor="proj-name" required>
                <Input
                  id="proj-name"
                  value={projectName}
                  onChange={(e) => handleProjectNameChange(e.target.value)}
                  placeholder="Mi proyecto"
                  autoFocus
                />
              </FormField>
              <FormField
                label="Key del proyecto (2-4 letras)"
                htmlFor="proj-key"
                hint="Identificador corto para tickets (p.ej. MP-1, MP-2)"
              >
                <Input
                  id="proj-key"
                  value={projectKey}
                  onChange={(e) => handleProjectKeyChange(e.target.value)}
                  placeholder="MP"
                  maxLength={4}
                />
              </FormField>
            </div>
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <Button
                onClick={handleFinish}
                loading={submitting}
                disabled={!projectName.trim() || projectKey.length < 2}
              >
                Empezar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
