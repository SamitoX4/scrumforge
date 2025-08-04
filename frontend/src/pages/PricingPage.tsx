/**
 * @file PricingPage.tsx
 * @description Página pública de precios de ScrumForge. Muestra los tres planes
 * disponibles (Free, Pro, Business) con una tabla comparativa de características.
 *
 * Esta es una página de marketing accesible sin autenticación, por lo que incluye
 * su propia barra de navegación (a diferencia del resto de páginas que usan el
 * layout de la aplicación). La nav adapta sus acciones según el estado de auth:
 * - Usuario autenticado: enlace a "Mi workspace".
 * - Usuario no autenticado: enlaces a login y registro.
 *
 * Los planes Pro y Business aún no están implementados en el backend (Stripe pendiente),
 * por lo que sus botones CTA muestran un mensaje "Próximamente" en lugar de iniciar
 * el flujo de pago. El estado `ProStatus` controla este comportamiento.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/atoms/Button/Button';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/constants/routes';
import styles from './PricingPage.module.scss';

/**
 * Describe una característica del producto con su disponibilidad por plan.
 * El valor puede ser:
 * - `true`: la característica está disponible sin restricciones en ese plan.
 * - `false`: la característica no está disponible en ese plan.
 * - `string`: la característica está disponible pero con una restricción cuantitativa
 *   (ej. "Hasta 3", "1", "Ilimitados").
 */
interface PricingFeature {
  /** Nombre descriptivo de la característica mostrado en la tabla. */
  label: string;
  /** Disponibilidad en el plan Free. */
  free: boolean | string;
  /** Disponibilidad en el plan Pro. */
  pro: boolean | string;
  /** Disponibilidad en el plan Business. */
  business: boolean | string;
}

/**
 * Lista completa de características comparadas entre planes.
 * Ordenadas de más básicas (incluidas en todos los planes) a más avanzadas
 * (solo en Business), para que la tabla sea fácil de escanear de arriba a abajo.
 */
const FEATURES: PricingFeature[] = [
  { label: 'Proyectos', free: 'Hasta 3', pro: 'Ilimitados', business: 'Ilimitados' },
  { label: 'Miembros por workspace', free: 'Hasta 5', pro: 'Ilimitados', business: 'Ilimitados' },
  { label: 'Sprints activos', free: '1', pro: 'Ilimitados', business: 'Ilimitados' },
  { label: 'Backlog & Tablero Kanban', free: true, pro: true, business: true },
  { label: 'Épicas y User Stories', free: true, pro: true, business: true },
  { label: 'Reportes básicos', free: true, pro: true, business: true },
  { label: 'Reportes avanzados (Burndown, Velocidad)', free: false, pro: true, business: true },
  { label: 'Notificaciones en tiempo real', free: false, pro: true, business: true },
  { label: 'Command palette', free: false, pro: true, business: true },
  { label: 'Exportar reportes (CSV/PDF)', free: false, pro: true, business: true },
  { label: 'SSO / SAML', free: false, pro: false, business: true },
  { label: 'Auditoría de actividad', free: false, pro: false, business: true },
  { label: 'Roles y permisos avanzados', free: false, pro: false, business: true },
  { label: 'Soporte prioritario', free: false, pro: false, business: true },
  { label: 'SLA garantizado', free: false, pro: false, business: true },
];

/**
 * Celda de la tabla de características que renderiza el valor de disponibilidad
 * de forma visualmente apropiada según su tipo.
 *
 * Usa `aria-label` en los iconos para que los lectores de pantalla anuncien
 * "Incluido" / "No incluido" en lugar del símbolo Unicode ✓ / –.
 *
 * @param props.value - Disponibilidad de la característica para un plan concreto.
 * @returns JSX con el icono de check, guión, o el texto de la restricción cuantitativa.
 */
function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <span className={styles.check} aria-label="Incluido">✓</span>;
  if (value === false) return <span className={styles.cross} aria-label="No incluido">–</span>;
  // Valor string: restricción cuantitativa (ej. "Hasta 3", "Ilimitados")
  return <span className={styles.valueText}>{value}</span>;
}

/**
 * Estado del CTA de los planes de pago (Pro y Business).
 * - `'idle'`: muestra el botón de selección de plan.
 * - `'shown'`: el usuario hizo clic; se reemplaza el botón por el mensaje "Próximamente".
 *
 * Se usa un tipo union en lugar de boolean para que sea extensible si en el futuro
 * se añaden más estados (ej. `'processing'` cuando Stripe esté integrado).
 */
type ProStatus = 'idle' | 'shown';

/**
 * Página pública de precios con comparativa de planes.
 *
 * Comportamiento adaptativo según estado de autenticación:
 * - Nav: muestra "Mi workspace" si está autenticado, o links de login/registro si no.
 * - Plan Free CTA: "Tu plan actual" si está autenticado, "Empezar gratis" si no.
 * - Planes Pro/Business: CTA que muestra "Próximamente" al hacer clic (sin Stripe activo aún).
 *
 * @returns JSX con la página completa de precios: nav, hero, cards de planes y footer.
 */
export default function PricingPage() {
  const { isAuthenticated, currentWorkspaceSlug } = useAuthStore();

  /** Estado del CTA del plan Pro: idle o confirmación de interés. */
  const [proStatus, setProStatus] = useState<ProStatus>('idle');

  /** Estado del CTA del plan Business: idle o confirmación de interés. */
  const [businessStatus, setBusinessStatus] = useState<ProStatus>('idle');

  // Si el usuario está autenticado, enlazar a su workspace actual.
  // Si no tiene workspace aún (raro pero posible), usar 'demo-workspace' como fallback
  // para no dejar un enlace roto. Si no está autenticado, ir a la página de registro.
  const dashboardHref = isAuthenticated
    ? `/${currentWorkspaceSlug ?? 'demo-workspace'}`
    : ROUTES.REGISTER;

  return (
    <div className={styles.page}>
      {/* Nav: barra de navegación propia de esta página de marketing */}
      <header className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles['brand__icon']}>⚒</span>
          <span className={styles['brand__name']}>ScrumForge</span>
        </div>
        {/* Acciones de navegación adaptadas al estado de autenticación */}
        <div className={styles.navActions}>
          {isAuthenticated ? (
            <Link to={dashboardHref}>
              <Button variant="ghost" size="sm">Mi workspace</Button>
            </Link>
          ) : (
            <>
              <Link to={ROUTES.LOGIN}>
                <Button variant="ghost" size="sm">Iniciar sesión</Button>
              </Link>
              <Link to={ROUTES.REGISTER}>
                <Button size="sm">Registrarse</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero: titular y subtítulo de la sección de precios */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>Planes simples, sin sorpresas</h1>
        <p className={styles.heroSubtitle}>
          Empieza gratis y escala cuando tu equipo crezca.
        </p>
      </div>

      {/* Grid de tres columnas: Free, Pro (destacado), Business */}
      <div className={styles.cards}>
        {/* Plan Free */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.planName}>Free</h2>
            <div className={styles.priceRow}>
              <span className={styles.price}>$0</span>
              <span className={styles.period}>/mes</span>
            </div>
            <p className={styles.planDesc}>Para equipos pequeños que empiezan.</p>
          </div>
          <div className={styles.cardAction}>
            {/* El CTA del plan Free varía: "Tu plan actual" para autenticados,
                "Empezar gratis" para visitantes, siempre con el mismo destino */}
            <Link to={isAuthenticated ? dashboardHref : ROUTES.REGISTER}>
              <Button variant="secondary" fullWidth>
                {isAuthenticated ? 'Tu plan actual' : 'Empezar gratis'}
              </Button>
            </Link>
          </div>
          {/* Lista de características filtrada por la disponibilidad del plan Free.
              Los items deshabilitados reciben la clase CSS featureItem--disabled
              para mostrarse atenuados visualmente */}
          <ul className={styles.featureList}>
            {FEATURES.map((f) => (
              <li key={f.label} className={`${styles.featureItem} ${!f.free ? styles['featureItem--disabled'] : ''}`}>
                <FeatureValue value={f.free} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Plan Pro — marcado como más popular, visualmente destacado con card--pro */}
        <div className={`${styles.card} ${styles['card--pro']}`}>
          <div className={styles.popularBadge}>Más popular</div>
          <div className={styles.cardHeader}>
            <h2 className={styles.planName}>Pro</h2>
            <div className={styles.priceRow}>
              <span className={styles.price}>$12</span>
              <span className={styles.period}>/mes por workspace</span>
            </div>
            <p className={styles.planDesc}>Para equipos que quieren escalar sin límites.</p>
          </div>
          <div className={styles.cardAction}>
            {/* Patrón de doble estado: el primer clic muestra interés del usuario
                y revela el mensaje "Próximamente" en lugar de iniciar un pago real */}
            {proStatus === 'idle' ? (
              <Button fullWidth onClick={() => setProStatus('shown')}>
                Elegir Pro
              </Button>
            ) : (
              <div className={styles.comingSoon}>
                Próximamente — ¡gracias por el interés!
              </div>
            )}
          </div>
          <ul className={styles.featureList}>
            {FEATURES.map((f) => (
              <li key={f.label} className={`${styles.featureItem} ${!f.pro ? styles['featureItem--disabled'] : ''}`}>
                <FeatureValue value={f.pro} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Plan Business */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.planName}>Business</h2>
            <div className={styles.priceRow}>
              <span className={styles.price}>$29</span>
              <span className={styles.period}>/mes por workspace</span>
            </div>
            <p className={styles.planDesc}>Para organizaciones con requisitos enterprise.</p>
          </div>
          <div className={styles.cardAction}>
            {/* Mismo patrón de doble estado que Pro */}
            {businessStatus === 'idle' ? (
              <Button variant="secondary" fullWidth onClick={() => setBusinessStatus('shown')}>
                Elegir Business
              </Button>
            ) : (
              <div className={styles.comingSoon}>
                Próximamente — ¡gracias por el interés!
              </div>
            )}
          </div>
          <ul className={styles.featureList}>
            {FEATURES.map((f) => (
              <li key={f.label} className={`${styles.featureItem} ${!f.business ? styles['featureItem--disabled'] : ''}`}>
                <FeatureValue value={f.business} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className={styles.footer}>
        <p>¿Tienes preguntas? Escríbenos a <a href="mailto:hola@scrumforge.dev">hola@scrumforge.dev</a></p>
      </footer>
    </div>
  );
}
