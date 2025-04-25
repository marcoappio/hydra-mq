import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"

export const jobChannelPolicyClearInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.job_channel_policy_clear(
                p_name TEXT
            ) RETURNS VOID AS $$
            DECLARE
                v_now TIMESTAMP;
                v_params JSONB;
            BEGIN
                v_now := NOW();
                v_params := JSONB_BUILD_OBJECT(
                    'name', p_id
                );

                INSERT INTO ${params.schema}.job (
                    type,
                    params,
                    is_recurring,
                    process_after
                ) VALUES (
                    ${valueNode(JobType.CHANNEL_POLICY_CLEAR)},
                    v_params,
                    ${valueNode(false)},
                    v_now
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}

