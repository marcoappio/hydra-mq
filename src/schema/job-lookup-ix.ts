import { sql, type SqlRefNode } from "@src/core/sql"

export const jobLookupIxInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE UNIQUE INDEX job_lookup_ix
            ON ${params.schema}.job (type, name)
            WHERE name IS NOT NULL;
        `
    ]
}
