import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageDeleteResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_DELETED
}

export const messageDeleteInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_delete(
                p_id UUID
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
                    status
                FROM ${params.schema}.message
                WHERE id = p_id
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.PROCESSING)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                UPDATE ${params.schema}.channel_state SET
                    current_size = current_size - 1,
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;

                DELETE FROM ${params.schema}.channel_state
                WHERE name = v_message.channel_name
                AND current_size = 0;

                DELETE FROM ${params.schema}.message
                WHERE id = p_id;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_DELETED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
