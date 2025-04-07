import { sql, type SqlRefNode } from "@src/core/sql"

export enum JobType {
    MESSAGE_RELEASE,
    MESSAGE_UNLOCK,
    MESSAGE_DELETE,
    MESSAGE_ENQUEUE,
    MESSAGE_DEPENDENCY_RESOLVE
}

export const jobInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE TABLE ${params.schema}.job (
                id UUID NOT NULL DEFAULT GEN_RANDOM_UUID(),
                type INTEGER NOT NULL,
                name TEXT NULL,
                is_recurring BOOLEAN NOT NULL,
                cron_expr_mins INTEGER[],
                cron_expr_hours INTEGER[],
                cron_expr_days INTEGER[],
                cron_expr_months INTEGER[],
                cron_expr_days_of_week INTEGER[],
                process_after TIMESTAMP NOT NULL,
                PRIMARY KEY (id),
                CHECK (
                    NOT is_recurring OR (
                        cron_expr_mins IS NOT NULL AND
                        cron_expr_hours IS NOT NULL AND
                        cron_expr_days IS NOT NULL AND
                        cron_expr_months IS NOT NULL AND
                        cron_expr_days_of_week IS NOT NULL
                    )
                )
            );
        `,

        sql `
            CREATE INDEX job_dequeue_ix
            ON ${params.schema}.job (process_after ASC)
        `,

        sql `
            CREATE UNIQUE INDEX job_lookup_ix
            ON ${params.schema}.job (type, name)
            WHERE name IS NOT NULL;
        `
    ]
}
