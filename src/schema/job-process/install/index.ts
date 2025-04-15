import { rawNode, refNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { jobProcessQueryJob } from "@src/schema/job-process/install/query/job"
import { JobType } from "@src/schema/job"
import { CronNextResultCode } from "@src/schema/cron-next/install"
import { jobProcessMessageReleaseInstall } from "@src/schema/job-process/install/private/message-release"
import { jobProcessMessageUnlockInstall } from "@src/schema/job-process/install/private/message-unlock"
import { jobProcessMessageEnqueueInstall } from "@src/schema/job-process/install/private/message-enqueue"
import { jobProcessMessageDependencyResolveInstall } from "@src/schema/job-process/install/private/message-dependency-resolve"
import { jobProcessMessageLockInstall } from "@src/schema/job-process/install/private/message-lock"

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
        jobProcessMessageReleaseInstall(params),
        jobProcessMessageUnlockInstall(params),
        jobProcessMessageLockInstall(params),
        jobProcessMessageEnqueueInstall(params),
        jobProcessMessageDependencyResolveInstall(params),

        sql `
            CREATE FUNCTION ${params.schema}.job_process() 
            RETURNS TABLE (
                o_result_code INTEGER,
                o_id UUID,
                o_type TEXT,
                o_name TEXT
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
                        ${valueNode(null)}::TEXT,
                        ${valueNode(null)}::TEXT
                    RETURN;
                END IF;

                IF v_job.type = ${valueNode(JobType.MESSAGES_SWEEP)} THEN
                    PERFORM ${params.schema}.messages_sweep();
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_RELEASE)} THEN
                    PERFORM ${params.schema}.job_process_message_release(v_job.id);
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_UNLOCK)} THEN
                    PERFORM ${params.schema}.job_process_message_unlock(v_job.id);
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_ENQUEUE)} THEN
                    PERFORM ${params.schema}.job_process_message_enqueue(v_job.id);
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_LOCK)} THEN
                    PERFORM ${params.schema}.job_process_message_lock(v_job.id);
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)} THEN
                    PERFORM ${params.schema}.job_process_message_dependency_resolve(v_job.id);
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

                RETURN QUERY SELECT
                    ${valueNode(JobProcessResultCode.JOB_PROCESSED)}, 
                    v_job.id, 
                    v_job.type, 
                    v_job.name;
            END;
            $$ LANGUAGE plpgsql;

        `

    ]
}
