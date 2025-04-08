import { type SqlRefNode, sql } from "@src/core/sql"

export const jobMessageEnqueueParamsInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.job_message_enqueue_params (
            id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
            job_id UUID NOT NULL,
            name TEXT NULL,
            channel_name TEXT NULL,
            payload TEXT NOT NULL,
            priority INTEGER NULL,
            channel_priority INTEGER NULL,
            num_attempts INTEGER NOT NULL,
            max_processing_secs REAL NOT NULL,
            lock_secs REAL NOT NULL,
            lock_secs_factor REAL NOT NULL,
            delay_secs REAL NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY (job_id) 
                REFERENCES ${params.schema}.job (id)
                ON DELETE CASCADE
        );
    `,

    sql `
        CREATE UNIQUE INDEX job_message_enqueue_params_lookup_ix
        ON ${params.schema}.job_message_enqueue_params (job_id);
    `

]

