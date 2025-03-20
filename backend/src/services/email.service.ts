/**
 * @file email.service.ts
 * @module services
 * @description Servicio de envío de correos electrónicos de la aplicación.
 *
 * Utiliza Nodemailer con un transporte SMTP configurado mediante variables
 * de entorno (`MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`). Si alguna variable
 * falta, el transporte es null y todos los correos se imprimen en consola
 * en lugar de enviarse (modo desarrollo).
 *
 * Todos los métodos públicos son fire-and-forget: los errores de envío
 * se registran en el log pero no se propagan al llamador, evitando que
 * un fallo en el servidor de correo bloquee las operaciones de negocio.
 *
 * Los textos de usuarios se escapan con `escapeHtml` antes de insertarlos
 * en el HTML del email para prevenir inyección de HTML/XSS.
 */

import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

/** URL base del frontend para construir los enlaces de los emails. */
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

/**
 * @interface EmailOptions
 * @description Estructura de datos para un email a enviar.
 */
interface EmailOptions {
  /** Dirección de correo del destinatario. */
  to: string;
  /** Asunto del mensaje. */
  subject: string;
  /** Cuerpo del mensaje en formato HTML. */
  html: string;
}

/**
 * Construye el transporte de Nodemailer a partir de las variables de entorno.
 * Si alguna variable (`MAIL_SERVICE`, `MAIL_USER`, `MAIL_PASS`) no está
 * definida, retorna null para activar el modo consola (desarrollo).
 *
 * @returns Transporte de Nodemailer configurado, o null si faltan credenciales.
 */
function buildTransporter() {
  const service  = process.env.MAIL_SERVICE;
  const user     = process.env.MAIL_USER;
  const pass     = process.env.MAIL_PASS;

  // Si falta cualquier variable de configuración, no se puede crear el transporte
  if (!service || !user || !pass) return null;

  return nodemailer.createTransport({
    service,
    auth: { user, pass },
  });
}

/**
 * @class EmailService
 * @description Servicio centralizado de envío de emails transaccionales.
 * Cada método corresponde a un tipo de correo específico del flujo de la app.
 */
export class EmailService {
  private readonly transporter: ReturnType<typeof nodemailer.createTransport> | null;
  /** Dirección del remitente en formato "Nombre <email>". */
  private readonly from: string;

  constructor() {
    this.transporter = buildTransporter();
    // Se usa la variable de entorno si existe; si no, una dirección genérica de no-respuesta
    this.from = process.env.MAIL_USER
      ? `ScrumForge <${process.env.MAIL_USER}>`
      : 'ScrumForge <noreply@scrumforge.dev>';

    if (this.transporter) {
      logger.info(`EmailService: usando Nodemailer (${process.env.MAIL_SERVICE})`);
    } else {
      // Advertencia para el desarrollador de que los emails no se enviarán realmente
      logger.warn('EmailService: MAIL_SERVICE/MAIL_USER/MAIL_PASS no configurados — modo consola activo');
    }
  }

  /**
   * Método privado base de envío. Si hay transporte configurado, usa Nodemailer;
   * si no, imprime el email en el log (modo desarrollo).
   * Los errores de envío se registran pero no se propagan (non-fatal).
   *
   * @param options - Destinatario, asunto y cuerpo HTML del email.
   */
  private async send(options: EmailOptions): Promise<void> {
    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
      } catch (err) {
        logger.error({ err }, `EmailService: error al enviar a ${options.to}`);
        // Non-fatal: log but don't throw so callers are not blocked
      }
    } else {
      // En desarrollo, se imprime un extracto del email para depuración
      logger.info(
        `[EmailService] DEV MODE — email not sent.\n` +
          `  To: ${options.to}\n` +
          `  Subject: ${options.subject}\n` +
          `  Body (truncated): ${options.html.slice(0, 200)}...`,
      );
    }
  }

  /**
   * Envía el email de verificación de dirección de correo electrónico.
   * El enlace incluye el token y apunta a la ruta `/verify-email` del frontend.
   *
   * @param to - Dirección de correo del destinatario.
   * @param name - Nombre del usuario para personalizar el saludo.
   * @param token - Token de verificación generado aleatoriamente.
   */
  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    // Se construye la URL completa de verificación con el token como parámetro
    const url = `${FRONTEND_URL}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Verifica tu correo electrónico — ScrumForge',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>Hola, ${escapeHtml(name)}</h2>
          <p>Gracias por registrarte. Por favor verifica tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Verificar email
            </a>
          </p>
          <p>O copia y pega esta URL en tu navegador:</p>
          <p style="word-break:break-all;color:#6B7280;">${url}</p>
          <p style="color:#9CA3AF;font-size:12px;">Este enlace expira en 24 horas.</p>
        </div>
      `,
    });
  }

  /**
   * Envía el email de restablecimiento de contraseña.
   * El enlace apunta a `/reset-password` del frontend con el token como parámetro.
   * El enlace expira en 1 hora.
   *
   * @param to - Dirección de correo del destinatario.
   * @param name - Nombre del usuario para personalizar el saludo.
   * @param token - Token de restablecimiento generado aleatoriamente.
   */
  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const url = `${FRONTEND_URL}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Restablecer contraseña — ScrumForge',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>Hola, ${escapeHtml(name)}</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Restablecer contraseña
            </a>
          </p>
          <p>O copia y pega esta URL en tu navegador:</p>
          <p style="word-break:break-all;color:#6B7280;">${url}</p>
          <p style="color:#9CA3AF;font-size:12px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      `,
    });
  }

  /**
   * Envía el email de invitación a un workspace.
   * El enlace apunta a `/accept-invitation` del frontend con el token.
   * La invitación expira en 7 días.
   *
   * @param to - Dirección de correo del invitado.
   * @param inviterName - Nombre del usuario que realizó la invitación.
   * @param workspaceName - Nombre del workspace al que se invita.
   * @param token - Token único de la invitación.
   */
  async sendWorkspaceInvitationEmail(
    to: string,
    inviterName: string,
    workspaceName: string,
    token: string,
  ): Promise<void> {
    const url = `${FRONTEND_URL}/accept-invitation?token=${token}`;
    await this.send({
      to,
      subject: `Te invitaron a ${workspaceName} — ScrumForge`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>${escapeHtml(inviterName)} te ha invitado a unirte a <em>${escapeHtml(workspaceName)}</em></h2>
          <p>Acepta la invitación para colaborar en este workspace:</p>
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Aceptar invitación
            </a>
          </p>
          <p>O copia y pega esta URL en tu navegador:</p>
          <p style="word-break:break-all;color:#6B7280;">${url}</p>
          <p style="color:#9CA3AF;font-size:12px;">Esta invitación expira en 7 días.</p>
        </div>
      `,
    });
  }

  /**
   * Notifica al Scrum Master que una historia de usuario fue bloqueada.
   * Se incluye el título de la historia y el motivo del bloqueo.
   *
   * @param to - Email del Scrum Master a notificar.
   * @param smName - Nombre del Scrum Master.
   * @param storyTitle - Título de la historia bloqueada.
   * @param reason - Motivo del bloqueo.
   * @param projectName - Nombre del proyecto para contextualizar.
   */
  async sendStoryBlockedEmail(
    to: string,
    smName: string,
    storyTitle: string,
    reason: string,
    projectName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Historia bloqueada: ${storyTitle} — ScrumForge`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>Hola, ${escapeHtml(smName)}</h2>
          <p>Una historia de usuario en <strong>${escapeHtml(projectName)}</strong> ha sido bloqueada:</p>
          <div style="border-left:4px solid #EF4444;padding:12px 16px;margin:16px 0;background:#FEF2F2;border-radius:4px;">
            <strong>Historia:</strong> ${escapeHtml(storyTitle)}<br/>
            <strong>Motivo:</strong> ${escapeHtml(reason)}
          </div>
          <p>Por favor revisa el tablero y actúa para desbloquearla lo antes posible.</p>
          <p style="margin:24px 0;">
            <a href="${FRONTEND_URL}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Ver tablero
            </a>
          </p>
        </div>
      `,
    });
  }

  /**
   * Notifica al Product Owner que un impedimento lleva más de 2 días sin resolver
   * y ha sido escalado para su atención.
   *
   * @param to - Email del Product Owner.
   * @param poName - Nombre del Product Owner.
   * @param impedimentTitle - Título del impedimento escalado.
   * @param projectName - Nombre del proyecto para contextualizar.
   */
  async sendImpedimentEscalatedEmail(
    to: string,
    poName: string,
    impedimentTitle: string,
    projectName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Impedimento sin resolver >2 días: ${impedimentTitle} — ScrumForge`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>Hola, ${escapeHtml(poName)}</h2>
          <p>Un impedimento en <strong>${escapeHtml(projectName)}</strong> lleva más de 2 días sin resolverse y ha sido escalado:</p>
          <div style="border-left:4px solid #F59E0B;padding:12px 16px;margin:16px 0;background:#FFFBEB;border-radius:4px;">
            <strong>${escapeHtml(impedimentTitle)}</strong>
          </div>
          <p>Se requiere tu atención para desbloquearlo.</p>
          <p style="margin:24px 0;">
            <a href="${FRONTEND_URL}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Ver impedimentos
            </a>
          </p>
        </div>
      `,
    });
  }

  /**
   * Notifica a los miembros del equipo que un sprint ha comenzado,
   * incluyendo el objetivo del sprint si está definido.
   *
   * @param to - Email del miembro a notificar.
   * @param memberName - Nombre del miembro del equipo.
   * @param sprintName - Nombre del sprint iniciado.
   * @param sprintGoal - Objetivo del sprint (puede ser una cadena vacía).
   * @param projectName - Nombre del proyecto para contextualizar.
   */
  async sendSprintStartedEmail(
    to: string,
    memberName: string,
    sprintName: string,
    sprintGoal: string,
    projectName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Sprint iniciado: ${sprintName} — ScrumForge`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>Hola, ${escapeHtml(memberName)}</h2>
          <p>El sprint <strong>${escapeHtml(sprintName)}</strong> en <strong>${escapeHtml(projectName)}</strong> ha comenzado.</p>
          ${sprintGoal ? `<div style="border-left:4px solid #10B981;padding:12px 16px;margin:16px 0;background:#ECFDF5;border-radius:4px;"><strong>Objetivo:</strong> ${escapeHtml(sprintGoal)}</div>` : ''}
          <p style="margin:24px 0;">
            <a href="${FRONTEND_URL}" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Ver tablero del sprint
            </a>
          </p>
        </div>
      `,
    });
  }

  /**
   * Envía el email de bienvenida tras la verificación exitosa del correo.
   * Se llama de forma asíncrona (fire-and-forget) después de verificar el email.
   *
   * @param to - Email del nuevo usuario.
   * @param name - Nombre del usuario para personalizar el mensaje.
   */
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: '¡Bienvenido a ScrumForge!',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#3B82F6;">ScrumForge</h1>
          <h2>¡Hola, ${escapeHtml(name)}!</h2>
          <p>Tu cuenta ha sido verificada exitosamente. Ya puedes iniciar sesión y comenzar a gestionar tus proyectos ágiles.</p>
          <p style="margin:24px 0;">
            <a href="${FRONTEND_URL}/login" style="background:#3B82F6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
              Iniciar sesión
            </a>
          </p>
        </div>
      `,
    });
  }
}

/**
 * Escapa los caracteres especiales de HTML para prevenir inyección XSS
 * cuando se insertan datos de usuario directamente en el cuerpo HTML del email.
 *
 * Caracteres escapados: `&`, `<`, `>`, `"`, `'`.
 *
 * @param str - Cadena de texto potencialmente peligrosa.
 * @returns Cadena con caracteres HTML escapados como entidades.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')   // Debe escaparse primero para no doblar los demás
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
