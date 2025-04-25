import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobChannelPolicySetInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_channel_policy_set(
                p_name TEXT,
                p_max_size INTEGER,
                p_max_concurrency INTEGER
            ) RETURNS VOID AS $$
            DECLARE
                v_now TIMESTAMP;
                v_params JSONB;
            BEGIN
                v_now := NOW();
                v_params := JSONB_BUILD_OBJECT(
                    'name', p_name,
                    'max_size', p_max_size,
                    'max_concurrency', p_max_concurrency
                );

                INSERT INTO ${params.schema}.job (
                    type,
                    params,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.CHANNEL_POLICY_SET)},
                    v_params,
                    ${valueNode(false)},
                    v_now
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

