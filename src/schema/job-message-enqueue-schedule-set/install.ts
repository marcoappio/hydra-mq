import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { CronNextResultCode } from "@src/schema/cron-next/install"
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
            p_message_num_attempts INTEGER,
            p_message_max_processing_secs REAL,
            p_message_lock_secs REAL,
            p_message_lock_secs_factor REAL,
            p_message_delay_secs REAL,
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
            v_job RECORD;
        BEGIN
            v_now := NOW();

            SELECT o_result_code, o_timestamp
            FROM ${params.schema}.cron_next(
                p_cron_expr_mins,
                p_cron_expr_hours,
                p_cron_expr_days,
                p_cron_expr_months,
                p_cron_expr_days_of_week,
                v_now
            ) INTO v_next;

            IF v_next.o_result_code = ${valueNode(CronNextResultCode.TIMESTAMP_NOT_FOUND)} THEN
                RETURN;
            END IF;

            INSERT INTO ${params.schema}.job (
                name,
                type, 
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
                cron_expr_mins = p_cron_expr_mins,
                cron_expr_hours = p_cron_expr_hours,
                cron_expr_days = p_cron_expr_days,
                cron_expr_months = p_cron_expr_months,
                cron_expr_days_of_week = p_cron_expr_days_of_week
            RETURNING id
            INTO v_job;

            INSERT INTO ${params.schema}.job_message_enqueue_params (
                job_id,
                name,
                channel_name,
                payload,
                priority,
                num_attempts,
                max_processing_secs,
                lock_secs,
                lock_secs_factor,
                delay_secs
            ) VALUES (
                v_job.id,
                p_message_name,
                p_message_channel_name,
                p_message_payload,
                p_message_priority,
                p_message_num_attempts,
                p_message_max_processing_secs,
                p_message_lock_secs,
                p_message_lock_secs_factor,
                p_message_delay_secs
            ) ON CONFLICT (job_id) DO UPDATE SET
                name = p_message_name,
                channel_name = p_message_channel_name,
                payload = p_message_payload,
                priority = p_message_priority,
                num_attempts = p_message_num_attempts,
                max_processing_secs = p_message_max_processing_secs,
                lock_secs = p_message_lock_secs,
                lock_secs_factor = p_message_lock_secs_factor,
                delay_secs = p_message_delay_secs;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
