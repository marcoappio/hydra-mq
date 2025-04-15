import { sql, type SqlRefNode } from "@src/core/sql"

export const jobProcessMessageReleaseInstall = (params : {
    schema: SqlRefNode
}) => {
    return sql `
        CREATE FUNCTION ${params.schema}.job_process_message_release(
            p_id UUID
        ) RETURNS VOID AS $$
        DECLARE
            v_params RECORD;
        BEGIN
            SELECT message_id
            FROM ${params.schema}.job_message_release_params
            WHERE job_id = p_id
            INTO v_params;

            PERFORM ${params.schema}.message_release(v_params.message_id);
        END;
        $$ LANGUAGE plpgsql;
    `
}
