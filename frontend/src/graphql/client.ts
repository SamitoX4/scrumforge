/**
 * @file client.ts
 * @description Configuración y exportación del cliente Apollo para ScrumForge.
 *
 * Arquitectura de links (cadena de middlewares de Apollo):
 *
 *   Para queries y mutations (HTTP):
 *     errorLink → authLink → httpLink
 *
 *   Para subscriptions (WebSocket):
 *     wsLink  (con token en connectionParams)
 *
 * La función `split` actúa como enrutador: examina cada operación y decide
 * si debe ir por WebSocket o por la cadena HTTP.
 */

import { ApolloClient, InMemoryCache, createHttpLink, from, split } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { createClient } from 'graphql-ws';
import { config } from '@/constants/config';

/** Link HTTP base: apunta al endpoint GraphQL definido en la configuración de la app. */
const httpLink = createHttpLink({ uri: config.graphqlUrl });

/**
 * Link de autenticación (middleware de contexto).
 *
 * Se ejecuta antes de cada petición HTTP y añade el header `Authorization: Bearer <token>`
 * si existe un accessToken en localStorage. Se lee en cada petición (no en el arranque)
 * para que los cambios de token (refresh) se reflejen inmediatamente sin recrear el cliente.
 */
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      // Solo se añade el header si hay token; evitamos enviar "Authorization: Bearer null"
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

/**
 * Link de manejo de errores.
 *
 * Intercepta todos los errores GraphQL y de red antes de que lleguen al componente:
 * - Si algún error tiene el código UNAUTHENTICATED, limpia los tokens y fuerza
 *   la redirección a /login. Esto cubre el caso de token expirado o revocado.
 * - El resto de errores se registran en consola para facilitar el debugging.
 *
 * Se usa `window.location.href` en lugar de `navigate()` para poder usarlo
 * fuera del contexto de React Router (este módulo es singleton, no un componente).
 */
const errorLink = onError(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const { message, extensions } of error.errors) {
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Limpieza completa de credenciales para forzar un nuevo login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
      console.error(`[GraphQL error]: ${message}`);
    }
  } else if (error) {
    console.error(`[Network error]: ${error}`);
  }
});

/**
 * Link WebSocket para subscriptions GraphQL.
 *
 * Envía el token de autenticación en `connectionParams` (evaluado en cada
 * intento de conexión) en lugar de en headers HTTP, ya que el protocolo
 * WebSocket no admite cabeceras personalizadas en el handshake inicial.
 *
 * `shouldRetry: () => true` junto con `retryAttempts: 5` garantizan
 * reconexión automática ante pérdidas de red o reinicios del servidor,
 * manteniendo activas las subscriptions (Planning Poker, actualizaciones
 * en tiempo real del tablero Kanban, etc.).
 */
const wsLink = new GraphQLWsLink(
  createClient({
    url: config.wsUrl,
    connectionParams: () => {
      const token = localStorage.getItem('accessToken');
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    // Reconnect automatically on connection loss
    shouldRetry: () => true,
    retryAttempts: 5,
  }),
);

/**
 * Enrutador de operaciones: separa subscriptions (WebSocket) de queries y mutations (HTTP).
 *
 * `getMainDefinition` analiza el AST de la operación para determinar su tipo.
 * Las subscriptions van por `wsLink`; el resto pasa por la cadena HTTP
 * `errorLink → authLink → httpLink` donde cada link puede modificar o interceptar
 * la petición antes de enviarse al servidor.
 */
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([errorLink, authLink, httpLink]),
);

/**
 * Instancia global del cliente Apollo. Se pasa al `ApolloProvider` en el
 * punto de entrada de la aplicación y es usado por todos los hooks
 * `useQuery`, `useMutation` y `useSubscription`.
 *
 * Decisiones de caché:
 * - `merge: false` en `userStories`, `epics` y `sprints` evita que Apollo
 *   fusione arrays paginados de forma incorrecta; en su lugar, cada respuesta
 *   reemplaza completamente la lista anterior en caché.
 * - `errorPolicy: 'all'` permite recibir datos parciales junto con errores,
 *   útil cuando parte de una query falla pero el resto es válido.
 */
export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // merge: false garantiza que al refrescar, el array se reemplaza completo
          // en lugar de fusionarse con la caché anterior (evita duplicados en listas)
          userStories: { merge: false },
          epics: { merge: false },
          sprints: { merge: false },
        },
      },
    },
  }),
  defaultOptions: {
    // errorPolicy: 'all' permite que Apollo devuelva datos parciales incluso si
    // parte de la query falla, en lugar de descartar todo el resultado
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
});
