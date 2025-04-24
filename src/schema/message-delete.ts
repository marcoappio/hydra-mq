import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageDeleteResultCode {
    MESSAGE_NOT_FOUND,
    CHANNEL_STATE_NOT_FOUND,
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
                v_message RECORD;
                v_channel_state RECORD;
            BEGIN
                SELECT 
                    status,
                    channel_name
                FROM ${params.schema}.message
                WHERE id = p_id
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status NOT IN (
                    ${valueNode(MessageStatus.COMPLETED)},
                    ${valueNode(MessageStatus.EXHAUSTED)},
                    ${valueNode(MessageStatus.DROPPED)},
                    ${valueNode(MessageStatus.DEDUPLICATED)}
                ) THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                DELETE FROM ${params.schema}.channel_state
                WHERE name = v_message.channel_name
                AND current_size = 0;

                DELETE FROM ${params.schema}.message
                WHERE id = p_id;

                DELETE FROM ${params.schema}.message_parent
                WHERE message_id = p_id;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageDeleteResultCode.MESSAGE_DELETED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
