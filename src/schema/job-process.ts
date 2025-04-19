import { escapeRefNode, rawNode, refNode, sql, valueNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export enum JobProcessResultCode {
    JOB_PROCESSED,
    QUEUE_EMPTY
}

const jobFetch = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    threshold: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.job
        WHERE process_after <= ${params.threshold}
        ORDER BY process_after ASC
        LIMIT ${params.limit}
    `
}


export const jobProcessInstall = (params : {
    schema: SqlRefNode
}) => {
    const jobQuery = jobFetch({
        limit: valueNode("1"),
        schema: params.schema,
        threshold: refNode("v_now"),
        select: [
            refNode("id"),
            refNode("type"),
            refNode("params"),
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
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_next TIMESTAMP;
                v_job RECORD;
                v_message_id UUID;
            BEGIN
                v_now := NOW();

                ${rawNode(jobQuery)}
                FOR UPDATE SKIP LOCKED
                INTO v_job;

                IF v_job IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.QUEUE_EMPTY)}
                    );
                END IF;

                v_next := NULL;
                IF v_job.is_recurring THEN
                    v_next := ${params.schema}.cron_next(
                        v_job.cron_expr_mins,
                        v_job.cron_expr_hours,
                        v_job.cron_expr_days,
                        v_job.cron_expr_months,
                        v_job.cron_expr_days_of_week,
                        v_now
                    );
                END IF;

                IF v_next IS NOT NULL THEN
                    UPDATE ${params.schema}.job SET
                        process_after = v_next
                    WHERE id = v_job.id;
                ELSE
                    DELETE FROM ${params.schema}.job
                    WHERE id = v_job.id;
                END IF;

                IF v_job.type = ${valueNode(JobType.MESSAGE_SWEEP_MANY)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'result', ${params.schema}.message_sweep_many()
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_RELEASE)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_release(v_message_id)
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_UNLOCK)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_unlock(v_message_id)
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_FINALIZE)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_finalize(v_message_id)
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_FAIL)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_fail(v_message_id, FALSE)
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_dependency_resolve(
                            v_message_id,
                            v_job.params->'is_success'
                        )
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_ENQUEUE)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'result', ${params.schema}.message_enqueue(
                            v_job.params->'name',
                            v_job.params->'channel_name',
                            v_job.params->'payload',
                            v_job.params->'priority',
                            v_job.params->'channel_priority',
                            v_job.params->'num_attempts',
                            v_job.params->'lock_ms',
                            v_job.params->'lock_ms_factor',
                            v_job.params->'p_delay_ms',
                            ARRAY[]::UUID[],
                            TRUE
                        )
                    );
                ELSE
                    RAISE EXCEPTION 'Unknown job type: %', v_job.type;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `
    ]
}
