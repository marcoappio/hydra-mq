import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobJobMessageCreateScheduleSetInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.job_job_message_create_schedule_set(
            p_name TEXT,
            p_message_name TEXT,
            p_message_channel_name TEXT,
            p_message_payload TEXT,
            p_message_priority INTEGER,
            p_message_channel_priority INTEGER,
            p_message_num_attempts INTEGER,
            p_message_max_processing_ms INTEGER,
            p_message_lock_ms INTEGER,
            p_message_lock_ms_factor REAL,
            p_message_delay_ms INTEGER,
            p_message_delete_ms INTEGER,
            p_cron_expr_mins INTEGER[],
            p_cron_expr_hours INTEGER[],
            p_cron_expr_days INTEGER[],
            p_cron_expr_months INTEGER[],
            p_cron_expr_days_of_week INTEGER[]
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP;
            v_params JSONB;
        BEGIN
            v_now := NOW();
            v_params := JSONB_BUILD_OBJECT(
                'name', p_name,
                'message_name', p_message_name,
                'message_channel_name', p_message_channel_name,
                'message_payload', p_message_payload,
                'message_priority', p_message_priority,
                'message_channel_priority', p_message_channel_priority,
                'message_num_attempts', p_message_num_attempts,
                'message_max_processing_ms', p_message_max_processing_ms,
                'message_lock_ms', p_message_lock_ms,
                'message_lock_ms_factor', p_message_lock_ms_factor,
                'message_delay_ms', p_message_delay_ms,
                'message_delete_ms', p_message_delete_ms,
                'cron_expr_mins', p_cron_expr_mins,
                'cron_expr_hours', p_cron_expr_hours,
                'cron_expr_days', p_cron_expr_days,
                'cron_expr_months', p_cron_expr_months,
                'cron_expr_days_of_week', p_cron_expr_days_of_week
            );

            INSERT INTO ${params.schema}.job (
                name,
                type, 
                params,
                is_recurring,
                process_after
            ) VALUES (
                p_name,
                ${valueNode(JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET)},
                v_params,
                ${valueNode(false)},
                v_now
            );
        END;
        $$ LANGUAGE plpgsql;
    `,
]
