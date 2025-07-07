/**
 * Punto de entrada público de la infraestructura de extensiones.
 * Los paquetes externos importan desde '@scrumforge/core/extensions'.
 * Internamente, el core importa directamente los archivos específicos.
 */

export { extensionRegistry, CORE_EXTENSION_API_VERSION } from './extension-registry';
export type { ScrumForgeExtension, ExtensionInitContext } from './extension-registry';
export type { EventBus } from './types';
export { EventType } from './types';

// Interfaces de servicio para extensiones premium
export type { IPlanningPokerService, PokerSession, PokerVote } from './interfaces/planning-poker.interface';
export type { IRetrospectiveExtension, RetroNote, RetroAction } from './interfaces/retrospective.interface';
export type { IAIExtension, RiskAlert } from './interfaces/ai.interface';
export type {
  IIntegrationProvider,
  IIntegrationRegistry,
  ScrumForgeEvent,
  ValidationResult,
} from './interfaces/integration.interface';
