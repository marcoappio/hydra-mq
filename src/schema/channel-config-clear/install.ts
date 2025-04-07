import { type SqlRefNode, sql, valueNode } from "@src/core/sql"

export const channelPolicyClearInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.channel_policy_clear(
                p_name TEXT
            )
            RETURNS VOID AS $$
            BEGIN
                DELETE FROM ${params.schema}.channel_policy
                WHERE name = p_name;

                UPDATE ${params.schema}.channel_state SET
                    max_size = ${valueNode(null)},
                    max_concurrency = ${valueNode(null)}
                WHERE name = p_name;
            END;
            $$ LANGUAGE plpgsql;
    `,
    ]
}
