import { Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { frontendExtensionRegistry } from './extension-registry';

interface ExtensionSlotProps {
  /** Nombre del slot, ej. 'planning-poker-panel' */
  name: string;
  /** Props que se pasan al componente de la extensión */
  slotProps?: Record<string, unknown>;
  /**
   * Qué mostrar si ninguna extensión ha registrado este slot.
   * Típicamente <UpgradePrompt /> o null.
   */
  fallback?: React.ReactNode;
}

/**
 * Punto de extensión en la UI del core.
 *
 * Si la extensión correspondiente está cargada, renderiza su componente.
 * Si no, renderiza el fallback (UpgradePrompt o null).
 *
 * Uso:
 *   <ExtensionSlot
 *     name="planning-poker-panel"
 *     slotProps={{ projectId, stories }}
 *     fallback={<UpgradePrompt feature="Planning Poker" plan="pro" />}
 *   />
 */
export function ExtensionSlot({ name, slotProps = {}, fallback = null }: ExtensionSlotProps) {
  const SlotComponent = frontendExtensionRegistry.getSlot(name);

  if (!SlotComponent) return <>{fallback}</>;

  return (
    <Suspense fallback={<Spinner size="sm" />}>
      <SlotComponent {...slotProps} />
    </Suspense>
  );
}
