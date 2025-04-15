import { sql, type SqlRefNode } from "@src/core/sql"

export const jobProcessMessageDependencyResolveInstall = (params : {
    schema: SqlRefNode
}) => {
    return sql `
        CREATE FUNCTION ${params.schema}.job_process_message_dependency_resolve(
            p_id UUID
        ) RETURNS VOID AS $$
        DECLARE
            v_params RECORD;
        BEGIN
            SELECT message_id, is_success
            FROM ${params.schema}.job_message_dependency_resolve_params
            WHERE job_id = p_id
            INTO v_params;

            PERFORM ${params.schema}.message_dependency_resolve(
                v_params.message_id,
                v_params.is_success
            );
        END;
        $$ LANGUAGE plpgsql;
    `
}

