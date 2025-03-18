import { type SqlRefNode, sql } from "@src/core/sql"

export const functionQueueConfigClearCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE FUNCTION ${params.schema}.queue_config_clear(
            p_queue_id TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.queue_config
            WHERE id = p_queue_id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
