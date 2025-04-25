import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageSuccessResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_SUCCEEDED
}

export const messageSuccessInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_success(
                p_id UUID,
                p_result TEXT
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_message_parent RECORD;
            BEGIN
                v_now := NOW();
                SELECT
                    channel_name,
                    status,
                    delete_ms
                FROM ${params.schema}.message
                WHERE id = p_id
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageSuccessResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.PROCESSING)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageSuccessResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.COMPLETED)},
                    result = p_result
                WHERE id = p_id;

                UPDATE ${params.schema}.channel_state SET
                    current_size = current_size - 1,
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;

                FOR v_message_parent IN
                    UPDATE ${params.schema}.message_parent SET
                        status = ${valueNode(MessageStatus.COMPLETED)},
                        result = p_result
                    WHERE parent_message_id = p_id
                    RETURNING message_id
                LOOP
                    PERFORM ${params.schema}.job_message_dependency_update(v_message_parent.message_id);
                END LOOP;

                PERFORM ${params.schema}.job_message_delete(
                    p_id,
                    v_now + v_message.delete_ms * INTERVAL '1 MILLISECOND'
                );

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageSuccessResultCode.MESSAGE_SUCCEEDED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
