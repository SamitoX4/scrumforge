/**
 * @file extension-registry.ts
 * @description Registro central de extensiones premium de ScrumForge.
 * Gestiona el ciclo de vida completo de cada extensión: registro, validación
 * de compatibilidad, recopilación de typedefs/resolvers e inicialización.
 *
 * Flujo de uso en el arranque del servidor:
 *   1. Importar y llamar a `extensionRegistry.register(ext)` por cada extensión.
 *   2. Llamar a `extensionRegistry.getTypeDefs()` para fusionar los schemas.
 *   3. Llamar a `extensionRegistry.getResolvers()` para fusionar los resolvers.
 *   4. Llamar a `extensionRegistry.initAll(ctx)` después de conectar Prisma.
 *
 * Las extensiones deben cumplir el contrato {@link ScrumForgeExtension}.
 */

import type { DocumentNode } from 'graphql';
import type { IResolvers } from '@graphql-tools/utils';
import type { PrismaClient } from '@prisma/client';
import type { PubSub } from 'graphql-subscriptions';
import type { EventBus } from './types';
import { logger } from '../utils/logger';

/**
 * Versión actual de la API de extensiones del core.
 * Se incrementa con cada cambio incompatible (breaking change) en la interfaz
 * {@link ScrumForgeExtension} o en {@link ExtensionInitContext}.
 */
export const CORE_EXTENSION_API_VERSION = 1;

/**
 * Contexto inyectado a cada extensión durante su inicialización.
 * Las extensiones solo deben interactuar con el core a través de este objeto.
 */
export interface ExtensionInitContext {
  prisma: PrismaClient;
  pubsub: PubSub;
  eventBus: EventBus;
}

/**
 * Contrato que debe exportar cada paquete de extensión premium.
 * Una extensión es stateless: toda la lógica con estado va en sus servicios,
 * inicializados en `onInit`.
 */
export interface ScrumForgeExtension {
  /** Identificador único, ej: 'planning-poker', 'ai', 'integrations'. */
  name: string;

  /** Versión semver de la extensión. */
  version: string;

  /**
   * Versión mínima de la API del core requerida.
   * Si no se especifica, se asume la versión 1.
   */
  requiredCoreApiVersion?: number;

  /**
   * Definiciones de tipos GraphQL adicionales que expone la extensión.
   * Se fusionan con el schema del core usando `mergeTypeDefs`.
   */
  typeDefs?: DocumentNode | DocumentNode[];

  /**
   * Resolvers GraphQL que implementa la extensión.
   * Se fusionan con los resolvers del core usando `mergeResolvers`.
   */
  resolvers?: IResolvers;

  /**
   * Hook llamado una sola vez al arrancar el servidor, después de que
   * Prisma está conectado y el EventBus está listo.
   * Usar para inicializar servicios, registrar handlers de eventos y
   * arrancar jobs programados.
   */
  onInit?: (ctx: ExtensionInitContext) => Promise<void>;
}

/**
 * ExtensionRegistry — singleton que gestiona el ciclo de vida de las extensiones.
 *
 * Flujo de uso:
 *   1. `extensionRegistry.register(ext)` — registrar cada extensión al arranque.
 *   2. `extensionRegistry.getTypeDefs()` — obtener typedefs para fusionar al schema.
 *   3. `extensionRegistry.getResolvers()` — obtener resolvers para fusionar al schema.
 *   4. `extensionRegistry.initAll(ctx)` — inicializar todas las extensiones con el contexto.
 */
class ExtensionRegistry {
  private readonly extensions = new Map<string, ScrumForgeExtension>();
  private initialized = false;

  /**
   * Registra una extensión.
   * Lanza un error si el nombre ya está registrado o si la versión del core
   * requerida por la extensión no es compatible.
   */
  register(extension: ScrumForgeExtension): void {
    if (this.initialized) {
      throw new Error(
        `[ExtensionRegistry] No se puede registrar '${extension.name}' después de initAll().`,
      );
    }

    if (this.extensions.has(extension.name)) {
      throw new Error(
        `[ExtensionRegistry] La extensión '${extension.name}' ya está registrada.`,
      );
    }

    const required = extension.requiredCoreApiVersion ?? 1;
    if (required > CORE_EXTENSION_API_VERSION) {
      throw new Error(
        `[ExtensionRegistry] La extensión '${extension.name}' requiere core API v${required}, ` +
        `pero este servidor ejecuta v${CORE_EXTENSION_API_VERSION}. ` +
        `Actualiza @scrumforge/core.`,
      );
    }

    this.extensions.set(extension.name, extension);
    logger.info(
      `[ExtensionRegistry] ✅ Registrada: ${extension.name}@${extension.version}`,
    );
  }

  /** Devuelve todas las extensiones registradas, en orden de registro. */
  getAll(): ScrumForgeExtension[] {
    return Array.from(this.extensions.values());
  }

  /** Devuelve si una extensión está registrada por nombre. */
  has(name: string): boolean {
    return this.extensions.has(name);
  }

  /**
   * Recopila todos los DocumentNode de typedefs de las extensiones.
   * Devuelve un array plano listo para pasarse a `mergeTypeDefs`.
   */
  getTypeDefs(): DocumentNode[] {
    return this.getAll().flatMap((ext) => {
      if (!ext.typeDefs) return [];
      return Array.isArray(ext.typeDefs) ? ext.typeDefs : [ext.typeDefs];
    });
  }

  /**
   * Recopila todos los IResolvers de las extensiones.
   * Devuelve un array listo para pasarse a `mergeResolvers` o al array
   * de resolvers de makeExecutableSchema.
   */
  getResolvers(): IResolvers[] {
    return this.getAll()
      .map((ext) => ext.resolvers)
      .filter((r): r is IResolvers => r !== undefined);
  }

  /**
   * Inicializa todas las extensiones con el contexto del servidor.
   * Solo puede llamarse una vez. Los registros posteriores a esta llamada
   * lanzarán un error.
   */
  async initAll(ctx: ExtensionInitContext): Promise<void> {
    if (this.initialized) {
      throw new Error('[ExtensionRegistry] initAll() ya fue llamado.');
    }
    this.initialized = true;

    for (const ext of this.getAll()) {
      if (ext.onInit) {
        try {
          await ext.onInit(ctx);
          logger.info(`[ExtensionRegistry] Inicializada: ${ext.name}`);
        } catch (err) {
          logger.error({ err }, `[ExtensionRegistry] Error al inicializar: ${ext.name}`);
          throw err;
        }
      }
    }
  }

  /** Solo para tests: reinicia el registro a su estado inicial. */
  _reset(): void {
    this.extensions.clear();
    this.initialized = false;
  }
}

/** Singleton global del registro de extensiones. */
export const extensionRegistry = new ExtensionRegistry();

// Exportamos la clase para tests que necesiten instancias aisladas
export { ExtensionRegistry };
