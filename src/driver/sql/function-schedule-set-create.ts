import { type SqlRefNode, sql } from '@src/core/sql'

export const functionScheduleSetCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE FUNCTION ${params.schema}.schedule_set(
            p_schedule_id TEXT,
            p_queue_id TEXT,
            p_payload TEXT,
            p_priority INTEGER,
            p_timeout_secs INTEGER,
            p_stale_secs INTEGER,
            p_num_attempts INTEGER,
            p_deduplication_id TEXT,
            p_cron_expr_mins INTEGER[],
            p_cron_expr_hours INTEGER[],
            p_cron_expr_days INTEGER[],
            p_cron_expr_months INTEGER[],
            p_cron_expr_days_of_week INTEGER[]
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
        BEGIN
            INSERT INTO ${params.schema}.schedule (
                id,
                queue_id,
                payload,
                priority,
                timeout_secs,
                stale_secs,
                num_attempts,
                deduplication_id,
                cron_last_mins,
                cron_expr_mins,
                cron_expr_hours,
                cron_expr_days,
                cron_expr_months,
                cron_expr_days_of_week,
                created_at,
                updated_at
            ) VALUES (
                p_schedule_id,
                p_queue_id,
                p_payload,
                p_priority,
                p_timeout_secs,
                p_stale_secs,
                p_num_attempts,
                p_deduplication_id,
                0,
                p_cron_expr_mins,
                p_cron_expr_hours,
                p_cron_expr_days,
                p_cron_expr_months,
                p_cron_expr_days_of_week,
                v_now,
                v_now
            ) ON CONFLICT (id, queue_id) DO UPDATE SET
                payload = p_payload,
                priority = p_priority,
                timeout_secs = p_timeout_secs,
                stale_secs = p_stale_secs,
                num_attempts = p_num_attempts,
                deduplication_id = p_deduplication_id,
                cron_expr_mins = p_cron_expr_mins,
                cron_expr_hours = p_cron_expr_hours,
                cron_expr_days = p_cron_expr_days,
                cron_expr_months = p_cron_expr_months,
                cron_expr_days_of_week = p_cron_expr_days_of_week,
                updated_at = v_now;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
