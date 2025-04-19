import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageEnqueueScheduleSetInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.job_message_enqueue_schedule_set(
            p_name TEXT,
            p_message_name TEXT,
            p_message_channel_name TEXT,
            p_message_payload TEXT,
            p_message_priority INTEGER,
            p_message_channel_priority INTEGER,
            p_message_num_attempts INTEGER,
            p_message_max_processing_ms REAL,
            p_message_lock_ms REAL,
            p_message_lock_ms_factor REAL,
            p_message_delay_ms REAL,
            p_cron_expr_mins INTEGER[],
            p_cron_expr_hours INTEGER[],
            p_cron_expr_days INTEGER[],
            p_cron_expr_months INTEGER[],
            p_cron_expr_days_of_week INTEGER[]
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP;
            v_next RECORD;
            v_params JSONB;
        BEGIN
            v_now := NOW();
            v_next := ${params.schema}.cron_next(
                p_cron_expr_mins,
                p_cron_expr_hours,
                p_cron_expr_days,
                p_cron_expr_months,
                p_cron_expr_days_of_week,
                v_now
            );

            IF v_next IS NULL THEN
                RETURN;
            END IF;

            v_params := JSONB_BUILD_OBJECT(
                'name', p_message_name,
                'channel_name', p_message_channel_name,
                'payload', p_message_payload,
                'priority', p_message_priority,
                'channel_priority', p_message_channel_priority,
                'num_attempts', p_message_num_attempts,
                'max_processing_ms', p_message_max_processing_ms,
                'lock_ms', p_message_lock_ms,
                'lock_ms_factor', p_message_lock_ms_factor,
                'delay_ms', p_message_delay_ms
            );

            INSERT INTO ${params.schema}.job (
                name,
                type, 
                params,
                is_recurring,
                cron_expr_mins,
                cron_expr_hours,
                cron_expr_days,
                cron_expr_months,
                cron_expr_days_of_week,
                process_after
            ) VALUES (
                p_name,
                ${valueNode(JobType.MESSAGE_ENQUEUE)},
                v_params,
                ${valueNode(true)},
                p_cron_expr_mins,
                p_cron_expr_hours,
                p_cron_expr_days,
                p_cron_expr_months,
                p_cron_expr_days_of_week,
                v_next.o_timestamp
            ) ON CONFLICT (type, name) 
            WHERE name IS NOT NULL
            DO UPDATE SET
                is_recurring = ${valueNode(true)},
                params = v_params,
                cron_expr_mins = p_cron_expr_mins,
                cron_expr_hours = p_cron_expr_hours,
                cron_expr_days = p_cron_expr_days,
                cron_expr_months = p_cron_expr_months,
                cron_expr_days_of_week = p_cron_expr_days_of_week;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
