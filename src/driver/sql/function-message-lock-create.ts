import { type SqlRefNode, sql } from "@src/core/sql"
import { MessageStatus } from "@src/driver/message-status"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageLockCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql.build`
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
                status = ${sql.value(MessageStatus.LOCKED)},
                unlocked_at = v_now + timeout_secs * INTERVAL '1 second',
                num_attempts = num_attempts - 1
            WHERE id = p_message_id
            RETURNING id, queue_id
            INTO v_message;

            IF v_message IS NULL THEN
                RETURN QUERY SELECT ${sql.value(ResultCode.MESSAGE_NOT_FOUND)};
                RETURN;
            END IF;

            UPDATE ${params.schema}.message_queue_prefix SET
                status = ${sql.value(MessageStatus.LOCKED)}
            WHERE message_id = v_message.id;

            PERFORM ${params.schema}.queue_advance(v_message.queue_id);
            RETURN QUERY SELECT ${sql.value(ResultCode.MESSAGE_LOCKED)};
        END;
        $$ LANGUAGE plpgsql;
    `,
]
