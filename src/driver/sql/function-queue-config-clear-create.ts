import { type SqlRefNode, sql } from "@src/core/sql"

export const functionQueueConfigClearCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.queue_config_clear(
            p_group_id TEXT,
            p_queue_id TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.queue_config
            WHERE group_id = p_group_id
            AND queue_id = p_queue_id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
