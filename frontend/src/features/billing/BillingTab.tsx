/**
 * @file BillingTab.tsx
 * Pestaña de Facturación del workspace de ScrumForge.
 *
 * Muestra el plan activo, las opciones de upgrade y el acceso al portal de
 * clientes de Stripe. Se integra con el backend mediante tres operaciones
 * GraphQL: consulta de suscripción, creación de sesión de checkout y
 * apertura del portal de clientes.
 */

import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import {
  GET_BILLING_SUBSCRIPTION,
  CREATE_CHECKOUT_SESSION,
  CREATE_BILLING_PORTAL_SESSION,
} from '@/graphql/billing/billing.queries';

/** Datos de suscripción del workspace obtenidos del backend. */
interface BillingSubscription {
  workspaceId: string;
  planId: string;
  /** null si el workspace nunca ha tenido una suscripción de pago en Stripe. */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * Props de BillingTab.
 * @property workspaceId - ID del workspace cuya suscripción se gestiona.
 */
interface Props {
  workspaceId: string;
}

/**
 * Colores identificativos de cada plan para las tarjetas y badges.
 * Están fuera del componente para evitar recrearlos en cada render.
 */
const PLAN_COLORS: Record<string, string> = {
  free: '#64748B',
  pro: '#3B82F6',
  business: '#7C3AED',
};

/**
 * Pestaña de Facturación del workspace.
 *
 * Muestra el plan actual del workspace y las opciones de upgrade disponibles.
 * Si el workspace ya tiene un cliente en Stripe, ofrece acceso al portal de
 * gestión de Stripe (cambiar tarjeta, ver facturas, cancelar).
 *
 * Flujo de upgrade:
 *  1. El usuario pulsa "Upgrade" en una tarjeta de plan.
 *  2. Se llama a `createCheckoutSession` que devuelve una URL de Stripe Checkout.
 *  3. Se redirige directamente a esa URL (`window.location.href`).
 *  4. Stripe redirige de vuelta a la URL actual con `?billing=success`.
 *
 * Nota: este componente es el fallback del core cuando la extensión
 * 'billing-stripe' no está instalada. En producción lo sustituye `BillingTabSlot`.
 */
export function BillingTab({ workspaceId }: Props) {
  const { t } = useTranslation();

  /**
   * Definición estática de los planes disponibles.
   * Los textos de características se traducen en tiempo de render para respetar
   * el idioma activo del usuario.
   */
  const plans = [
    {
      id: 'free',
      label: 'Free',
      price: t('billing.priceFree'),
      features: [
        t('billing.featureProjects3'),
        t('billing.featureMembers5'),
        t('billing.featureBasic'),
      ],
      // El plan Free no tiene botón de upgrade — no se puede "comprar" gratis
      canUpgrade: false,
    },
    {
      id: 'pro',
      label: 'Pro',
      price: t('billing.pricePro'),
      features: [
        t('billing.featureProjectsUnlimited'),
        t('billing.featureMembers25'),
        t('billing.featurePhase2'),
        t('billing.featurePoker'),
        t('billing.featureRetros'),
      ],
      canUpgrade: true,
    },
    {
      id: 'business',
      label: 'Business',
      price: t('billing.priceBusiness'),
      features: [
        t('billing.featureUnlimited'),
        t('billing.featureSSO'),
        t('billing.featureAudit'),
        t('billing.featureSupport'),
      ],
      canUpgrade: true,
    },
  ];

  const { data, loading, error } = useQuery<{ billingSubscription: BillingSubscription }>(
    GET_BILLING_SUBSCRIPTION,
    { variables: { workspaceId }, skip: !workspaceId }
  );

  const [createCheckoutSession, { loading: checkoutLoading }] = useMutation<
    { createCheckoutSession: string }
  >(CREATE_CHECKOUT_SESSION);

  const [createBillingPortalSession, { loading: portalLoading }] = useMutation<
    { createBillingPortalSession: string }
  >(CREATE_BILLING_PORTAL_SESSION);

  const subscription = data?.billingSubscription;
  // Si no hay suscripción registrada, se asume el plan gratuito
  const currentPlanId = subscription?.planId ?? 'free';
  // Solo se muestra el botón de gestión si hay un cliente en Stripe (es decir, pagó alguna vez)
  const hasStripeCustomer = Boolean(subscription?.stripeCustomerId);

  // Etiquetas legibles por plan, separadas de PLAN_COLORS para mayor claridad
  const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    business: 'Business',
  };

  /**
   * Inicia el proceso de upgrade creando una sesión de Stripe Checkout.
   * La URL de éxito incluye un query param para que la app pueda detectar
   * el regreso desde Stripe y refrescar los datos de suscripción.
   */
  async function handleUpgrade(planId: string) {
    if (!workspaceId) return;
    try {
      const successUrl = window.location.href + '?billing=success';
      const cancelUrl = window.location.href;
      const result = await createCheckoutSession({
        variables: { workspaceId, planId, successUrl, cancelUrl },
      });
      const url = result.data?.createCheckoutSession;
      if (url) {
        // Redirección directa al checkout de Stripe fuera de la SPA
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
    }
  }

  /**
   * Abre el portal de clientes de Stripe para gestionar la suscripción existente.
   * El portal permite cambiar método de pago, ver facturas y cancelar.
   */
  async function handleManageSubscription() {
    if (!workspaceId) return;
    try {
      const returnUrl = window.location.href;
      const result = await createBillingPortalSession({
        variables: { workspaceId, returnUrl },
      });
      const url = result.data?.createBillingPortalSession;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Error opening billing portal:', err);
    }
  }

  // Guardia: sin workspaceId no se puede consultar la suscripción
  if (!workspaceId) {
    return (
      <p style={{ color: '#64748B', fontSize: '14px' }}>
        {t('billing.noWorkspace')}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Panel del plan actual con botón de gestión de Stripe si aplica */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 8px 0' }}>{t('billing.currentPlan')}</p>
        {loading ? (
          <span style={{ fontSize: '14px', color: '#94A3B8' }}>{t('common.loading')}</span>
        ) : error ? (
          <span style={{ fontSize: '14px', color: '#EF4444' }}>
            {t('billing.loadError')}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Badge del plan actual con el color del plan */}
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '9999px',
                background: PLAN_COLORS[currentPlanId] ?? '#64748B',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {PLAN_LABELS[currentPlanId] ?? currentPlanId}
            </span>
            {/* El botón de gestión solo aparece si ya existe un cliente en Stripe */}
            {hasStripeCustomer && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#fff',
                  color: '#1E293B',
                  fontSize: '13px',
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  opacity: portalLoading ? 0.6 : 1,
                }}
              >
                {portalLoading ? t('billing.redirecting') : t('billing.manageSubscription')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rejilla de tarjetas de planes — usa auto-fit para adaptarse al ancho disponible */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              style={{
                // Borde más grueso y azul para destacar el plan activo
                border: isCurrent ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '20px',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
              }}
            >
              {/* Badge "Plan actual" posicionado en el borde superior de la tarjeta */}
              {isCurrent && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-1px',
                    right: '12px',
                    background: '#3B82F6',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '0 0 6px 6px',
                  }}
                >
                  {t('billing.currentPlanBadge')}
                </span>
              )}
              <div>
                <p
                  style={{
                    margin: '0 0 4px 0',
                    fontWeight: 700,
                    fontSize: '16px',
                    color: PLAN_COLORS[plan.id] ?? '#1E293B',
                  }}
                >
                  {plan.label}
                </p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>
                  {plan.price}
                </p>
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '13px', color: '#475569' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ marginBottom: '4px' }}>
                    {f}
                  </li>
                ))}
              </ul>
              {/* Botón de upgrade solo para planes superiores que no son el actual */}
              {plan.canUpgrade && !isCurrent && (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={checkoutLoading}
                  style={{
                    marginTop: 'auto',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: PLAN_COLORS[plan.id] ?? '#3B82F6',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                    opacity: checkoutLoading ? 0.6 : 1,
                  }}
                >
                  {checkoutLoading ? t('billing.processing') : t('billing.upgrade')}
                </button>
              )}
              {/* Indicador no interactivo del plan activo — ocupa el mismo espacio que el botón */}
              {isCurrent && (
                <span
                  style={{
                    marginTop: 'auto',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #BFDBFE',
                    background: '#EFF6FF',
                    color: '#3B82F6',
                    fontWeight: 600,
                    fontSize: '13px',
                    textAlign: 'center',
                  }}
                >
                  {t('billing.activePlan')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
