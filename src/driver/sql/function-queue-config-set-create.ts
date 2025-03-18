import { type SqlRefNode, sql } from "@src/core/sql"

export const functionQueueConfigSetCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.queue_config_set(
            p_group_id TEXT,
            p_queue_id TEXT,
            p_max_concurrency INTEGER,
            p_max_capacity INTEGER
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_max_concurrency INTEGER;
        BEGIN
            IF p_max_concurrency IS NULL THEN
                v_max_concurrency := NULL;
            ELSE
                v_max_concurrency := GREATEST(1, p_max_concurrency);
            END IF;

            INSERT INTO ${params.schema}.queue_config (
                group_id,
                queue_id,
                max_concurrency,
                max_capacity,
                current_capacity,
                current_concurrency,
                created_at,
                updated_at
            ) VALUES (
                p_group_id,
                p_queue_id,
                v_max_concurrency,
                p_max_capacity,
                0, 0,
                v_now,
                v_now
            ) ON CONFLICT (group_id, queue_id) DO UPDATE SET
                max_concurrency = v_max_concurrency,
                max_capacity = p_max_capacity,
                updated_at = v_now;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
