import { sql, type SqlRefNode } from "@src/core/sql"

export const jobMessageDependencyResolveParamsInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE TABLE ${params.schema}.job_message_dependency_resolve_params (
                id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
                job_id UUID NOT NULL,
                message_id UUID NOT NULL,
                is_success BOOLEAN NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (job_id) 
                    REFERENCES ${params.schema}.job (id)
                    ON DELETE CASCADE
            );
        `,

        sql `
            CREATE UNIQUE INDEX job_message_dependency_resolve_params_lookup_ix 
            ON ${params.schema}.job_message_dependency_resolve_params (job_id);
        `
    ]
}


