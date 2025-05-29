import { escapeRefNode, rawNode, refNode, sql, valueNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

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
                v_job_name TEXT;
                v_channel_name TEXT;
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

                IF v_job.type = ${valueNode(JobType.JOB_MESSAGE_CREATE_SCHEDULE_SET)} THEN
                    v_job_name := v_job.params->>'name';
                    PERFORM ${params.schema}.job_message_create_schedule_set(
                        v_job_name,
                        v_job.params->>'message_name',
                        v_job.params->>'message_channel_name',
                        v_job.params->>'message_payload',
                        (v_job.params->>'message_priority')::INTEGER,
                        (v_job.params->>'message_channel_priority')::INTEGER,
                        (v_job.params->>'message_max_processing_ms')::INTEGER,
                        (SELECT ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(v_job.params->'cron_expr_mins'))::INTEGER[]),
                        (SELECT ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(v_job.params->'cron_expr_hours'))::INTEGER[]),
                        (SELECT ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(v_job.params->'cron_expr_days'))::INTEGER[]),
                        (SELECT ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(v_job.params->'cron_expr_months'))::INTEGER[]),
                        (SELECT ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(v_job.params->'cron_expr_days_of_week'))::INTEGER[])
                    );

                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'job_name', v_job_name
                    );
                ELSIF v_job.type = ${valueNode(JobType.JOB_MESSAGE_CREATE_SCHEDULE_CLEAR)} THEN
                    v_job_name := v_job.params->>'name';
                    PERFORM ${params.schema}.job_message_create_schedule_clear(v_job_name);

                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'job_name', v_job_name
                    );
                ELSIF v_job.type = ${valueNode(JobType.CHANNEL_POLICY_CLEAR)} THEN
                    v_channel_name := v_job.params->>'name';
                    PERFORM ${params.schema}.channel_policy_clear(v_channel_name);
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'channel_name', v_channel_name
                    );
                ELSIF v_job.type = ${valueNode(JobType.CHANNEL_POLICY_SET)} THEN
                    v_channel_name := v_job.params->>'name';
                    PERFORM ${params.schema}.channel_policy_set(
                        v_channel_name,
                        (v_job.params->>'max_concurrency')::INTEGER
                    );
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'channel_name', v_channel_name
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_SWEEP_MANY)} THEN
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
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_RETRY)} THEN
                    v_message_id := (v_job.params->>'id')::UUID;
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'message_id', v_message_id,
                        'result', ${params.schema}.message_retry(v_message_id, 0)
                    );
                ELSIF v_job.type = ${valueNode(JobType.MESSAGE_CREATE)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(JobProcessResultCode.JOB_PROCESSED)},
                        'id', v_job.id,
                        'type', v_job.type,
                        'name', v_job.name,
                        'result', ${params.schema}.message_create(
                            v_job.params->>'name',
                            v_job.params->>'channel_name',
                            v_job.params->>'payload',
                            (v_job.params->>'priority')::INTEGER,
                            (v_job.params->>'channel_priority')::INTEGER,
                            (v_job.params->>'max_processing_ms')::INTEGER,
                            0
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
