import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageDependencyUpdateResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_DEPENDENCY_UPDATED,
}

export const messageDependencyUpdateInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_dependency_update(
                p_id UUID
            ) RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_num_dependencies INTEGER;
            BEGIN
                v_now := NOW();

                SELECT
                    num_dependencies,
                    delay_ms,
                    status
                FROM ${params.schema}.message
                WHERE id = p_id
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDependencyUpdateResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.CREATED)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDependencyUpdateResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                v_num_dependencies := v_message.num_dependencies - 1;

                UPDATE ${params.schema}.message SET
                    num_dependencies = v_num_dependencies
                WHERE id = p_id;

                IF v_num_dependencies = 0 THEN
                    PERFORM ${params.schema}.job_message_release(
                        p_id,
                        v_now + v_message.delay_ms * INTERVAL '1 MILLISECOND'
                    );
                END IF;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageDependencyUpdateResultCode.MESSAGE_DEPENDENCY_UPDATED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
