/**
 * @file billing.queries.ts
 * @module graphql/billing
 * @description Operaciones GraphQL para el módulo de facturación y suscripciones de ScrumForge.
 * Gestiona la integración con Stripe para consultar el estado de la suscripción activa de un
 * workspace, crear sesiones de pago (checkout) y acceder al portal de gestión de facturación.
 *
 * Todas las operaciones sensibles se delegan completamente al backend, que utiliza la API
 * de Stripe con claves secretas. El frontend solo recibe URLs de redirección seguras.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_BILLING_SUBSCRIPTION
 * @description Query que obtiene los datos de suscripción activa de un workspace en Stripe.
 * Permite al frontend mostrar el plan contratado actualmente y los identificadores de
 * cliente/suscripción necesarios para operaciones de gestión de facturación.
 *
 * @param {ID} workspaceId - Identificador del workspace cuya suscripción se consulta.
 *
 * @returns {Object} Datos de suscripción con:
 * - `workspaceId` — Workspace propietario de la suscripción.
 * - `planId` — Identificador del plan contratado (ej. "free", "pro", "enterprise").
 * - `stripeCustomerId` — ID del cliente en Stripe (para operaciones de portal).
 * - `stripeSubscriptionId` — ID de la suscripción activa en Stripe.
 */
export const GET_BILLING_SUBSCRIPTION = gql`
  query GetBillingSubscription($workspaceId: ID!) {
    billingSubscription(workspaceId: $workspaceId) {
      workspaceId planId stripeCustomerId stripeSubscriptionId
    }
  }
`;

/**
 * @constant CREATE_CHECKOUT_SESSION
 * @description Mutación que crea una sesión de pago en Stripe Checkout para contratar o cambiar de plan.
 * El backend genera la sesión con Stripe y devuelve la URL de redirección hacia la página de pago
 * alojada en los servidores de Stripe (PCI compliant).
 *
 * Diseño: las URLs de éxito y cancelación se pasan desde el frontend para permitir
 * redirecciones específicas según el contexto (onboarding, configuración de workspace, etc.).
 *
 * @param {ID} workspaceId - Workspace para el que se crea la sesión de pago.
 * @param {String} planId - Identificador del plan a contratar.
 * @param {String} successUrl - URL de redirección tras un pago exitoso.
 * @param {String} cancelUrl - URL de redirección si el usuario cancela el pago.
 *
 * @returns {String} URL de la sesión de Stripe Checkout a la que redirigir al usuario.
 */
export const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($workspaceId: ID!, $planId: String!, $successUrl: String!, $cancelUrl: String!) {
    createCheckoutSession(workspaceId: $workspaceId, planId: $planId, successUrl: $successUrl, cancelUrl: $cancelUrl)
  }
`;

/**
 * @constant CREATE_BILLING_PORTAL_SESSION
 * @description Mutación que crea una sesión para el portal de gestión de facturación de Stripe.
 * El portal permite al usuario gestionar su método de pago, ver historial de facturas,
 * cancelar o modificar su suscripción directamente en la interfaz de Stripe.
 *
 * Diseño: se usa el portal de Stripe en lugar de construir una UI propia para reducir
 * la complejidad del frontend y delegar la seguridad PCI a Stripe.
 *
 * @param {ID} workspaceId - Workspace cuyo portal de facturación se abre.
 * @param {String} returnUrl - URL a la que redirigir al usuario cuando cierre el portal de Stripe.
 *
 * @returns {String} URL del portal de facturación de Stripe a la que redirigir al usuario.
 */
export const CREATE_BILLING_PORTAL_SESSION = gql`
  mutation CreateBillingPortalSession($workspaceId: ID!, $returnUrl: String!) {
    createBillingPortalSession(workspaceId: $workspaceId, returnUrl: $returnUrl)
  }
`;
