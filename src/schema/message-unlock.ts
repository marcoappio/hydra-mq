import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageUnlockResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_ACCEPTED
}

export const messageUnlockInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_unlock(
                p_id UUID
            ) RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_channel_policy RECORD;
                v_channel_state RECORD;
            BEGIN
                v_now := NOW();

                SELECT
                    status,
                    channel_name,
                    priority
                FROM ${params.schema}.message
                WHERE id = p_id
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageUnlockResultCode.MESSAGE_NOT_FOUND)}
                    );
                END IF;

                IF v_message.status != ${valueNode(MessageStatus.LOCKED)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageUnlockResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.ACCEPTED)},
                    accepted_at = v_now
                WHERE id = p_id;

                UPDATE ${params.schema}.channel_state SET
                    next_message_id = p_id,
                    next_priority = v_message.priority
                WHERE name = v_message.channel_name
                AND next_message_id IS NULL;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageUnlockResultCode.MESSAGE_ACCEPTED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}
