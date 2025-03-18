import { type SqlRefNode, sql } from "@src/core/sql"

export const tableScheduleCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE TABLE ${params.schema}.schedule (
            group_id TEXT NOT NULL,
            queue_id TEXT NOT NULL,
            schedule_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER,
            timeout_secs INTEGER NOT NULL,
            stale_secs INTEGER NOT NULL,
            num_attempts INTEGER NOT NULL,
            deduplication_id TEXT,
            cron_last_mins INTEGER NOT NULL,
            cron_expr_mins INTEGER[] NOT NULL,
            cron_expr_hours INTEGER[] NOT NULL,
            cron_expr_days INTEGER[] NOT NULL,
            cron_expr_months INTEGER[] NOT NULL,
            cron_expr_days_of_week INTEGER[] NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (group_id, queue_id, schedule_id)
        );
    `,

    sql `
        CREATE INDEX schedule_dequeue_ix
        ON ${params.schema}.schedule (
            cron_last_mins ASC
        );
    `,
]
