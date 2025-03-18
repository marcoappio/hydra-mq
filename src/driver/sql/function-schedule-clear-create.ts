import { type SqlRefNode, sql } from "@src/core/sql"

export const functionScheduleClearCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build `
        CREATE FUNCTION ${params.schema}.schedule_remove(
            p_schedule_id TEXT,
            p_queue_id TEXT
        )
        RETURNS VOID AS $$
        BEGIN
            DELETE FROM ${params.schema}.schedule
            WHERE id = p_schedule_id
            AND queue_id = p_queue_id;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
