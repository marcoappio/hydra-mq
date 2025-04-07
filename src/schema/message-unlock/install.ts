import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageUnlockResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_UNLOCKED
}

export const messageUnlockInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_unlock(
                p_id UUID
            ) RETURNS TABLE (
                o_result_code INTEGER
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_channel_policy RECORD;
                v_channel_state RECORD;
            BEGIN
                v_now := NOW();

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.WAITING)},
                    waiting_at = v_now
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.LOCKED)}
                RETURNING channel_name, priority
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT 
                        ${valueNode(MessageUnlockResultCode.MESSAGE_NOT_FOUND)};
                    RETURN;
                END IF;

                UPDATE ${params.schema}.channel_state SET
                    next_message_id = p_id,
                    next_priority = v_message.priority
                WHERE name = v_message.channel_name
                AND next_message_id IS NULL;

                RETURN QUERY SELECT
                    ${valueNode(MessageUnlockResultCode.MESSAGE_UNLOCKED)};
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}
