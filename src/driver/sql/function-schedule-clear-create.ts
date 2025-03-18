import { type SqlRefNode, sql } from "@src/core/sql"

export const functionScheduleClearCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.schedule_remove(
            p_group_id TEXT,
            p_queue_id TEXT,
            p_schedule_id TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.schedule
            WHERE group_id = p_group_id
            AND queue_id = p_queue_id
            AND schedule_id = p_schedule_id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
