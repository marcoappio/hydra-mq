import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/job"

export const jobMessageFinalizeEnqueueInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_message_finalize_enqueue(
                p_id UUID
            ) RETURNS VOID AS $$
            DECLARE
                v_now TIMESTAMP;
                v_params JSONB;
            BEGIN
                v_now := NOW();
                v_params := JSONB_BUILD_OBJECT('id', p_id);
                INSERT INTO ${params.schema}.job (
                    type,
                    params,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.MESSAGE_FINALIZE)},
                    v_params,
                    ${valueNode(false)},
                    v_now
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

