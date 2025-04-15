import { sql, type SqlRefNode } from "@src/core/sql"

export const jobMessageLockParamsInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE TABLE ${params.schema}.job_message_lock_params (
                id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
                job_id UUID NOT NULL,
                message_id UUID NOT NULL,
                PRIMARY KEY (id),
                FOREIGN KEY (job_id) 
                    REFERENCES ${params.schema}.job (id)
                    ON DELETE CASCADE
            );
        `,

        sql `
            CREATE UNIQUE INDEX job_message_lock_params_lookup_ix 
            ON ${params.schema}.job_message_lock_params (job_id);
        `
    ]
}
