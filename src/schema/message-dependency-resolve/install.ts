import { sql, valueNode, type SqlRefNode } from "@src/core/sql"

export enum MessageDependencyResolveResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_DEPENDENCY_RESOLVED,
}

export const messageDependencyResolveInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_dependency_resolve(
                p_id UUID,
                p_is_success BOOLEAN
            ) RETURNS TABLE (
                o_result_code INTEGER
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_failed_dependencies INTEGER;
                v_message RECORD;
            BEGIN
                v_now := NOW();
                v_failed_dependencies := CASE WHEN p_is_success THEN 0 ELSE 1 END;
                UPDATE ${params.schema}.message SET
                    num_dependencies = num_dependencies - 1,
                    num_dependencies_failed = num_dependencies_failed + v_failed_dependencies
                WHERE id = p_id
                RETURNING num_dependencies, delay_secs
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT ${valueNode(MessageDependencyResolveResultCode.MESSAGE_NOT_FOUND)};
                    RETURN;
                END IF;

                IF v_message.num_dependencies = 0 THEN
                    PERFORM ${params.schema}.job_message_release_enqueue(
                        p_id,
                        v_now + v_message.delay_secs * INTERVAL '1 second'
                    );
                END IF;

                RETURN QUERY SELECT ${valueNode(MessageDependencyResolveResultCode.MESSAGE_DEPENDENCY_RESOLVED)};
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
