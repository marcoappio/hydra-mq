import { rawNode, refNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { jobProcessQueryJob } from "@src/schema/job-process/install/query/job"
import { JobType } from "@src/schema/job"
import { CronNextResultCode } from "@src/schema/cron-next/install"

export enum JobProcessResultCode {
    JOB_PROCESSED,
    QUEUE_EMPTY
}

export const jobProcessInstall = (params : {
    schema: SqlRefNode
}) => {
    const jobQuery = jobProcessQueryJob({
        limit: valueNode("1"),
        schema: params.schema,
        threshold: refNode("v_now"),
        select: [
            refNode("id"),
            refNode("type"),
            refNode("name"),
            refNode("is_recurring"),
            refNode("cron_expr_mins"),
            refNode("cron_expr_hours"),
            refNode("cron_expr_days"),
            refNode("cron_expr_months"),
            refNode("cron_expr_days_of_week"),
        ],
    })
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_process() 
            RETURNS TABLE (
                o_result_code INTEGER,
                o_id UUID,
                o_type INTEGER,
                o_name TEXT,
                o_job_result_code INTEGER,
                o_job_message_id UUID
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_cron_next RECORD;
                v_job RECORD;
                v_params RECORD;
            BEGIN
                v_now := NOW();

                ${rawNode(jobQuery)}
                FOR UPDATE SKIP LOCKED
                INTO v_job;

                IF v_job IS NULL THEN
                    RETURN QUERY SELECT
                        ${valueNode(JobProcessResultCode.QUEUE_EMPTY)},
                        ${valueNode(null)}::UUID,
                        ${valueNode(null)}::INTEGER,
                        ${valueNode(null)}::TEXT,
                        ${valueNode(null)}::INTEGER,
                        ${valueNode(null)}::UUID;
                    RETURN;
                END IF;

                IF v_job.type = ${valueNode(JobType.MESSAGE_RELEASE)} THEN
                    SELECT *
                    FROM ${params.schema}.job_message_release_params
                    WHERE job_id = v_job.id
                    INTO v_params;
    
                    RETURN QUERY SELECT 
                        ${valueNode(JobProcessResultCode.JOB_PROCESSED)}, 
                        v_job.id, 
                        v_job.type, 
                        v_job.name, 
                        v_result.o_result_code,
                        v_params.message_id
                    FROM ${params.schema}.message_release(v_params.message_id) AS v_result;
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_UNLOCK)} THEN
                    SELECT message_id
                    FROM ${params.schema}.job_message_unlock_params
                    WHERE job_id = v_job.id
                    INTO v_params;

                    RETURN QUERY SELECT 
                        ${valueNode(JobProcessResultCode.JOB_PROCESSED)}, 
                        v_job.id, 
                        v_job.type, 
                        v_job.name, 
                        v_result.o_result_code,
                        v_params.message_id
                    FROM ${params.schema}.message_unlock(v_params.message_id) AS v_result;
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_ENQUEUE)} THEN
                    SELECT
                        name,
                        channel_name,
                        payload,
                        priority,
                        channel_priority,
                        num_attempts,
                        max_processing_secs,
                        lock_secs,
                        lock_secs_factor,
                        delay_secs
                    FROM ${params.schema}.job_message_enqueue_params
                    WHERE job_id = v_job.id
                    INTO v_params;

                    RETURN QUERY SELECT 
                        ${valueNode(JobProcessResultCode.JOB_PROCESSED)}, 
                        v_job.id, 
                        v_job.type, 
                        v_job.name, 
                        v_result.o_result_code, 
                        v_result.o_id
                    FROM ${params.schema}.message_enqueue(
                        v_params.name,
                        COALESCE(v_params.channel_name, GEN_RANDOM_UUID()::TEXT),
                        v_params.payload,
                        v_params.priority,
                        v_params.channel_priority,
                        v_params.num_attempts,
                        v_params.max_processing_secs,
                        v_params.lock_secs,
                        v_params.lock_secs_factor,
                        v_params.delay_secs,
                        ARRAY[]::UUID[],
                        ${valueNode(false)}
                    ) AS v_result;
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)} THEN
                    SELECT message_id, is_success
                    FROM ${params.schema}.job_message_dependency_resolve_params
                    WHERE job_id = v_job.id
                    INTO v_params;

                    RETURN QUERY SELECT 
                        ${valueNode(JobProcessResultCode.JOB_PROCESSED)}, 
                        v_job.id, 
                        v_job.type, 
                        v_job.name, 
                        v_result.o_result_code,
                        v_params.message_id
                    FROM ${params.schema}.message_dependency_resolve(
                        v_params.message_id,
                        v_params.is_success
                    ) AS v_result;
                END IF;

                IF v_job.is_recurring THEN
                    SELECT cron.o_result_code, cron.o_timestamp
                    FROM ${params.schema}.cron_next(
                        v_job.cron_expr_mins,
                        v_job.cron_expr_hours,
                        v_job.cron_expr_days,
                        v_job.cron_expr_months,
                        v_job.cron_expr_days_of_week,
                        v_now
                    ) AS cron INTO v_cron_next;

                    IF v_cron_next.o_result_code = ${valueNode(CronNextResultCode.TIMESTAMP_FOUND)} THEN
                        UPDATE ${params.schema}.job SET
                            process_after = v_cron_next.o_timestamp
                        WHERE id = v_job.id;
                    END IF;
                ELSE
                    DELETE FROM ${params.schema}.job
                    WHERE id = v_job.id;
                END IF;
            END;
            $$ LANGUAGE plpgsql;

        `

    ]
}
