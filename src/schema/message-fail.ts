import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageFailResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
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
                v_message_parent RECORD;
                v_lock_ms INTEGER;
            BEGIN
                v_now := NOW();

                SELECT
                    channel_name,
                    num_attempts,
                    status,
                    lock_ms,
                    lock_ms_factor,
                    delete_ms
                FROM ${params.schema}.message
                WHERE id = p_id
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageFailResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.PROCESSING)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageFailResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                IF v_message.num_attempts <= 0 OR p_exhaust THEN
                    UPDATE ${params.schema}.message SET
                        status = ${valueNode(MessageStatus.EXHAUSTED)},
                        lock_ms = (lock_ms * lock_ms_factor)::INTEGER
                    WHERE id = p_id;

                    UPDATE ${params.schema}.channel_state SET
                        current_size = current_size - 1,
                        current_concurrency = current_concurrency - 1
                    WHERE name = v_message.channel_name;

                    FOR v_message_parent IN
                        UPDATE ${params.schema}.message_parent SET
                            status = ${valueNode(MessageStatus.EXHAUSTED)}
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
                        'result_code', ${valueNode(MessageFailResultCode.MESSAGE_EXHAUSTED)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.LOCKED)},
                    lock_ms = (lock_ms * lock_ms_factor)::INTEGER
                WHERE id = p_id;
                
                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;
                
                PERFORM ${params.schema}.job_message_unlock(
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
