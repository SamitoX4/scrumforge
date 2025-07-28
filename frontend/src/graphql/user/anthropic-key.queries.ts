/**
 * @file anthropic-key.queries.ts
 * @module graphql/user
 * @description Operaciones GraphQL para la gestión de la API key personal de Anthropic del usuario.
 * ScrumForge permite a cada usuario almacenar su propia clave de la API de Anthropic para
 * usar las funciones de IA con su propia cuota, en lugar de depender de la clave global del servidor.
 *
 * Seguridad: la clave se almacena cifrada en la base de datos y NUNCA se expone a través de GraphQL.
 * El schema solo permite saber si existe una clave guardada (`hasAnthropicApiKey`), no recuperarla.
 * El campo `anthropicApiKey` no está en el tipo GraphQL `User` por diseño intencionado.
 */

import { gql } from '@apollo/client';

/**
 * @constant HAS_ANTHROPIC_KEY
 * @description Query que verifica si el usuario autenticado tiene una API key de Anthropic guardada.
 * Retorna un booleano sin exponer la clave real, lo que permite a la UI mostrar el estado
 * de la configuración (ej. "Clave configurada" vs "Sin clave configurada") sin riesgo de filtración.
 *
 * No requiere parámetros: opera sobre el usuario de la sesión activa (contexto JWT).
 *
 * @returns {Boolean} `true` si el usuario tiene una API key de Anthropic almacenada.
 */
export const HAS_ANTHROPIC_KEY = gql`
  query HasAnthropicApiKey { hasAnthropicApiKey }
`;

/**
 * @constant SAVE_ANTHROPIC_KEY
 * @description Mutación para guardar o reemplazar la API key de Anthropic del usuario autenticado.
 * El backend cifra la clave antes de persistirla en la base de datos.
 * Si ya existía una clave previa, esta operación la sobreescribe.
 *
 * @param {String} key - API key de Anthropic en texto plano (se cifra en el servidor antes de guardar).
 *
 * @returns {Boolean} `true` si la clave fue guardada correctamente.
 */
export const SAVE_ANTHROPIC_KEY = gql`
  mutation SaveAnthropicApiKey($key: String!) { saveAnthropicApiKey(key: $key) }
`;

/**
 * @constant DELETE_ANTHROPIC_KEY
 * @description Mutación para eliminar la API key de Anthropic del usuario autenticado.
 * Tras esta operación, las funciones de IA del usuario usarán la clave global del servidor
 * (si está configurada en `process.env.ANTHROPIC_API_KEY`) o entrarán en modo mock.
 *
 * No requiere parámetros: opera sobre el usuario de la sesión activa (contexto JWT).
 *
 * @returns {Boolean} `true` si la clave fue eliminada correctamente.
 */
export const DELETE_ANTHROPIC_KEY = gql`
  mutation DeleteAnthropicApiKey { deleteAnthropicApiKey }
`;
