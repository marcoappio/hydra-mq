import { sql, type SqlRefNode } from "@src/core/sql"

export const jobProcessMessageUnlockInstall = (params : {
    schema: SqlRefNode
}) => {
    return sql `
        CREATE FUNCTION ${params.schema}.job_process_message_unlock(
            p_id UUID
        ) RETURNS VOID AS $$
        DECLARE
            v_params RECORD;
        BEGIN
            SELECT message_id
            FROM ${params.schema}.job_message_unlock_params
            WHERE job_id = p_id
            INTO v_params;

            PERFORM ${params.schema}.message_unlock(v_params.message_id);
        END;
        $$ LANGUAGE plpgsql;
    `
}
