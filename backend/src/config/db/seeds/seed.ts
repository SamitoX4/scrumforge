/**
 * @file seed.ts
 * @description Script de siembra (seed) para la base de datos de ScrumForge.
 *
 * Propósito: Poblar la base de datos con datos de demostración coherentes que
 * permitan explorar todas las funcionalidades de la plataforma sin necesidad
 * de configurar nada manualmente. Es seguro ejecutarlo múltiples veces gracias
 * al uso de `upsert` y guardas `findFirst` + `if (!x)`, que evitan duplicados.
 *
 * Estructura de datos sembrada (en orden de dependencias):
 *   1. Plans           — Los tres planes de suscripción disponibles
 *   2. Users           — Cinco usuarios con roles Scrum distintos
 *   3. Workspace       — Un workspace de demo con suscripción al plan free
 *   4. Team            — Un equipo con los cinco usuarios como miembros
 *   5. Project         — Un proyecto con columnas Kanban configuradas
 *   6. Epics           — Cinco épicas que agrupan el backlog
 *   7. Sprints         — Sprint 0 completado, Sprint 1 activo, Sprint 2 en planificación
 *   8. User Stories    — Historias distribuidas entre sprints y backlog
 *   9. Tasks           — Tareas de ejemplo para la historia de registro
 *  10. DoD             — Seis ítems de la Definition of Done
 *  11. Impediments     — Tres impedimentos en distintos estados
 *  12. Retrospective   — Retro del Sprint 0 con tarjetas y acciones
 *  13. Planning Poker  — Sesión revelada con votos de todos los miembros
 *  14. Notifications   — Notificaciones demo para tres usuarios
 *
 * @usage  npx ts-node src/config/db/seeds/seed.ts
 *         o bien el script npm: npm run db:seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../../../utils/crypto.utils';

// Se usa el adaptador PrismaPg sobre un Pool de pg para mantener consistencia
// con el resto del backend, que también opera sobre un pool de conexiones.
// DATABASE_URL proviene del archivo .env cargado por dotenv/config al inicio.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = new PrismaClient({ adapter: new PrismaPg(pool as any) });

async function main() {
  console.log('🌱 Sembrando base de datos...\n');

  // ── Plans ──────────────────────────────────────────────────────────────────
  // Los planes definen los límites funcionales de cada workspace (cuántos
  // proyectos, miembros, almacenamiento, etc.). Se crean con upsert para que el
  // seed sea idempotente: si el plan ya existe, no se sobreescribe (update: {}).
  // Se guarda la referencia a planFree porque se necesita más adelante al crear
  // la suscripción del workspace de demo.
  const planFree = await db.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      limits: {
        maxProjects: 1,       // Un solo proyecto para incentivar el upgrade
        maxMembers: 5,        // Equipo pequeño viable sin pagar
        storageMb: 1024,      // 1 GB de almacenamiento
        sprintHistory: 3,     // Solo los 3 últimos sprints en reportes
        integrations: false,
        planningPoker: false,
        advancedReports: false,
      },
    },
  });

  // Plan pro: desbloquea proyectos ilimitados, planning poker e integraciones.
  // maxProjects y sprintHistory en null significan "sin límite" según el schema.
  await db.plan.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      limits: {
        maxProjects: null,    // Sin límite de proyectos
        maxMembers: 25,
        storageMb: 10240,     // 10 GB
        sprintHistory: null,  // Historial completo de sprints
        integrations: true,
        planningPoker: true,
        advancedReports: true,
      },
    },
  });

  // Plan business: pensado para grandes organizaciones, sin límite de miembros
  // y con 100 GB de almacenamiento.
  await db.plan.upsert({
    where: { name: 'business' },
    update: {},
    create: {
      name: 'business',
      limits: {
        maxProjects: null,
        maxMembers: null,     // Equipos ilimitados
        storageMb: 102400,    // 100 GB
        sprintHistory: null,
        integrations: true,
        planningPoker: true,
        advancedReports: true,
      },
    },
  });

  console.log('✅ Plans creados (free, pro, business)');

  // ── Users ──────────────────────────────────────────────────────────────────
  // Se crean cinco usuarios que representan los roles típicos de un equipo Scrum:
  // Admin/SM, Product Owner, Scrum Master, y dos Developers.
  // Todos se crean con emailVerifiedAt = now para que puedan iniciar sesión
  // inmediatamente, sin necesidad de pasar por el flujo de verificación de email.
  // Las contraseñas se hashean con la misma utilidad que usa el endpoint de registro,
  // garantizando compatibilidad con el proceso de autenticación real.
  const now = new Date();

  // Admin: actúa también como Scrum Master y es el owner del workspace de demo.
  const admin = await db.user.upsert({
    where: { email: 'admin@scrumforge.dev' },
    update: { emailVerifiedAt: now }, // En re-ejecuciones se reactiva la verificación
    create: {
      email: 'admin@scrumforge.dev',
      name: 'Admin ScrumForge',
      password: await hashPassword('password123'),
      emailVerifiedAt: now,
      locale: 'es',
      termsAcceptedAt: now,
      termsVersion: '1.0',
    },
  });

  // PO: Product Owner, responsable de gestionar el backlog y priorizar historias.
  const po = await db.user.upsert({
    where: { email: 'po@scrumforge.dev' },
    update: { emailVerifiedAt: now },
    create: {
      email: 'po@scrumforge.dev',
      name: 'Paula Ordóñez (PO)',
      password: await hashPassword('password123'),
      emailVerifiedAt: now,
      locale: 'es',
      termsAcceptedAt: now,
      termsVersion: '1.0',
    },
  });

  // SM: Scrum Master, facilita ceremonias y gestiona impedimentos.
  const sm = await db.user.upsert({
    where: { email: 'sm@scrumforge.dev' },
    update: { emailVerifiedAt: now },
    create: {
      email: 'sm@scrumforge.dev',
      name: 'Santiago Mora (SM)',
      password: await hashPassword('password123'),
      emailVerifiedAt: now,
      locale: 'es',
      termsAcceptedAt: now,
      termsVersion: '1.0',
    },
  });

  // dev y dev2: Developers con historias asignadas en los sprints activo y completado.
  const dev = await db.user.upsert({
    where: { email: 'dev@scrumforge.dev' },
    update: { emailVerifiedAt: now },
    create: {
      email: 'dev@scrumforge.dev',
      name: 'Diana Vargas (Dev)',
      password: await hashPassword('password123'),
      emailVerifiedAt: now,
      locale: 'es',
      termsAcceptedAt: now,
      termsVersion: '1.0',
    },
  });

  const dev2 = await db.user.upsert({
    where: { email: 'dev2@scrumforge.dev' },
    update: { emailVerifiedAt: now },
    create: {
      email: 'dev2@scrumforge.dev',
      name: 'Carlos Reyes (Dev)',
      password: await hashPassword('password123'),
      emailVerifiedAt: now,
      locale: 'es',
      termsAcceptedAt: now,
      termsVersion: '1.0',
    },
  });

  console.log('✅ Usuarios creados y verificados');

  // ── Workspace ──────────────────────────────────────────────────────────────
  // El workspace es el contenedor multi-tenant raíz. Todos los proyectos,
  // equipos y suscripciones pertenecen a un workspace. Se usa un slug único
  // ('demo-workspace') como clave de upsert para garantizar idempotencia.
  const workspace = await db.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      ownerId: admin.id,
      locale: 'es',
    },
  });

  // La suscripción vincula el workspace con un plan y su estado de pago.
  // Se asigna el plan free para que el workspace demo opere dentro de los
  // límites más restrictivos, que son los más habituales en nuevos registros.
  await db.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      planId: planFree.id,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Workspace + Subscription creados');

  // ── Team ───────────────────────────────────────────────────────────────────
  // El modelo Team no tiene un campo unique distinto al id, por lo que no se
  // puede usar upsert. En su lugar se busca primero y se crea solo si no existe,
  // evitando equipos duplicados en re-ejecuciones del seed.
  let team = await db.team.findFirst({
    where: { workspaceId: workspace.id, name: 'Equipo Demo' },
  });
  if (!team) {
    team = await db.team.create({
      data: { name: 'Equipo Demo', workspaceId: workspace.id },
    });
  }

  // Se asigna un rol Scrum distinto a cada usuario para que las vistas de
  // permisos y roles del frontend muestren contenido diferenciado por perfil.
  // TeamMember tiene un índice único compuesto (userId, teamId), lo que
  // permite usar upsert con la clave `userId_teamId`.
  const members = [
    { userId: admin.id, role: 'SCRUM_MASTER' },
    { userId: po.id,    role: 'PRODUCT_OWNER' },
    { userId: sm.id,    role: 'SCRUM_MASTER' },
    { userId: dev.id,   role: 'DEVELOPER' },
    { userId: dev2.id,  role: 'DEVELOPER' },
  ];
  for (const { userId, role } of members) {
    await db.teamMember.upsert({
      where: { userId_teamId: { userId, teamId: team.id } },
      update: {},
      create: { userId, teamId: team.id, role },
    });
  }

  console.log('✅ Equipo y miembros creados');

  // ── Project ────────────────────────────────────────────────────────────────
  // El proyecto define el tablero Kanban y agrupa sprints, épicas e historias.
  // La clave corta ('SF') identifica el proyecto en referencias tipo "SF-42".
  // settings almacena la configuración de columnas como JSON: cada columna tiene
  // un id estable (usado por el frontend para drag & drop), un título visible,
  // su estado correspondiente en el enum y un límite WIP opcional.
  let project = await db.project.findFirst({
    where: { teamId: team.id, key: 'SF' },
  });
  if (!project) {
    project = await db.project.create({
      data: {
        name: 'ScrumForge MVP',
        key: 'SF',
        teamId: team.id,
        settings: JSON.stringify({
          columns: [
            { id: 'col-todo',        title: 'Por hacer',   status: 'TODO',        wipLimit: null },
            { id: 'col-inprogress',  title: 'En progreso', status: 'IN_PROGRESS', wipLimit: 3    }, // Máx. 3 tareas simultáneas
            { id: 'col-inreview',    title: 'En revisión', status: 'IN_REVIEW',   wipLimit: 2    }, // Máx. 2 en revisión
            { id: 'col-done',        title: 'Hecho',       status: 'DONE',        wipLimit: null },
          ],
        }),
      },
    });
  }

  console.log('✅ Proyecto creado');

  // ── Epics ──────────────────────────────────────────────────────────────────
  // Las épicas agrupan historias de usuario por área funcional. Se definen con
  // colores distintos para facilitar la identificación visual en el backlog.
  // Se ordenan por prioridad descendente para que el backlog tenga sentido desde
  // el primer momento sin necesidad de reordenar manualmente.
  // Como Epic tampoco tiene unique por título+proyecto, se usa findFirst + create.
  const epicsData = [
    { title: 'Autenticación y Equipos',        color: '#3B82F6', priority: 'HIGH',   order: 0 },
    { title: 'Gestión del Product Backlog',    color: '#8B5CF6', priority: 'HIGH',   order: 1 },
    { title: 'Planificación de Sprints',       color: '#10B981', priority: 'MEDIUM', order: 2 },
    { title: 'Tablero de Ejecución',           color: '#F59E0B', priority: 'MEDIUM', order: 3 },
    { title: 'Reportes Básicos',               color: '#EF4444', priority: 'LOW',    order: 4 },
  ];

  // Se construye un mapa { título → entidad } para poder referenciar cada épica
  // al crear las historias de usuario más adelante, sin hacer queries adicionales.
  const epics: Record<string, Awaited<ReturnType<typeof db.epic.create>>> = {};
  for (const epicData of epicsData) {
    const existing = await db.epic.findFirst({
      where: { projectId: project.id, title: epicData.title },
    });
    epics[epicData.title] = existing ?? await db.epic.create({
      data: { ...epicData, projectId: project.id },
    });
  }

  console.log('✅ Épicas creadas');

  // ── Sprint completado (para reportes de velocidad) ─────────────────────────
  // Sprint 0 simula un sprint ya finalizado hace dos semanas. Tener al menos un
  // sprint completado con historias en DONE es imprescindible para que los
  // gráficos de velocidad y burndown histórico tengan datos que mostrar.
  // Las fechas se calculan dinámicamente respecto a `now` para que siempre
  // estén en el pasado, independientemente de cuándo se ejecute el seed.
  const sprint0Start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); // Hace 4 semanas
  const sprint0End   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // Hace 2 semanas

  // Se busca por ambas variantes del nombre para que el seed no falle si ya se
  // ejecutó con la versión anterior del título (robustez ante renombrados).
  let sprintCompleted = await db.sprint.findFirst({
    where: { projectId: project.id, name: { in: ['Sprint 0 — Foundation', 'Sprint 0 — Fundación'] } },
  });
  if (!sprintCompleted) {
    sprintCompleted = await db.sprint.create({
      data: {
        name: 'Sprint 0 — Foundation',
        goal: 'Set the technical foundation of the project',
        projectId: project.id,
        startDate: sprint0Start,
        endDate: sprint0End,
        status: 'COMPLETED',
      },
    });
  }

  // Sprint activo: arrancó hace 3 días y tiene 11 días restantes (ciclo de 2 semanas).
  // Sus fechas dinámicas garantizan que el tablero y el burndown muestren datos
  // relevantes sin importar en qué momento se corre el seed.
  const sprint1Start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);  // Hace 3 días
  const sprint1End   = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000); // En 11 días

  let sprintActive = await db.sprint.findFirst({
    where: { projectId: project.id, name: 'Sprint 1 — MVP Core' },
  });
  if (!sprintActive) {
    sprintActive = await db.sprint.create({
      data: {
        name: 'Sprint 1 — MVP Core',
        goal: 'Completar autenticación, backlog y tablero básico',
        projectId: project.id,
        startDate: sprint1Start,
        endDate: sprint1End,
        status: 'ACTIVE',
      },
    });
  }

  // Sprint en planificación: comienza justo cuando termina el Sprint 1.
  // Tener un sprint futuro en estado PLANNING permite demostrar el flujo de
  // planificación y la vista de sprint backlog vacío pendiente de poblarse.
  const sprint2Start = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000); // Comienza en 11 días
  const sprint2End   = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000); // Termina en 25 días

  let sprintPlanning = await db.sprint.findFirst({
    where: { projectId: project.id, name: 'Sprint 2 — Reportes y Permisos' },
  });
  if (!sprintPlanning) {
    sprintPlanning = await db.sprint.create({
      data: {
        name: 'Sprint 2 — Reportes y Permisos',
        goal: 'Implementar reportes de velocidad y burndown, y RBAC completo',
        projectId: project.id,
        startDate: sprint2Start,
        endDate: sprint2End,
        status: 'PLANNING',
      },
    });
  }

  console.log('✅ Sprints creados (completado, activo, planificación)');

  // ── User Stories ───────────────────────────────────────────────────────────
  // Toda la creación de historias se protege con una única guarda: si ya existe
  // cualquier historia para este proyecto, se omite el bloque completo.
  // Esto evita duplicados en re-ejecuciones sin necesidad de upsert por cada
  // historia (createMany no soporta upsert de forma nativa en Prisma).
  const storiesExist = await db.userStory.findFirst({ where: { projectId: project.id } });
  if (!storiesExist) {
    // Historias del Sprint 0 completado ─────────────────────────────────────
    // Representan tareas de infraestructura y setup técnico. Todas en DONE para
    // que los reportes de velocidad del Sprint 0 muestren puntos completados.
    await db.userStory.createMany({
      data: [
        {
          title: 'Configurar repositorio, CI/CD y estructura de carpetas',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintCompleted.id,
          status: 'DONE', points: 3, priority: 'HIGH',
          assigneeId: dev.id, order: 0,
        },
        {
          title: 'Diseñar y migrar el schema de base de datos inicial',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintCompleted.id,
          status: 'DONE', points: 5, priority: 'HIGH',
          assigneeId: dev2.id, order: 1,
        },
        {
          title: 'Implementar sistema de diseño base (Button, Input, Badge)',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintCompleted.id,
          status: 'DONE', points: 5, priority: 'MEDIUM',
          assigneeId: dev.id, order: 2,
        },
        {
          title: 'Configurar ESLint, Prettier y pre-commit hooks',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintCompleted.id,
          status: 'DONE', points: 2, priority: 'LOW',
          assigneeId: dev2.id, order: 3,
        },
      ],
    });

    // Historias del Sprint activo ─────────────────────────────────────────────
    // Se distribuyen deliberadamente entre los cuatro estados del tablero Kanban
    // (DONE, IN_REVIEW, IN_PROGRESS, TODO) para que todas las columnas tengan
    // contenido visible al abrir el tablero por primera vez.
    // Una historia (DnD) se marca como bloqueada para demostrar el indicador
    // visual de bloqueo y el campo blockedReason.
    await db.userStory.createMany({
      data: [
        {
          title: 'Como usuario quiero registrarme con email y contraseña',
          description: 'Formulario de registro con validaciones, email de verificación y redirección al onboarding',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintActive.id,
          status: 'DONE', points: 5, priority: 'HIGH',
          assigneeId: dev.id, order: 0,
        },
        {
          title: 'Como usuario quiero iniciar sesión para acceder a mis proyectos',
          description: 'Login con email/contraseña, JWT + refresh token, bloqueo si email no verificado',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintActive.id,
          status: 'IN_REVIEW', points: 3, priority: 'HIGH',
          assigneeId: dev.id, order: 1,
        },
        {
          title: 'Como usuario quiero recuperar mi contraseña por email',
          description: 'Flujo forgot/reset password con token de un solo uso (expira en 1h)',
          projectId: project.id,
          epicId: epics['Autenticación y Equipos'].id,
          sprintId: sprintActive.id,
          status: 'IN_PROGRESS', points: 3, priority: 'HIGH',
          assigneeId: dev2.id, order: 2,
        },
        {
          title: 'Como PO quiero crear épicas en el backlog con prioridad y color',
          description: 'CRUD de épicas con selector de prioridad y paleta de color',
          projectId: project.id,
          epicId: epics['Gestión del Product Backlog'].id,
          sprintId: sprintActive.id,
          status: 'DONE', points: 5, priority: 'HIGH',
          assigneeId: po.id, order: 3,
        },
        {
          title: 'Como PO quiero crear historias de usuario y asignarlas a épicas',
          description: 'Creación rápida (Enter para añadir), panel de detalle, estimación en Fibonacci',
          projectId: project.id,
          epicId: epics['Gestión del Product Backlog'].id,
          sprintId: sprintActive.id,
          status: 'IN_PROGRESS', points: 8, priority: 'HIGH',
          assigneeId: dev.id, order: 4,
        },
        {
          title: 'Como Dev quiero ver el tablero Kanban del sprint activo',
          description: 'Columnas configurables, tarjetas con asignado/SP/prioridad, placeholders en vacío',
          projectId: project.id,
          epicId: epics['Tablero de Ejecución'].id,
          sprintId: sprintActive.id,
          status: 'TODO', points: 5, priority: 'MEDIUM',
          assigneeId: dev2.id, order: 5,
        },
        {
          // Esta historia está bloqueada porque depende de "ver el tablero" (orden 5),
          // que aún no ha comenzado. Sirve para mostrar el flujo de impedimentos
          // relacionados con dependencias entre historias.
          title: 'Como Dev quiero mover tarjetas entre columnas con drag & drop',
          description: 'DnD táctil y escritorio, actualizaciones en tiempo real (<500ms)',
          projectId: project.id,
          epicId: epics['Tablero de Ejecución'].id,
          sprintId: sprintActive.id,
          status: 'TODO', points: 8, priority: 'MEDIUM',
          assigneeId: dev.id, order: 6,
          isBlocked: true,
          blockedReason: 'Depende de HU-16 (ver tablero) que aún está en TODO',
        },
      ],
    });

    // Historias en el backlog (sin sprint asignado) ───────────────────────────
    // Estas historias no tienen sprintId, por lo que aparecen en el product
    // backlog sin estar comprometidas en ningún sprint. Representan el trabajo
    // futuro planificado para el Sprint 2 y siguientes.
    await db.userStory.createMany({
      data: [
        // Planificación de Sprints
        {
          title: 'Como SM quiero crear un sprint con goal y fechas',
          projectId: project.id,
          epicId: epics['Planificación de Sprints'].id,
          status: 'TODO', points: 3, priority: 'HIGH', order: 0,
        },
        {
          title: 'Como SM quiero mover historias al sprint backlog con drag & drop',
          projectId: project.id,
          epicId: epics['Planificación de Sprints'].id,
          status: 'TODO', points: 5, priority: 'HIGH', order: 1,
        },
        {
          title: 'Como SM quiero ver el indicador de capacidad vs velocidad del equipo',
          projectId: project.id,
          epicId: epics['Planificación de Sprints'].id,
          status: 'TODO', points: 3, priority: 'MEDIUM', order: 2,
        },
        // Reportes
        {
          title: 'Como SM quiero ver el burndown chart del sprint activo',
          projectId: project.id,
          epicId: epics['Reportes Básicos'].id,
          status: 'TODO', points: 5, priority: 'MEDIUM', order: 0,
        },
        {
          title: 'Como PO quiero ver la velocidad del equipo por sprint',
          projectId: project.id,
          epicId: epics['Reportes Básicos'].id,
          status: 'TODO', points: 3, priority: 'LOW', order: 1,
        },
        // Tareas técnicas sin épica — demuestran que el backlog acepta ítems
        // que no encajan en ninguna épica funcional (ej. operaciones, docs)
        {
          title: 'Configurar monitoreo de errores (Sentry)',
          projectId: project.id,
          status: 'TODO', points: 2, priority: 'LOW', order: 0,
        },
        {
          title: 'Documentar API GraphQL con ejemplos de queries',
          projectId: project.id,
          status: 'TODO', points: 3, priority: 'LOW', order: 1,
        },
      ],
    });

    console.log('✅ Historias de usuario creadas');

    // ── Tasks para la historia de registro ──────────────────────────────────
    // Se añaden tareas de nivel técnico solo a la historia de registro porque
    // es la más madura (DONE) y sirve para demostrar el desglose historia→tarea.
    // La tarea de tests se deja en IN_PROGRESS para mostrar un estado mixto
    // realista (la historia está DONE pero los tests todavía se están completando).
    const storyRegistro = await db.userStory.findFirst({
      where: { projectId: project.id, title: { contains: 'registrarme con email' } },
    });
    if (storyRegistro) {
      await db.task.createMany({
        data: [
          { title: 'Diseñar formulario de registro',    userStoryId: storyRegistro.id, status: 'DONE',        assigneeId: dev.id,  order: 0 },
          { title: 'Implementar endpoint /auth/register', userStoryId: storyRegistro.id, status: 'DONE',      assigneeId: dev.id,  order: 1 },
          { title: 'Crear EmailVerificationToken en BD', userStoryId: storyRegistro.id, status: 'DONE',       assigneeId: dev2.id, order: 2 },
          { title: 'Enviar email de verificación',       userStoryId: storyRegistro.id, status: 'DONE',       assigneeId: dev2.id, order: 3 },
          { title: 'Test unitario del registro',         userStoryId: storyRegistro.id, status: 'IN_PROGRESS', assigneeId: dev.id,  order: 4 },
        ],
      });
    }
  } else {
    console.log('ℹ️  Historias ya existen — omitiendo creación');
  }

  // ── Definition of Done ────────────────────────────────────────────────────
  // La DoD es el contrato de calidad del equipo: una historia no puede marcarse
  // como DONE si no cumple todos estos criterios. Se crean con orden explícito
  // para que aparezcan siempre en el mismo orden en la UI, independientemente
  // del orden de inserción en la base de datos.
  const dodExists = await db.dodItem.findFirst({ where: { projectId: project.id } });
  if (!dodExists) {
    const dodItems = [
      'El código ha sido revisado por al menos un compañero (code review)',
      'Los tests unitarios han sido escritos y pasan exitosamente',
      'La funcionalidad ha sido probada en entorno de staging',
      'La documentación técnica ha sido actualizada',
      'No hay deuda técnica pendiente catalogada como crítica',
      'Los criterios de aceptación han sido validados por el PO',
    ];
    for (let i = 0; i < dodItems.length; i++) {
      await db.dodItem.create({
        data: { projectId: project.id, text: dodItems[i], order: i },
      });
    }
    console.log('✅ Definición de Done creada (6 ítems)');
  }

  // ── Impediments ────────────────────────────────────────────────────────────
  // Se crean tres impedimentos en distintos estados (IN_PROGRESS, OPEN, RESOLVED)
  // y de distintas categorías (TECHNICAL, EXTERNAL) para que la vista de
  // impedimentos muestre contenido representativo de la gestión real de bloqueos.
  // El impedimento resuelto tiene resolvedById y resolvedComment para demostrar
  // el flujo completo de cierre de un impedimento.
  const impedsExist = await db.impediment.findFirst({ where: { projectId: project.id } });
  if (!impedsExist) {
    await db.impediment.createMany({
      data: [
        {
          // Impedimento técnico activo: bloquea pruebas de integración del equipo
          title: 'El entorno de staging no responde — bloquea pruebas de integración',
          description: 'Desde el lunes el servidor de staging devuelve 502. DevOps está investigando.',
          category: 'TECHNICAL',
          impact: 'HIGH',
          status: 'IN_PROGRESS',
          projectId: project.id,
          sprintId: sprintActive.id,
          reportedById: dev.id,
          assignedToId: sm.id, // El SM es responsable de desbloquearlo
        },
        {
          // Impedimento externo abierto: depende de un tercero, sin assignee aún
          title: 'Falta acceso a la API de pagos del proveedor externo',
          description: 'El equipo de pagos no ha compartido las credenciales de producción.',
          category: 'EXTERNAL',
          impact: 'MEDIUM',
          status: 'OPEN',
          projectId: project.id,
          sprintId: sprintActive.id,
          reportedById: po.id,
        },
        {
          // Impedimento ya resuelto del Sprint 0: muestra el historial de bloqueos
          // y el campo de comentario de resolución
          title: 'Conflictos de dependencias en package.json resueltos',
          description: 'Se actualizó la versión de react-query a 5.x sin breaking changes.',
          category: 'TECHNICAL',
          impact: 'LOW',
          status: 'RESOLVED',
          projectId: project.id,
          sprintId: sprintCompleted.id,
          reportedById: dev2.id,
          resolvedById: dev2.id,
          resolvedComment: 'Actualizado package.json y eliminadas dependencias duplicadas.',
        },
      ],
    });
    console.log('✅ Impedimentos de demo creados (3)');
  }

  // ── Retrospective (Sprint 0) ───────────────────────────────────────────────
  // Se crea una retrospectiva cerrada del Sprint 0 usando la plantilla
  // START/STOP/CONTINUE, que es la más habitual en equipos Scrum.
  // Tener la retro en estado CLOSED permite mostrar la vista de retrospectiva
  // histórica, con todas las tarjetas y sus votos ya visibles para todos.
  const retroExists = await db.retrospective.findFirst({ where: { projectId: project.id } });
  if (!retroExists) {
    const retro = await db.retrospective.create({
      data: {
        projectId: project.id,
        sprintId: sprintCompleted.id,
        title: 'Sprint 0 — Foundation Retro',
        template: 'START_STOP_CONTINUE',
        status: 'CLOSED',    // Ya concluida: todos pueden ver las tarjetas
        createdById: sm.id,  // El SM facilita la retrospectiva
      },
    });

    // Tarjetas de la retro: dos por columna (Start, Stop, Continue), con votos
    // distintos para mostrar la funcionalidad de priorización por votos.
    await db.retroCard.createMany({
      data: [
        { retroId: retro.id, column: 'Start', body: 'Hacer sesiones de pair programming más frecuentes', authorId: dev.id, votes: 3 },
        { retroId: retro.id, column: 'Start', body: 'Escribir ADRs para decisiones técnicas importantes', authorId: dev2.id, votes: 2 },
        { retroId: retro.id, column: 'Stop', body: 'Hacer commits directamente a main sin PR', authorId: sm.id, votes: 4 },
        { retroId: retro.id, column: 'Stop', body: 'Resolver dudas por correo (usar Slack en su lugar)', authorId: po.id, votes: 1 },
        { retroId: retro.id, column: 'Continue', body: 'Daily standups de 15 minutos — son muy efectivos', authorId: dev.id, votes: 5 },
        { retroId: retro.id, column: 'Continue', body: 'Revisar el tablero al inicio de cada día', authorId: dev2.id, votes: 3 },
      ],
    });

    // Acciones de mejora derivadas de la retro: dos completadas y una pendiente
    // con fecha límite para mostrar el seguimiento de compromisos del equipo.
    await db.retroAction.createMany({
      data: [
        {
          retroId: retro.id,
          title: 'Configurar branch protection rules en GitHub (requerir PR + review)',
          assignedToId: sm.id,
          done: true,
        },
        {
          retroId: retro.id,
          title: 'Crear canal #tech-decisions en Slack para ADRs',
          assignedToId: dev.id,
          done: true,
        },
        {
          retroId: retro.id,
          title: 'Agendar sesión de pair programming semanal (viernes 15:00)',
          assignedToId: sm.id,
          done: false,
          dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Dentro de una semana
        },
      ],
    });

    console.log('✅ Sprint 0 retrospective created with cards and actions');
  }

  // ── Planning Poker session (Sprint 2 backlog) ─────────────────────────────
  // Se crea una sesión de Planning Poker ya revelada (REVEALED) sobre una
  // historia del backlog sin estimar, con votos de los cuatro participantes.
  // El estado REVEALED indica que las cartas ya se mostraron, lo que permite
  // ver la distribución de votos y el consenso alcanzado (mayoría en 5).
  // Se busca dinámicamente la primera historia del backlog para no acoplar
  // el seed a un id de historia concreto.
  const pokerExists = await db.pokerSession.findFirst({ where: { projectId: project.id } });
  if (!pokerExists) {
    // Se elige la primera historia sin sprint y sin estimar para ser realistas
    const backlogStory = await db.userStory.findFirst({
      where: { projectId: project.id, sprintId: null, status: 'TODO' },
    });
    if (backlogStory) {
      const session = await db.pokerSession.create({
        data: {
          projectId: project.id,
          storyId: backlogStory.id,
          status: 'REVEALED',  // Cartas destapadas tras la votación
          scale: 'FIBONACCI',  // Escala estándar de Planning Poker
          createdById: sm.id,
        },
      });

      // Votos ligeramente divergentes (3, 5, 5, 5) para ilustrar que hubo
      // una pequeña discrepancia y el equipo necesitó discutir antes de
      // acordar la estimación final de 5 puntos.
      await db.pokerVote.createMany({
        data: [
          { sessionId: session.id, userId: dev.id,  value: '5' },
          { sessionId: session.id, userId: dev2.id, value: '3' }, // Voto discrepante
          { sessionId: session.id, userId: sm.id,   value: '5' },
          { sessionId: session.id, userId: po.id,   value: '5' },
        ],
      });

      console.log('✅ Sesión de Planning Poker demo creada');
    }
  }

  // ── Notifications demo ─────────────────────────────────────────────────────
  // Se generan tres notificaciones de tipos distintos (SPRINT_START, STORY_BLOCKED,
  // ASSIGNMENT) dirigidas a usuarios diferentes. Esto permite verificar que el
  // centro de notificaciones muestra correctamente el payload y el tipo de cada
  // evento sin necesidad de disparar acciones reales en la aplicación.
  const notifsExist = await db.notification.findFirst({ where: { userId: admin.id } });
  if (!notifsExist) {
    await db.notification.createMany({
      data: [
        {
          userId: admin.id,
          type: 'SPRINT_START',
          payload: JSON.stringify({ message: 'Sprint 1 — MVP Core ha iniciado', sprintName: 'Sprint 1 — MVP Core' }),
        },
        {
          userId: sm.id,
          type: 'STORY_BLOCKED',
          // El SM debe ser notificado cuando una historia queda bloqueada
          // para que pueda actuar como facilitador y resolver el impedimento
          payload: JSON.stringify({ message: 'Historia bloqueada: Mover tarjetas con DnD', storyTitle: 'Como Dev quiero mover tarjetas entre columnas con drag & drop' }),
        },
        {
          userId: po.id,
          type: 'ASSIGNMENT',
          payload: JSON.stringify({ message: 'Te asignaron: Crear épicas en el backlog' }),
        },
      ],
    });
    console.log('✅ Notificaciones demo creadas');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  // Resumen final con las credenciales de acceso para facilitar las pruebas
  // manuales sin tener que consultar este archivo o la documentación.
  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Credenciales de acceso:');
  console.log('');
  console.log('  admin@scrumforge.dev  / password123  (Scrum Master + Owner)');
  console.log('  po@scrumforge.dev     / password123  (Product Owner)');
  console.log('  sm@scrumforge.dev     / password123  (Scrum Master)');
  console.log('  dev@scrumforge.dev    / password123  (Developer)');
  console.log('  dev2@scrumforge.dev   / password123  (Developer)');
  console.log('');
  console.log('  Workspace:  demo-workspace');
  console.log('  Proyecto:   ScrumForge MVP (SF)');
  console.log('  Sprints:    Sprint 0 (completado), Sprint 1 (activo), Sprint 2 (planificación)');
  console.log('  Extras:     DoD (6 ítems), 3 impedimentos, retro Sprint 0, poker session');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Se captura cualquier error inesperado para que el proceso termine con código
// de salida distinto de 0 y los scripts de CI detecten el fallo del seed.
// El bloque finally garantiza que el pool de conexiones se cierre siempre,
// evitando que el proceso quede colgado tras el seed.
main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
