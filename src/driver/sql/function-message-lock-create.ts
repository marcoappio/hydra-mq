import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageLockCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.message_lock(
            p_message_id UUID
        )
        RETURNS TABLE (
            o_result_code INT
        ) AS $$
        DECLARE
            v_now TIMESTAMP := NOW();
            v_message RECORD;
        BEGIN
            UPDATE ${params.schema}.message SET
                status = ${valueNode(MessageStatus.LOCKED)},
                unlock_after = v_now + timeout_secs * INTERVAL '1 second',
                locked_at = v_now,
                num_attempts = num_attempts - 1
            WHERE id = p_message_id
            RETURNING group_id, queue_id
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT ${valueNode(ResultCode.MESSAGE_NOT_FOUND)};
                RETURN;
            END IF;

            PERFORM ${params.schema}.queue_advance(
                v_message.group_id,
                v_message.queue_id
            );

            RETURN QUERY SELECT ${valueNode(ResultCode.MESSAGE_LOCKED)};
        END;
        $$ LANGUAGE plpgsql;
    `,
]
