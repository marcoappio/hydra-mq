import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageLockResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_LOCKED
}

export const messageLockInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_lock(
                p_id UUID
            )
            RETURNS TABLE (
                o_result_code INT
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_lock_secs REAL;
            BEGIN
                v_now := NOW();

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.LOCKED)},
                    locked_at = v_now,
                    lock_secs = lock_secs * lock_secs_factor
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.PROCESSING)}
                RETURNING channel_name, lock_secs, lock_secs_factor
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT ${valueNode(MessageLockResultCode.MESSAGE_NOT_FOUND)};
                    RETURN;
                END IF;
                
                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;
                
                v_lock_secs := v_message.lock_secs / v_message.lock_secs_factor;
                PERFORM ${params.schema}.job_message_unlock_enqueue(
                    p_id,
                    v_now + v_lock_secs * INTERVAL '1 second'
                );

                RETURN QUERY SELECT ${valueNode(MessageLockResultCode.MESSAGE_LOCKED)};
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
