import { type SqlRefNode, sql } from '@src/core/sql'

export const tableQueueConfigCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE TABLE ${params.schema}.queue_config (
            id TEXT NOT NULL,
            max_capacity INTEGER,
            max_concurrency INTEGER,
            current_capacity INTEGER NOT NULL,
            current_concurrency INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (id)
        );
    `,
]
