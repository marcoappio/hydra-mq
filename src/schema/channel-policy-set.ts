import { type SqlRefNode, sql } from "@src/core/sql"

export const channelPolicySetInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.channel_policy_set(
            p_name TEXT,
            p_max_size INTEGER,
            p_max_concurrency INTEGER
        )
        RETURNS VOID AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
        BEGIN
            INSERT INTO ${params.schema}.channel_policy (
                name,
                max_size,
                max_concurrency
            ) VALUES (
                p_name,
                p_max_size,
                p_max_concurrency
            ) ON CONFLICT (name) DO UPDATE SET
                max_size = p_max_size,
                max_concurrency = p_max_concurrency;

            UPDATE ${params.schema}.channel_state SET
                max_size = p_max_size,
                max_concurrency = p_max_concurrency
            WHERE name = p_name;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
