import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobMessageUnlockInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_message_unlock(
                p_message_id UUID,
                p_process_after TIMESTAMP
            ) RETURNS VOID AS $$
            DECLARE
                v_params JSONB;
            BEGIN
                v_params := JSONB_BUILD_OBJECT('id', p_message_id);
                INSERT INTO ${params.schema}.job (
                    type,
                    params,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.MESSAGE_UNLOCK)},
                    v_params,
                    ${valueNode(false)},
                    p_process_after
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

