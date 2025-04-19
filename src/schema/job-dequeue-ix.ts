import { sql, type SqlRefNode } from "@src/core/sql"

export const jobDequeueIxInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE INDEX job_dequeue_ix
            ON ${params.schema}.job (process_after ASC)
        `
    ]
}
