import { useState, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { IMPORT_STORIES_CSV } from '@/graphql/backlog/import.queries';

/**
 * Props del componente ImportStoriesModal.
 */
interface ImportStoriesModalProps {
  /** ID del proyecto donde se importarán las historias. */
  projectId: string;
  /** Callback para cerrar el modal sin importar. */
  onClose: () => void;
  /** Callback invocado después de una importación exitosa para refrescar el backlog. */
  onImported: () => void;
}

/**
 * Representa una fila del CSV parseado donde las claves son las cabeceras.
 */
interface CsvRow {
  [key: string]: string;
}

/**
 * Parsea un texto CSV simple (sin comillas escapadas) en cabeceras y filas.
 * Se elimina el espacio en blanco alrededor de cada valor para evitar errores
 * de comparación al validar prioridades o estados.
 *
 * Limitación: no soporta valores con comas dentro de comillas.
 * Para datos complejos, el backend tiene su propia validación.
 *
 * @param text - Contenido del archivo CSV como cadena de texto.
 * @returns Cabeceras del CSV y arreglo de filas como objetos clave-valor.
 */
function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: CsvRow = {};
    // Mapear cada valor a su cabecera por posición
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

/**
 * ImportStoriesModal
 *
 * Modal para importar historias de usuario en masa desde un archivo CSV.
 *
 * Flujo de uso:
 * 1. El usuario selecciona un archivo `.csv` mediante el input de archivo.
 * 2. Se lee el archivo localmente con `FileReader` y se parsea para mostrar
 *    una vista previa de las primeras 3 filas antes de importar.
 * 3. El usuario confirma y se envía el CSV al servidor mediante la mutación
 *    `IMPORT_STORIES_CSV`.
 * 4. Tras la importación exitosa se muestra un mensaje con el conteo de
 *    historias creadas y se cierra el modal automáticamente tras 1.5s.
 *
 * Formato CSV esperado:
 * - Columna obligatoria: `title`
 * - Columnas opcionales: `description`, `priority` (CRITICAL/HIGH/MEDIUM/LOW),
 *   `points` (número), `epicTitle`
 *
 * @param projectId - Proyecto destino de las historias importadas.
 * @param onClose - Cierra el modal.
 * @param onImported - Se llama después de importar con éxito para refrescar datos.
 */
export function ImportStoriesModal({ projectId, onClose, onImported }: ImportStoriesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Texto completo del CSV leído del archivo, se envía al servidor sin procesar
  const [csvText, setCsvText] = useState('');
  // Vista previa parseada del CSV para mostrar al usuario antes de confirmar
  const [preview, setPreview] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  // Mensaje de éxito que se muestra durante 1.5s antes de cerrar el modal
  const [successMessage, setSuccessMessage] = useState('');

  const [importCsv, { loading }] = useMutation<any>(IMPORT_STORIES_CSV);

  /**
   * Lee el archivo seleccionado y genera la vista previa del CSV.
   * Usa FileReader para leer el contenido en texto sin necesidad de subirlo
   * a un servidor antes de que el usuario confirme la importación.
   */
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const parsed = parseCsv(text);
      setPreview(parsed);
    };
    reader.readAsText(file);
  }

  /**
   * Envía el CSV al servidor y muestra el conteo de historias importadas.
   * El mensaje de éxito usa la concordancia gramatical correcta en español
   * (singular/plural y género femenino de "historia").
   */
  async function handleImport() {
    if (!csvText) return;
    try {
      const result = await importCsv({ variables: { projectId, csv: csvText } });
      const data = result.data?.importStoriesCsv;
      const count = data?.imported ?? 0;
      // Concordancia: "1 historia importada" vs "N historias importadas"
      setSuccessMessage(`${count} histori${count === 1 ? 'a' : 'as'} importada${count === 1 ? '' : 's'}`);
      // Esperar 1.5s para que el usuario lea el mensaje antes de cerrar
      setTimeout(() => {
        onImported();
        onClose();
      }, 1500);
    } catch (_err) {
      // Los errores de Apollo se gestionan a través del estado de error de la mutación
    }
  }

  // ── Estilos inline ────────────────────────────────────────────────────────
  // Se usan estilos inline para evitar dependencia de un archivo SCSS externo
  // y facilitar el aislamiento del componente modal.

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const boxStyle: React.CSSProperties = {
    background: 'var(--color-surface, #1e1e2e)',
    borderRadius: '10px',
    padding: '2rem',
    width: '480px',
    maxWidth: '95vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    border: '1px solid var(--color-border, #3f3f5a)',
    color: 'var(--color-text, #e2e8f0)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  };

  const descStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--color-text-secondary, #94a3b8)',
    marginBottom: '1.25rem',
    lineHeight: 1.5,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
    color: 'var(--color-text-secondary, #94a3b8)',
  };

  const fileInputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    color: 'var(--color-text, #e2e8f0)',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.75rem',
    marginBottom: '1.25rem',
    border: '1px solid var(--color-border, #3f3f5a)',
    borderRadius: '6px',
    overflow: 'hidden',
  };

  const thStyle: React.CSSProperties = {
    background: 'var(--color-surface-raised, #2a2a40)',
    padding: '0.4rem 0.6rem',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '1px solid var(--color-border, #3f3f5a)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.35rem 0.6rem',
    borderBottom: '1px solid var(--color-border, #3f3f5a)',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  };

  const btnBase: React.CSSProperties = {
    padding: '0.45rem 1rem',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: 'none',
  };

  const successStyle: React.CSSProperties = {
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid #10B981',
    color: '#10B981',
    borderRadius: '6px',
    padding: '0.6rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    textAlign: 'center',
  };

  // Solo mostrar las primeras 3 filas en la vista previa para no sobrecargar el modal
  const previewRows = preview?.rows.slice(0, 3) ?? [];

  return (
    // El clic en el overlay cierra el modal; stopPropagation en el contenedor interior lo evita
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>Importar historias desde CSV</div>
        <p style={descStyle}>
          El CSV debe tener columnas: <strong>title</strong>, description, priority (CRITICAL/HIGH/MEDIUM/LOW),
          points (número), epicTitle (opcional)
        </p>

        <label style={labelStyle} htmlFor="csv-file-input">Archivo CSV</label>
        <input
          id="csv-file-input"
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={fileInputStyle}
        />

        {/* Mensaje de éxito tras la importación */}
        {successMessage && (
          <div style={successStyle}>{successMessage}</div>
        )}

        {/* Vista previa de las primeras filas del CSV parseado */}
        {preview && preview.headers.length > 0 && (
          <>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-text-secondary)' }}>
              Vista previa (primeras {previewRows.length} filas de {preview.rows.length})
            </div>
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {preview.headers.map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((h) => (
                        // El `title` completo se muestra en el tooltip al pasar el cursor
                        <td key={h} style={tdStyle} title={row[h]}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={footerStyle}>
          <button
            style={{ ...btnBase, background: 'transparent', color: 'var(--color-text-secondary, #94a3b8)', border: '1px solid var(--color-border, #3f3f5a)' }}
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          {/* El botón de importar se deshabilita si no hay CSV cargado o está en curso */}
          <button
            style={{
              ...btnBase,
              background: csvText && !loading ? 'var(--color-primary, #6366f1)' : 'var(--color-border, #3f3f5a)',
              color: '#fff',
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleImport}
            disabled={!csvText || loading}
          >
            {loading ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}
