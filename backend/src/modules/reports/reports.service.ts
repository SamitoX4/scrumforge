import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../utils/error.utils';

/**
 * Representa un punto en el gráfico de burndown.
 * Cada instancia corresponde a un día del sprint.
 */
export interface BurndownPoint {
  /** Fecha del punto en formato YYYY-MM-DD */
  date: string;
  /** Puntos de historia pendientes al final del día */
  remainingPoints: number;
  /** Puntos que deberían quedar si el equipo avanzara de forma lineal */
  idealPoints: number;
}

/**
 * Datos de velocidad de un sprint completado.
 * Se usa para construir el gráfico de barras de velocidad histórica.
 */
export interface VelocityData {
  sprintId: string;
  sprintName: string;
  /** Puntos completados (status DONE) al cerrar el sprint */
  completedPoints: number;
  /** Puntos planificados al inicio del sprint (capturados en el cierre) */
  plannedPoints: number;
}

/**
 * Punto del diagrama de flujo acumulado (Cumulative Flow Diagram).
 * Muestra la distribución de historias por estado en un día concreto.
 */
export interface CumulativeFlowPoint {
  /** Fecha del punto en formato YYYY-MM-DD */
  date: string;
  /** Número de historias en estado TODO */
  todo: number;
  /** Número de historias en estado IN_PROGRESS */
  inProgress: number;
  /** Número de historias en estado IN_REVIEW */
  inReview: number;
  /** Número de historias en estado DONE */
  done: number;
  /** Número de historias bloqueadas */
  blocked: number;
}

/**
 * Métricas de tiempo de entrega para una historia de usuario individual.
 */
export interface StoryTimeEntry {
  storyId: string;
  title: string;
  /** Días desde la creación hasta la finalización (null si no hay datos de auditoría) */
  leadTimeDays: number | null;
  /** Días desde que pasó a IN_PROGRESS hasta DONE (null si no hay datos de auditoría) */
  cycleTimeDays: number | null;
  /** Fecha ISO en que se completó la historia (null si no está DONE o sin auditoría) */
  completedAt: string | null;
}

/**
 * Reporte agregado de Lead Time y Cycle Time para un proyecto.
 */
export interface LeadCycleTimeReport {
  /** Promedio de días desde creación hasta entrega de todas las historias DONE */
  avgLeadTimeDays: number;
  /** Promedio de días desde inicio de desarrollo hasta entrega */
  avgCycleTimeDays: number;
  /** Desglose individual por historia */
  stories: StoryTimeEntry[];
}

/**
 * Servicio de cálculo de reportes ágiles.
 *
 * Calcula métricas a partir de datos de la BD y del audit log:
 * - Burndown: quema de puntos día a día durante el sprint.
 * - Velocidad: puntos completados vs planificados por sprint.
 * - Flujo acumulado: distribución de historias por estado en el tiempo.
 * - Lead/Cycle Time: eficiencia del flujo de entrega del equipo.
 * - Exportación CSV del backlog para informes externos.
 */
export class ReportsService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Calcula el reporte de burndown de un sprint.
   *
   * Genera un punto por día desde el inicio del sprint hasta hoy (o el fin
   * del sprint, si ya terminó). La línea ideal se calcula como una regresión
   * lineal perfecta desde totalPoints hasta 0.
   *
   * Limitación actual: la línea de puntos reales usa el estado actual de las
   * historias como aproximación (no el historial diario). Event Sourcing
   * mejoraría esta precisión en una versión futura.
   *
   * @param sprintId - ID del sprint a analizar
   * @returns Objeto con el sprint, los puntos de burndown y el total de puntos
   * @throws NotFoundError si el sprint no existe
   * @throws ValidationError si el sprint no tiene fechas definidas
   */
  async getBurndownReport(sprintId: string): Promise<{
    sprint: { id: string };
    points: BurndownPoint[];
    totalPoints: number;
  }> {
    const sprint = await this.db.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundError('Sprint');
    if (!sprint.startDate || !sprint.endDate) {
      throw new ValidationError('El sprint no tiene fechas definidas');
    }

    const stories = await this.db.userStory.findMany({ where: { sprintId } });
    const totalPoints = stories.reduce((sum, s) => sum + (s.points ?? 0), 0);

    // Calcular la duración del sprint en días para la línea ideal
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const today = new Date();

    const points: BurndownPoint[] = [];
    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(start);
      date.setDate(start.getDate() + day);
      // No generar puntos para días futuros (el burndown solo muestra lo ocurrido)
      if (date > today) break;

      const dateStr = date.toISOString().split('T')[0];
      // Línea ideal: quema lineal de totalPoints / totalDays puntos por día
      const idealPoints = totalPoints - (totalPoints / totalDays) * day;

      // Aproximación: usar el estado actual de DONE como punto de referencia
      // Solo el último día muestra la quema real acumulada; los días anteriores
      // mantienen totalPoints como línea plana hasta que Event Sourcing esté disponible
      const doneStories = stories.filter((s) => s.status === 'DONE');
      const completedPoints = doneStories.reduce((sum, s) => sum + (s.points ?? 0), 0);
      const remainingPoints = day === totalDays ? totalPoints - completedPoints : totalPoints;

      points.push({ date: dateStr, remainingPoints, idealPoints: Math.max(0, idealPoints) });
    }

    return { sprint: { id: sprint.id }, points, totalPoints };
  }

  /**
   * Calcula el reporte de velocidad del equipo para los últimos N sprints.
   *
   * Usa el campo `plannedPoints` capturado en el momento de cierre del sprint
   * para que el reporte sea históricamente preciso aunque después se muevan
   * historias entre sprints.
   *
   * Para sprints legacy (creados antes de que existiera el campo `plannedPoints`),
   * usa los puntos completados como estimación de los planificados.
   *
   * @param projectId  - ID del proyecto
   * @param lastSprints - Número de sprints completados a incluir (por defecto 6)
   * @returns Datos de velocidad por sprint y promedio histórico
   */
  async getVelocityReport(
    projectId: string,
    lastSprints = 6,
  ): Promise<{
    projectId: string;
    sprints: VelocityData[];
    averageVelocity: number;
  }> {
    // Solo considerar sprints COMPLETED; ordenar por fecha de fin descendente
    const sprints = await this.db.sprint.findMany({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { endDate: 'desc' },
      take: lastSprints,
    });

    const sprintsData: VelocityData[] = await Promise.all(
      sprints.map(async (sprint) => {
        // Usar los puntos planificados capturados al cerrar el sprint (más precisos)
        // Fallback para sprints legacy que se cerraron antes de este campo
        let plannedPoints = sprint.plannedPoints;
        const doneStories = await this.db.userStory.findMany({
          where: { sprintId: sprint.id, status: 'DONE' },
        });
        const completedPoints = doneStories.reduce((sum, s) => sum + (s.points ?? 0), 0);

        if (plannedPoints === 0 && completedPoints > 0) {
          // Sprint legacy: no hay datos de planificación, usar completados como aproximación
          plannedPoints = completedPoints;
        }

        return {
          sprintId: sprint.id,
          sprintName: sprint.name,
          completedPoints,
          plannedPoints,
        };
      }),
    );

    // Calcular promedio de velocidad como media de puntos completados por sprint
    const averageVelocity =
      sprintsData.length === 0
        ? 0
        : sprintsData.reduce((sum, s) => sum + s.completedPoints, 0) / sprintsData.length;

    // Invertir el orden para que el gráfico muestre los sprints de más antiguo a más reciente
    return { projectId, sprints: sprintsData.reverse(), averageVelocity };
  }

  /**
   * Calcula el diagrama de flujo acumulado (CFD) de un sprint.
   *
   * Reconstruye el estado de cada historia en cada día del sprint usando
   * el audit log de cambios de estado. Si no hay audit log disponible, usa
   * el estado actual de todas las historias como única aproximación.
   *
   * @param sprintId - ID del sprint a analizar
   * @returns Lista de puntos diarios con la distribución de historias por estado
   * @throws NotFoundError si el sprint no existe
   * @throws ValidationError si el sprint no tiene fecha de inicio
   */
  async getCumulativeFlow(sprintId: string): Promise<CumulativeFlowPoint[]> {
    const sprint = await this.db.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundError('Sprint');
    if (!sprint.startDate) throw new ValidationError('El sprint no tiene fecha de inicio');

    const stories = await this.db.userStory.findMany({ where: { sprintId } });
    const storyIds = stories.map((s) => s.id);

    // Obtener todos los cambios de estado de las historias del sprint desde el audit log
    const auditLogs = storyIds.length > 0
      ? await this.db.auditLog.findMany({
          where: {
            entityType: 'UserStory',
            entityId: { in: storyIds },
            field: 'status',
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const start = new Date(sprint.startDate);
    const end = sprint.endDate ? new Date(sprint.endDate) : new Date();
    const today = new Date();
    // El corte es el mínimo entre la fecha de fin del sprint y hoy
    const cutoff = end < today ? end : today;

    const points: CumulativeFlowPoint[] = [];

    for (
      let d = new Date(start);
      d <= cutoff;
      d.setDate(d.getDate() + 1)
    ) {
      // El rango del día es hasta las 23:59:59.999 para capturar todos los eventos del día
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dateStr = d.toISOString().split('T')[0];

      // Mapa de storyId → estado al final de este día
      const statusMap: Record<string, string> = {};

      if (auditLogs.length > 0) {
        // Inicializar todos con TODO (estado inicial implícito antes de cualquier cambio)
        stories.forEach((s) => {
          statusMap[s.id] = 'TODO';
        });

        // Aplicar todos los cambios de estado ocurridos hasta el final de este día
        auditLogs
          .filter((log) => log.createdAt <= dayEnd)
          .forEach((log) => {
            if (log.newValue) statusMap[log.entityId] = log.newValue;
          });
      } else {
        // Sin audit logs: usar el estado actual para todos los días (aproximación de un punto)
        stories.forEach((s) => {
          statusMap[s.id] = s.status;
        });
      }

      // Contar historias por estado al final del día
      const counts = { todo: 0, inProgress: 0, inReview: 0, done: 0, blocked: 0 };
      Object.values(statusMap).forEach((status) => {
        if (status === 'TODO') counts.todo++;
        else if (status === 'IN_PROGRESS') counts.inProgress++;
        else if (status === 'IN_REVIEW') counts.inReview++;
        else if (status === 'DONE') counts.done++;
        else if (status === 'BLOCKED') counts.blocked++;
      });

      points.push({ date: dateStr, ...counts });

      // Salir del bucle al procesar el día de hoy para evitar bucle infinito
      // cuando cutoff === today (d y cutoff apuntan al mismo objeto Date)
      if (dateStr === today.toISOString().split('T')[0]) break;
    }

    return points;
  }

  /**
   * Calcula el Lead Time y el Cycle Time de las historias completadas de un proyecto.
   *
   * Definiciones:
   * - Lead Time: tiempo total desde la creación de la historia hasta su finalización.
   * - Cycle Time: tiempo desde que la historia pasa a IN_PROGRESS hasta DONE.
   *
   * Ambas métricas se calculan a partir del audit log. Si una historia no tiene
   * logs de estado, los valores son null.
   *
   * @param projectId - ID del proyecto a analizar
   * @returns Promedios y detalle por historia de Lead Time y Cycle Time
   */
  async getLeadCycleTime(projectId: string): Promise<LeadCycleTimeReport> {
    const doneStories = await this.db.userStory.findMany({
      where: { projectId, status: 'DONE' },
    });

    if (doneStories.length === 0) {
      return { avgLeadTimeDays: 0, avgCycleTimeDays: 0, stories: [] };
    }

    const storyIds = doneStories.map((s) => s.id);

    // Solo obtener los logs relevantes: cambios a DONE e IN_PROGRESS
    const auditLogs = await this.db.auditLog.findMany({
      where: {
        entityType: 'UserStory',
        entityId: { in: storyIds },
        field: 'status',
        newValue: { in: ['DONE', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const entries: StoryTimeEntry[] = doneStories.map((story) => {
      const storyLogs = auditLogs.filter((l) => l.entityId === story.id);

      const doneLogs = storyLogs.filter((l) => l.newValue === 'DONE');
      const inProgressLogs = storyLogs.filter((l) => l.newValue === 'IN_PROGRESS');

      // Usar el último log DONE (la historia pudo reabrirse y volverse a completar)
      const completedAt = doneLogs.length > 0 ? doneLogs[doneLogs.length - 1].createdAt : null;
      // Usar el primer log IN_PROGRESS (inicio del trabajo activo)
      const cycleStart = inProgressLogs.length > 0 ? inProgressLogs[0].createdAt : null;

      // Lead Time = tiempo total desde la creación hasta la finalización
      const leadTimeDays =
        completedAt != null
          ? (completedAt.getTime() - story.createdAt.getTime()) / MS_PER_DAY
          : null;

      // Cycle Time = tiempo activo de desarrollo (desde IN_PROGRESS hasta DONE)
      const cycleTimeDays =
        completedAt != null && cycleStart != null
          ? (completedAt.getTime() - cycleStart.getTime()) / MS_PER_DAY
          : null;

      return {
        storyId: story.id,
        title: story.title,
        leadTimeDays,
        cycleTimeDays,
        completedAt: completedAt ? completedAt.toISOString() : null,
      };
    });

    // Calcular promedios excluyendo los valores null (historias sin datos de auditoría)
    const leadValues = entries.map((e) => e.leadTimeDays).filter((v): v is number => v !== null);
    const cycleValues = entries.map((e) => e.cycleTimeDays).filter((v): v is number => v !== null);

    const avgLeadTimeDays = leadValues.length > 0
      ? leadValues.reduce((a, b) => a + b, 0) / leadValues.length
      : 0;
    const avgCycleTimeDays = cycleValues.length > 0
      ? cycleValues.reduce((a, b) => a + b, 0) / cycleValues.length
      : 0;

    return { avgLeadTimeDays, avgCycleTimeDays, stories: entries };
  }

  /**
   * Exporta el backlog completo de un proyecto como string CSV.
   *
   * El CSV incluye todas las historias del proyecto (incluidas las del sprint)
   * ordenadas por fecha de creación. Los valores con comas, comillas o saltos
   * de línea se escapan según el estándar RFC 4180.
   *
   * @param projectId - ID del proyecto a exportar
   * @returns String CSV con cabecera y una fila por historia
   */
  async exportBacklogCsv(projectId: string): Promise<string> {
    const stories = await this.db.userStory.findMany({
      where: { projectId },
      include: {
        epic: true,
        sprint: true,
        assignee: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    /**
     * Escapa un valor para CSV según RFC 4180:
     * - Si contiene comas, comillas o saltos de línea, lo envuelve en comillas.
     * - Las comillas internas se duplican para escaparlas.
     */
    const escape = (value: string | null | undefined): string => {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = 'id,title,status,priority,points,epicTitle,sprintName,assigneeName,createdAt';
    const rows = stories.map((s) =>
      [
        escape(s.id),
        escape(s.title),
        escape(s.status),
        escape(s.priority),
        escape(s.points != null ? String(s.points) : ''),
        escape(s.epic?.title),
        escape(s.sprint?.name),
        // Usar el nombre si está disponible; fallback al email
        escape(s.assignee ? s.assignee.name || s.assignee.email : ''),
        escape(s.createdAt.toISOString()),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
