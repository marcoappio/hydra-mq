import { type SqlRefNode, sql } from "@src/core/sql"

export const channelPolicySetInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.channel_policy_set(
            p_name TEXT,
            p_max_concurrency INTEGER,
            p_max_size INTEGER
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_max_concurrency INTEGER;
            v_max_size INTEGER;
        BEGIN
            v_max_concurrency = CASE WHEN p_max_concurrency IS NULL THEN NULL ELSE GREATEST(1, p_max_concurrency) END;
            v_max_size = CASE WHEN p_max_size IS NULL THEN NULL ELSE GREATEST(1, p_max_size) END;

            INSERT INTO ${params.schema}.channel_policy (
                name,
                max_concurrency,
                max_size
            ) VALUES (
                p_name,
                v_max_concurrency,
                v_max_size
            ) ON CONFLICT (name) DO UPDATE SET
                max_concurrency = v_max_concurrency,
                max_size = v_max_size;

            UPDATE ${params.schema}.channel_state SET
                max_size = v_max_size,
                max_concurrency = v_max_concurrency
            WHERE name = p_name;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
