import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageLockEnqueueInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_message_lock_enqueue(
                p_message_id UUID
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
                    ${valueNode(JobType.MESSAGE_LOCK)},
                    ${valueNode(false)},
                    v_now
                ) RETURNING id
                INTO v_job;

                INSERT INTO ${params.schema}.job_message_lock_params (
                    job_id,
                    message_id
                ) VALUES (
                    v_job.id,
                    p_message_id
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

