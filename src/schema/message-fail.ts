import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageFailResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_LOCKED,
    MESSAGE_EXHAUSTED
}

export const messageFailInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_fail(
                p_id UUID,
                p_exhaust BOOLEAN
            )
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_lock_ms REAL;
            BEGIN
                v_now := NOW();

                SELECT
                    channel_name,
                    num_attempts,
                    lock_ms,
                    lock_ms_factor
                FROM ${params.schema}.message
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.PROCESSING)}
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageFailResultCode.MESSAGE_NOT_FOUND)}
                    );
                END IF;

                IF v_message.num_attempts <= 0 OR p_exhaust THEN
                    UPDATE ${params.schema}.message SET
                        status = ${valueNode(MessageStatus.EXHAUSTED)}
                    WHERE id = p_id;

                    UPDATE ${params.schema}.channel_state SET
                        current_concurrency = current_concurrency - 1,
                        current_size = current_size - 1
                    WHERE name = v_message.channel_name;

                    PERFORM ${params.schema}.job_message_finalize_enqueue(p_id);

                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageFailResultCode.MESSAGE_EXHAUSTED)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.LOCKED)},
                    lock_ms = lock_ms * lock_ms_factor
                WHERE id = p_id;
                
                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;
                
                PERFORM ${params.schema}.job_message_unlock_enqueue(
                    p_id,
                    v_now + v_message.lock_ms * INTERVAL '1 MILLISECOND'
                );

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageFailResultCode.MESSAGE_LOCKED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
