import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  LIST_WEBHOOKS,
  REGISTER_WEBHOOK,
  DELETE_WEBHOOK,
  CONFIGURE_SLACK,
  GITHUB_ACTIVITY,
  GITHUB_LINKED_REPO,
  LINK_GITHUB_REPO,
} from '@/graphql/integrations/integrations.queries';

/**
 * Props de IntegrationsTab.
 * @property workspaceId - ID del workspace para las operaciones de webhooks y Slack.
 * @property projectId - ID del proyecto para las operaciones de GitHub (opcional;
 *   si no se pasa, la sección de GitHub queda oculta).
 */
interface Props {
  workspaceId: string;
  projectId?: string;
}

/**
 * Eventos de ScrumForge disponibles para suscribir en un webhook.
 * Se muestran como checkboxes al registrar un nuevo endpoint.
 */
const WEBHOOK_EVENTS = [
  { value: 'story.created', label: 'Historia creada' },
  { value: 'story.done', label: 'Historia completada' },
  { value: 'sprint.started', label: 'Sprint iniciado' },
  { value: 'sprint.completed', label: 'Sprint completado' },
];

/** Webhook registrado en el workspace. */
interface Webhook {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

/** Commit de GitHub obtenido a través de la integración del servidor. */
interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/**
 * Pestaña de Integraciones del workspace.
 *
 * Gestiona tres tipos de integración:
 *  1. **GitHub** — vincula un repositorio a nivel de proyecto para mostrar
 *     los últimos commits dentro de ScrumForge. Solo visible si se pasa `projectId`.
 *  2. **Slack** — configura el Incoming Webhook URL de Slack para que el backend
 *     envíe notificaciones automáticas a un canal.
 *  3. **Webhooks** — permite registrar endpoints HTTP externos que recibirán
 *     eventos de ScrumForge (HMAC-SHA256 con secret opcional).
 *
 * Nota: este componente es el fallback del core. La extensión 'integrations'
 * puede sustituirlo mediante el slot 'workspace-integrations-tab'.
 */
export function IntegrationsTab({ workspaceId, projectId }: Props) {
  // Estado local del formulario de GitHub
  const [repoUrl, setRepoUrl] = useState('');
  const [repoSaved, setRepoSaved] = useState(false);

  // Estado local del formulario de Slack
  const [slackUrl, setSlackUrl] = useState('');
  const [slackSaved, setSlackSaved] = useState(false);

  // Estado local del formulario de registro de webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [webhookSaved, setWebhookSaved] = useState(false);

  /**
   * Consulta del repositorio vinculado al proyecto.
   * Se omite si no hay projectId (la sección GitHub no se muestra).
   */
  const { data: linkedRepoData, loading: linkedRepoLoading } = useQuery<{ githubLinkedRepo: string | null }>(
    GITHUB_LINKED_REPO,
    { variables: { projectId }, skip: !projectId },
  );

  /**
   * Consulta de actividad reciente de GitHub.
   * Se omite si no hay repositorio vinculado para evitar peticiones innecesarias.
   */
  const { data: activityData, loading: activityLoading } = useQuery<{ githubActivity: GithubCommit[] }>(
    GITHUB_ACTIVITY,
    { variables: { projectId }, skip: !projectId || !linkedRepoData?.githubLinkedRepo },
  );

  const [linkRepo, { loading: linkingRepo }] = useMutation<any>(LINK_GITHUB_REPO, {
    // Refrescar ambas queries para reflejar el nuevo repo vinculado y sus commits
    refetchQueries: ['GithubLinkedRepo', 'GithubActivity'],
    onCompleted: () => setRepoSaved(true),
  });

  const [configureSlack, { loading: savingSlack }] = useMutation<any>(CONFIGURE_SLACK, {
    onCompleted: () => setSlackSaved(true),
  });

  const { data: webhooksData, loading: webhooksLoading, refetch: refetchWebhooks } = useQuery<{ listWebhooks: Webhook[] }>(
    LIST_WEBHOOKS,
    { variables: { workspaceId }, skip: !workspaceId },
  );

  const [registerWebhook, { loading: registeringWebhook }] = useMutation<any>(REGISTER_WEBHOOK, {
    onCompleted: () => {
      // Limpiar el formulario y mostrar confirmación temporal de 3 segundos
      setWebhookUrl('');
      setWebhookSecret('');
      setSelectedEvents([]);
      setWebhookSaved(true);
      refetchWebhooks();
      setTimeout(() => setWebhookSaved(false), 3000);
    },
  });

  const [deleteWebhook] = useMutation<any>(DELETE_WEBHOOK, {
    onCompleted: () => refetchWebhooks(),
  });

  /** Alterna la selección de un evento para el nuevo webhook. */
  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  /**
   * Vincula el repositorio de GitHub introducido al proyecto actual.
   * Resetea el indicador de guardado antes de ejecutar la mutación para
   * ocultar cualquier confirmación anterior.
   */
  async function handleLinkRepo() {
    if (!projectId || !repoUrl.trim()) return;
    setRepoSaved(false);
    await linkRepo({ variables: { projectId, repoUrl: repoUrl.trim() } });
  }

  /**
   * Guarda la URL de Incoming Webhook de Slack para el workspace.
   * El backend la utiliza para enviar notificaciones automáticas al canal configurado.
   */
  async function handleConfigureSlack() {
    if (!workspaceId || !slackUrl.trim()) return;
    setSlackSaved(false);
    await configureSlack({ variables: { workspaceId, webhookUrl: slackUrl.trim() } });
  }

  /**
   * Registra un nuevo endpoint de webhook para el workspace.
   * El secret HMAC-SHA256 es opcional; si el usuario lo proporciona, el backend
   * firma el payload y el receptor puede verificar la autenticidad.
   */
  async function handleRegisterWebhook() {
    if (!workspaceId || !webhookUrl.trim() || selectedEvents.length === 0) return;
    setWebhookSaved(false);
    await registerWebhook({
      variables: {
        workspaceId,
        url: webhookUrl.trim(),
        events: selectedEvents,
        // El secret es opcional; si el usuario no lo rellena, no se envía
        secret: webhookSecret.trim() || undefined,
      },
    });
  }

  const linkedRepo = linkedRepoData?.githubLinkedRepo;
  const commits = activityData?.githubActivity ?? [];
  const webhooks = webhooksData?.listWebhooks ?? [];

  // Estilos compartidos definidos como constantes para reducir repetición en el JSX
  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1E293B',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#1E293B',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '6px',
    display: 'block',
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: '#6366F1',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '8px',
  };

  // Variante deshabilitada del botón — mismo layout pero apariencia atenuada
  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle,
    background: '#CBD5E1',
    cursor: 'not-allowed',
  };

  const successMsgStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: '#22C55E',
    marginTop: '8px',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    background: '#EEF2FF',
    color: '#6366F1',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginRight: '4px',
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Sección de GitHub — solo visible cuando el componente recibe un projectId */}
      {projectId && (
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>
            <span>🔗</span> GitHub
          </h3>

          {linkedRepoLoading ? (
            <p style={{ fontSize: '0.875rem', color: '#64748B' }}>Cargando...</p>
          ) : (
            <>
              {/* Si ya hay repositorio vinculado, se muestra el enlace antes del formulario */}
              {linkedRepo && (
                <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '12px' }}>
                  Repositorio vinculado:{' '}
                  <a href={linkedRepo} target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1' }}>
                    {linkedRepo}
                  </a>
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>URL del repositorio</label>
                  <input
                    style={inputStyle}
                    type="url"
                    placeholder="https://github.com/org/repo"
                    value={repoUrl}
                    onChange={(e) => { setRepoUrl(e.target.value); setRepoSaved(false); }}
                  />
                </div>
                <button
                  style={repoUrl.trim() && !linkingRepo ? btnStyle : btnDisabledStyle}
                  disabled={!repoUrl.trim() || linkingRepo}
                  onClick={handleLinkRepo}
                >
                  {linkingRepo ? 'Vinculando...' : 'Vincular'}
                </button>
              </div>

              {repoSaved && <p style={successMsgStyle}>Repositorio vinculado correctamente.</p>}

              {/* Actividad reciente — se muestra solo si hay repositorio vinculado */}
              {linkedRepo && (
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                    Últimos commits
                  </p>
                  {activityLoading ? (
                    <p style={{ fontSize: '0.875rem', color: '#64748B' }}>Cargando commits...</p>
                  ) : commits.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#94A3B8' }}>Sin actividad reciente.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {/* Se muestran solo los 5 commits más recientes para no saturar la UI */}
                      {commits.slice(0, 5).map((commit) => (
                        <li
                          key={commit.sha}
                          style={{
                            padding: '10px 0',
                            borderBottom: '1px solid #F1F5F9',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                          }}
                        >
                          {/* Abreviación del SHA a 7 caracteres — convención de Git */}
                          <code style={{ fontSize: '0.75rem', color: '#6366F1', minWidth: '58px', paddingTop: '2px' }}>
                            {commit.sha.slice(0, 7)}
                          </code>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: '#1E293B' }}>{commit.message}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                              {commit.author} · {new Date(commit.date).toLocaleDateString()}
                            </p>
                          </div>
                          {commit.url && (
                            <a
                              href={commit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.75rem', color: '#6366F1', paddingTop: '2px' }}
                            >
                              Ver
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sección de Slack — Incoming Webhook para notificaciones del backend */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span>💬</span> Slack
        </h3>
        <label style={labelStyle}>Incoming Webhook URL</label>
        <input
          style={inputStyle}
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          value={slackUrl}
          onChange={(e) => { setSlackUrl(e.target.value); setSlackSaved(false); }}
        />
        <button
          style={slackUrl.trim() && !savingSlack ? btnStyle : btnDisabledStyle}
          disabled={!slackUrl.trim() || savingSlack}
          onClick={handleConfigureSlack}
        >
          {savingSlack ? 'Guardando...' : 'Guardar'}
        </button>
        {slackSaved && (
          <p style={successMsgStyle}>Slack configurado correctamente.</p>
        )}
      </div>

      {/* Sección de Webhooks — listado de existentes y formulario de registro */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span>🔔</span> Webhooks
        </h3>

        {/* Lista de webhooks registrados */}
        {webhooksLoading ? (
          <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '16px' }}>Cargando webhooks...</p>
        ) : webhooks.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginBottom: '16px' }}>Sin webhooks registrados.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
            {webhooks.map((wh) => (
              <li
                key={wh.id}
                style={{
                  padding: '12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.875rem', color: '#1E293B', wordBreak: 'break-all' }}>
                    {wh.url}
                  </p>
                  <div>
                    {wh.events.map((ev) => (
                      <span key={ev} style={badgeStyle}>{ev}</span>
                    ))}
                    {/* Badge de estado con color diferenciado activo/inactivo */}
                    <span style={{
                      ...badgeStyle,
                      background: wh.active ? '#DCFCE7' : '#FEE2E2',
                      color: wh.active ? '#16A34A' : '#DC2626',
                    }}>
                      {wh.active ? 'activo' : 'inactivo'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteWebhook({ variables: { id: wh.id } })}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#EF4444',
                    fontSize: '0.875rem',
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                  title="Eliminar webhook"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Formulario de registro de nuevo webhook */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
            Registrar nuevo webhook
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>URL del endpoint</label>
            <input
              style={inputStyle}
              type="url"
              placeholder="https://your-server.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Eventos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {WEBHOOK_EVENTS.map((ev) => (
                <label
                  key={ev.value}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem', color: '#334155' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            {/* El secret es HMAC-SHA256 — el backend lo usa para firmar el payload */}
            <label style={labelStyle}>Secret (opcional)</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Clave secreta para verificar la firma"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>

          {/* El botón se habilita solo cuando hay URL y al menos un evento seleccionado */}
          <button
            style={
              webhookUrl.trim() && selectedEvents.length > 0 && !registeringWebhook
                ? btnStyle
                : btnDisabledStyle
            }
            disabled={!webhookUrl.trim() || selectedEvents.length === 0 || registeringWebhook}
            onClick={handleRegisterWebhook}
          >
            {registeringWebhook ? 'Registrando...' : 'Registrar webhook'}
          </button>

          {webhookSaved && (
            <p style={successMsgStyle}>Webhook registrado correctamente.</p>
          )}
        </div>
      </div>
    </div>
  );
}
