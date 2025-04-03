/**
 * @scrumforge/frontend-sdk
 *
 * Public surface for ScrumForge premium frontend extensions.
 *
 * Internal use: Vite resolves '@scrumforge/sdk' → this file via alias,
 * which in turn resolves '@/' imports against the core frontend app.
 *
 * External use (extension authors): install this package and import
 * components, hooks, stores and extension types from '@scrumforge/sdk'.
 *
 * Add exports here only when a premium extension needs them.
 * Never expose internal implementation details.
 */

// ─── Components ───────────────────────────────────────────────────────────────
export { Button } from '@/components/atoms/Button/Button';
export { Spinner } from '@/components/atoms/Spinner/Spinner';
export { UpgradePrompt } from '@/components/molecules/UpgradePrompt/UpgradePrompt';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useCurrentProject } from '@/hooks/useCurrentProject';
export { usePlanFeatures } from '@/hooks/usePlanFeatures';

// ─── Stores ───────────────────────────────────────────────────────────────────
export { useAuthStore } from '@/store/auth.store';
export { useUIStore } from '@/store/ui.store';

// ─── Constants ────────────────────────────────────────────────────────────────
export { ROUTES } from '@/constants/routes';

// ─── Extension registry types ─────────────────────────────────────────────────
export type {
  ScrumForgeFrontendExtension,
  FrontendNavItem,
  FrontendRouteConfig,
} from './extension-registry';

// ─── API types ────────────────────────────────────────────────────────────────
export type { WorkspacePlanLimits } from './api.types';
