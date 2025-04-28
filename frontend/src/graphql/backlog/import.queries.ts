/**
 * @file import.queries.ts
 * @module graphql/backlog
 * @description Operaciones GraphQL para la importación masiva de historias de usuario al backlog.
 * Permite cargar múltiples historias de una sola vez desde un archivo CSV, facilitando
 * la migración desde otras herramientas o la carga inicial de un backlog existente.
 *
 * El CSV debe seguir el formato esperado por el backend (columnas predefinidas).
 * El frontend lee el archivo, extrae su contenido como string y lo envía en la mutación.
 */

import { gql } from '@apollo/client';

/**
 * @constant IMPORT_STORIES_CSV
 * @description Mutación para importar historias de usuario al backlog de un proyecto desde un CSV.
 * El contenido del CSV se envía como string (no como upload de archivo) para simplificar
 * la integración con Apollo Client sin necesidad de configurar apollo-upload-client.
 *
 * El backend procesa fila por fila y reporta cuántas historias fueron importadas,
 * cuántas se omitieron (duplicadas o vacías) y cuáles tuvieron errores de validación.
 *
 * @param {ID} projectId - Identificador del proyecto al que se importan las historias.
 * @param {String} csv - Contenido completo del archivo CSV como string de texto plano.
 *
 * @returns {Object} Resultado del proceso de importación con:
 * - `imported` — Número de historias importadas correctamente.
 * - `skipped` — Número de filas omitidas (ej. duplicadas o sin título).
 * - `errors` — Número de filas que fallaron por errores de validación o formato.
 */
export const IMPORT_STORIES_CSV = gql`
  mutation ImportStoriesCsv($projectId: ID!, $csv: String!) {
    importStoriesCsv(projectId: $projectId, csv: $csv) {
      imported skipped errors
    }
  }
`;
