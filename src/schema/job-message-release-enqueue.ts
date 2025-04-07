import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageReleaseEnqueueInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_message_release_enqueue(
                p_message_id UUID,
                p_process_after TIMESTAMP
            ) RETURNS VOID AS $$
            DECLARE
                v_job RECORD;
            BEGIN
                INSERT INTO ${params.schema}.job (
                    type,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.MESSAGE_RELEASE)},
                    ${valueNode(false)},
                    p_process_after
                ) RETURNING id
                INTO v_job;

                INSERT INTO ${params.schema}.job_message_release_params (
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

