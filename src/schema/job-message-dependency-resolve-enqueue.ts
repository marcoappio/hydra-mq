import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageDependencyResolveEnqueueInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_message_dependency_resolve_enqueue(
                p_message_id UUID,
                p_is_success BOOLEAN
            ) RETURNS VOID AS $$
            DECLARE
                v_now TIMESTAMP;
                v_job RECORD;
            BEGIN
                v_now := NOW();
                INSERT INTO ${params.schema}.job (
                    type,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.MESSAGE_DEPENDENCY_RESOLVE)},
                    ${valueNode(false)},
                    v_now
                ) RETURNING id
                INTO v_job;

                INSERT INTO ${params.schema}.job_message_dependency_resolve_params (
                    job_id,
                    message_id,
                    is_success
                ) VALUES (
                    v_job.id,
                    p_message_id,
                    p_is_success
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

