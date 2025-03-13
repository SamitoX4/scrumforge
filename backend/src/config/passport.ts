/**
 * passport.ts — Configuración de la estrategia Google OAuth 2.0.
 *
 * Usa Passport.js con `passport-google-oauth20` en modo stateless (sin sesión),
 * ya que la autenticación se gestiona mediante JWT en lugar de cookies de sesión.
 *
 * Flujo completo de autenticación con Google:
 *  1. El usuario visita GET /auth/google → Passport redirige a la pantalla de
 *     consentimiento de Google.
 *  2. Google redirige a GET /auth/google/callback con un código de autorización.
 *  3. Passport intercambia el código por un perfil de usuario usando las
 *     credenciales de la app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
 *  4. El verify callback de esta función busca o crea el usuario en la DB
 *     usando la lógica de tres pasos descrita más abajo.
 *  5. app.ts genera los JWT y redirige al frontend con los tokens.
 *
 * Lógica de vinculación de cuentas (tres pasos):
 *  1. Si ya existe un OAuthAccount con ese provider+id → devolver el usuario.
 *  2. Si existe un usuario con el mismo email → vincular la cuenta OAuth.
 *  3. Si no existe ningún usuario → crear uno nuevo con cuenta OAuth vinculada.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

/**
 * Configura la estrategia de autenticación de Google en Passport.
 *
 * Se recibe el cliente de Prisma como parámetro (inyección de dependencia)
 * en lugar de importarlo directamente, para facilitar el testing y evitar
 * dependencias circulares entre módulos.
 *
 * @param db - Instancia de PrismaClient para buscar/crear usuarios en la DB.
 */
export function configurePassport(db: PrismaClient): void {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // La URL de callback debe coincidir exactamente con la registrada en
        // Google Cloud Console. BACKEND_URL permite configurarla para producción.
        callbackURL: `${process.env.BACKEND_URL ?? 'http://localhost:4000'}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // Extraer el email principal del perfil de Google
          const email = profile.emails?.[0]?.value;
          if (!email) {
            // Google siempre proporciona email si el scope 'email' fue solicitado;
            // este caso es teóricamente imposible pero lo manejamos por seguridad.
            return done(new Error('No se pudo obtener el email de Google'));
          }

          const providerAccountId = profile.id; // ID único del usuario en Google
          const avatarUrl = profile.photos?.[0]?.value ?? null;
          const name = profile.displayName ?? email; // Fallback al email si no hay nombre

          // ── Paso 1: Verificar si la cuenta OAuth ya está vinculada ────────────
          // Búsqueda por clave compuesta (provider, providerAccountId) para evitar
          // duplicados si el mismo usuario inicia sesión varias veces.
          const existing = await db.oAuthAccount.findUnique({
            where: { provider_providerAccountId: { provider: 'google', providerAccountId } },
            include: { user: true },
          });

          if (existing) {
            // Actualizar el avatar si cambió desde el último login
            if (avatarUrl && existing.user.avatarUrl !== avatarUrl) {
              await db.user.update({ where: { id: existing.user.id }, data: { avatarUrl } });
            }
            return done(null, existing.user);
          }

          // ── Paso 2: Vincular con cuenta existente por email ───────────────────
          // Si el usuario ya tiene una cuenta local con ese email, vinculamos
          // su cuenta OAuth sin crear un usuario duplicado.
          let user = await db.user.findUnique({ where: { email } });

          if (user) {
            // Vincular la cuenta de Google a la cuenta local existente
            await db.oAuthAccount.create({
              data: { userId: user.id, provider: 'google', providerAccountId },
            });
            // Aprovechar que Google ya verificó el email para marcar el campo
            if (!user.emailVerifiedAt) {
              user = await db.user.update({
                where: { id: user.id },
                data: { emailVerifiedAt: new Date(), avatarUrl: avatarUrl ?? user.avatarUrl },
              });
            }
            return done(null, user);
          }

          // ── Paso 3: Crear nuevo usuario ───────────────────────────────────────
          // El usuario nunca ha usado ScrumForge. Se crea con una contraseña
          // aleatoria (no usable) porque el campo es obligatorio en el schema,
          // pero este usuario nunca podrá hacer login con contraseña.
          const randomPassword = crypto.randomBytes(32).toString('hex');
          user = await db.user.create({
            data: {
              email,
              name,
              password: randomPassword,
              avatarUrl,
              // Google ya verificó el email → marcarlo como verificado directamente
              emailVerifiedAt: new Date(),
              oauthAccounts: {
                // Crear la relación OAuthAccount en la misma transacción
                create: { provider: 'google', providerAccountId },
              },
            },
          });

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}
