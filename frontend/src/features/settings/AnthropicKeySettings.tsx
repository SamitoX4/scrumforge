import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import {
  HAS_ANTHROPIC_KEY,
  SAVE_ANTHROPIC_KEY,
  DELETE_ANTHROPIC_KEY,
} from '@/graphql/user/anthropic-key.queries';

/**
 * AnthropicKeySettings
 *
 * Sección de ajustes que permite al usuario configurar su clave personal de la
 * API de Anthropic para las funcionalidades de IA de ScrumForge (generación de
 * criterios de aceptación, estimación de puntos, resumen diario, etc.).
 *
 * Comportamiento:
 * - Consulta al backend si el usuario ya tiene una API key guardada
 *   (`hasAnthropicApiKey`). El backend devuelve un booleano; la key en sí
 *   **nunca** se expone a través de GraphQL por seguridad.
 * - Si el usuario **no tiene** key: muestra un input de contraseña para guardarla.
 * - Si el usuario **ya tiene** key: muestra un badge de confirmación y un botón
 *   para eliminarla.
 * - Tras cualquier operación de guardado/eliminado, refresca la consulta y
 *   muestra un mensaje de éxito o error.
 *
 * @remarks
 * La API key se transmite encriptada al backend mediante HTTPS y se almacena
 * en `User.anthropicApiKey` (cifrado en base de datos). El campo nunca se
 * incluye en el tipo GraphQL `User`.
 */
export function AnthropicKeySettings() {
  const { t } = useTranslation();
  // Valor introducido en el campo de contraseña para la nueva key
  const [keyInput, setKeyInput] = useState('');
  // Mensaje de retroalimentación tras guardar o eliminar (null = sin mensaje)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // `cache-and-network` muestra el dato en caché de inmediato y lo verifica con el servidor
  const { data, loading, refetch } = useQuery<{ hasAnthropicApiKey: boolean }>(HAS_ANTHROPIC_KEY, {
    fetchPolicy: 'cache-and-network',
  });

  const [saveKey, { loading: saving }] = useMutation<any>(SAVE_ANTHROPIC_KEY, {
    onCompleted: async () => {
      // Limpiar el campo para no dejar la key visible en el input
      setKeyInput('');
      // Refrescar para que el estado `hasKey` refleje la nueva realidad
      await refetch();
      setMessage({ text: t('settings.aiKeySaved'), type: 'success' });
    },
    onError: (err) => {
      setMessage({ text: err.message, type: 'error' });
    },
  });

  const [deleteKey, { loading: deleting }] = useMutation<any>(DELETE_ANTHROPIC_KEY, {
    onCompleted: async () => {
      await refetch();
      setMessage({ text: t('settings.aiKeyDeleted'), type: 'success' });
    },
    onError: (err) => {
      setMessage({ text: err.message, type: 'error' });
    },
  });

  // Derivar si el usuario ya tiene key configurada; false como fallback seguro mientras carga
  const hasKey = data?.hasAnthropicApiKey ?? false;

  /**
   * Envía la nueva API key al servidor.
   * Descarta espacios al inicio/final y limpia el mensaje anterior antes de guardar.
   */
  async function handleSave() {
    if (!keyInput.trim()) return;
    setMessage(null);
    await saveKey({ variables: { key: keyInput.trim() } });
  }

  /**
   * Elimina la API key del usuario en el servidor.
   * Limpia el mensaje anterior antes de ejecutar la mutación.
   */
  async function handleDelete() {
    setMessage(null);
    await deleteKey();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
          🤖 {t('settings.aiTitle')}
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '4px' }}>
          {t('settings.aiDesc')}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
          {t('settings.aiKeyHint')}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Spinner size="sm" />
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>{t('common.loading')}</span>
        </div>
      ) : hasKey ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#15803D',
              fontWeight: 500,
              width: 'fit-content',
            }}
          >
            ✅ {t('settings.aiKeyConfigured')}
          </div>
          <div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                border: '1px solid #FCA5A5',
                borderRadius: '6px',
                color: '#DC2626',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.6 : 1,
              }}
            >
              {deleting ? t('settings.aiKeyDeleting') : t('settings.aiKeyDelete')}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            style={{
              padding: '8px 12px',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#0F172A',
              background: '#F8FAFC',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div>
            <button
              onClick={handleSave}
              disabled={saving || !keyInput.trim()}
              style={{
                padding: '8px 16px',
                background: saving || !keyInput.trim() ? '#E2E8F0' : '#3B82F6',
                color: saving || !keyInput.trim() ? '#94A3B8' : '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: saving || !keyInput.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? t('settings.aiKeySaving') : t('settings.aiKeySave')}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          style={{
            fontSize: '0.875rem',
            color: message.type === 'success' ? '#15803D' : '#DC2626',
            margin: 0,
          }}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
