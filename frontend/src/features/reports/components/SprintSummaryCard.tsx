import { useTranslation } from 'react-i18next';
import { formatDate, getDaysRemaining } from '@/utils/date.utils';
import type { Sprint } from '@/types/api.types';
import styles from './SprintSummaryCard.module.scss';

/**
 * Props del componente SprintSummaryCard.
 */
interface SprintSummaryCardProps {
  /** Sprint activo cuyos datos se mostrarán en la tarjeta. */
  sprint: Sprint;
}

/**
 * SprintSummaryCard
 *
 * Tarjeta informativa que muestra el resumen del sprint activo en la cabecera
 * de la vista de reportes. Incluye:
 * - Nombre y objetivo del sprint.
 * - Etiqueta de días restantes / hoy / vencido con código de color semántico.
 * - Rango de fechas (inicio → fin).
 * - Barra de progreso accesible (role="progressbar" con aria-valuenow).
 * - Estadísticas: historias completadas / total y puntos completados / total.
 *
 * @param sprint - Sprint activo con sus estadísticas precalculadas.
 */
export function SprintSummaryCard({ sprint }: SprintSummaryCardProps) {
  const { t } = useTranslation();
  const { stats } = sprint;

  // getDaysRemaining devuelve null si endDate no está definida,
  // positivo si quedan días, 0 si termina hoy, negativo si ya venció
  const daysLeft = getDaysRemaining(sprint.endDate);

  /**
   * Renderiza la etiqueta de estado temporal del sprint con estilo semántico:
   * - Verde (daysOk): quedan días.
   * - Amarillo (daysWarn): termina hoy.
   * - Rojo (daysDanger): sprint vencido.
   * Devuelve null si no hay fecha de fin configurada.
   */
  function renderDaysLabel(): React.ReactNode {
    if (daysLeft === null) return null;
    if (daysLeft > 0) {
      return <span className={styles.daysOk}>{t('reports.daysLeft', { count: daysLeft })}</span>;
    }
    if (daysLeft === 0) {
      return <span className={styles.daysWarn}>{t('reports.endsToday')}</span>;
    }
    // daysLeft < 0: sprint ya terminó; mostramos cuántos días lleva vencido
    return <span className={styles.daysDanger}>{t('reports.daysOverdue', { count: Math.abs(daysLeft) })}</span>;
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.name}>{sprint.name}</h2>
          {sprint.goal && <p className={styles.goal}>{sprint.goal}</p>}
        </div>
        {renderDaysLabel()}
      </div>

      <div className={styles.dates}>
        <span>{formatDate(sprint.startDate)}</span>
        <span className={styles.dateSep}>→</span>
        <span>{formatDate(sprint.endDate)}</span>
      </div>

      {/* Barra de progreso */}
      <div className={styles.progressBar} role="progressbar" aria-valuenow={stats.progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={styles.progressFill}
          style={{ width: `${stats.progressPercent}%` }}
        />
      </div>
      <span className={styles.progressLabel}>{stats.progressPercent}{t('reports.pctCompleted')}</span>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.completedStories}</span>
          <span className={styles.statLabel}>{t('reports.storiesProgress', { total: stats.totalStories })}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.completedPoints}</span>
          <span className={styles.statLabel}>/ {stats.totalPoints} pts</span>
        </div>
      </div>
    </section>
  );
}
