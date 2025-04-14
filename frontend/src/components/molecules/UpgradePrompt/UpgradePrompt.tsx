import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import styles from './UpgradePrompt.module.scss';

/**
 * Props del componente UpgradePrompt.
 *
 * @property feature  - Nombre de la funcionalidad bloqueada, mostrado en el subtítulo.
 * @property plan     - Plan mínimo requerido para acceder a la funcionalidad.
 * @property children - Contenido de la vista bloqueada (opcional). Si se proporciona,
 *                      se muestra difuminado debajo del banner de upgrade como preview.
 */
export interface UpgradePromptProps {
  feature: string;
  plan: 'pro' | 'business';
  children?: ReactNode;
}

/**
 * Etiquetas legibles para los planes de suscripción.
 * Se mapea aquí para no repetir la lógica de presentación en la plantilla.
 */
const PLAN_LABELS: Record<'pro' | 'business', string> = {
  pro: 'Pro',
  business: 'Business',
};

/**
 * UpgradePrompt — banner de actualización de plan con preview bloqueado opcional.
 *
 * Tiene dos modos de renderizado:
 *
 * 1. **Sin children** → muestra solo el banner de upgrade en línea (útil para
 *    reemplazar directamente el contenido de una sección premium).
 *
 * 2. **Con children** → muestra el banner superpuesto sobre el contenido,
 *    con el contenido hijo difuminado y con `inert` para que no sea interactivo
 *    ni accesible. Esto crea un efecto de "preview bloqueado" que incentiva
 *    al upgrade al mostrar qué funcionalidades el usuario se está perdiendo.
 *
 * El atributo `inert` en el contenido hijo es importante: evita que el usuario
 * pueda interactuar con botones o formularios ocultos bajo el overlay, y que
 * los lectores de pantalla los anuncien.
 *
 * @example
 * // Modo inline — reemplaza completamente el contenido
 * <UpgradePrompt feature="Reportes avanzados" plan="pro" />
 *
 * // Modo overlay — muestra el contenido bloqueado como preview
 * <UpgradePrompt feature="Auditoría de actividad" plan="business">
 *   <AuditLog entries={entries} />
 * </UpgradePrompt>
 */
export function UpgradePrompt({ feature, plan, children }: UpgradePromptProps) {
  const navigate = useNavigate();

  // Banner reutilizable en ambos modos de renderizado
  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerContent}>
        {/* Icono diferenciado por plan para reforzar la identidad visual */}
        <span className={styles.icon} aria-hidden="true">
          {plan === 'business' ? '🏢' : '⭐'}
        </span>
        <div>
          <p className={styles.title}>
            Esta función requiere el plan{' '}
            {/* Badge con color propio del plan (definido en el SCSS via modificador) */}
            <span className={`${styles.planBadge} ${styles[`planBadge--${plan}`]}`}>
              {PLAN_LABELS[plan]}
            </span>
          </p>
          <p className={styles.subtitle}>{feature} no está disponible en tu plan actual.</p>
        </div>
      </div>
      {/* Redirige a la página de precios para que el usuario pueda hacer upgrade */}
      <Button
        size="sm"
        onClick={() => navigate(ROUTES.PRICING)}
      >
        Ver planes
      </Button>
    </div>
  );

  // Modo inline: sin children, solo se muestra el banner
  if (!children) return banner;

  // Modo overlay: contenido bloqueado + banner superpuesto
  return (
    <div className={styles.wrapper}>
      {/* Capa semitransparente que oscurece el contenido bloqueado */}
      <div className={styles.overlay} aria-hidden="true" />
      {/* El contenido hijo se muestra como preview visual pero no es interactuable */}
      <div className={styles.children} aria-hidden="true" inert>
        {children}
      </div>
      {/* El banner de upgrade flota sobre el contenido bloqueado */}
      <div className={styles.bannerOverlay}>
        {banner}
      </div>
    </div>
  );
}
