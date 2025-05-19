import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageRetryResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_LOCKED,
    MESSAGE_ACCEPTED
}

export const messageRetryInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_retry(
                p_id UUID,
                p_lock_ms INTEGER
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
                    priority,
                    status
                FROM ${params.schema}.message
                WHERE id = p_id
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageRetryResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.PROCESSING)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageRetryResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = current_concurrency - 1
                WHERE name = v_message.channel_name;

                IF p_lock_ms > 0 THEN
                    UPDATE ${params.schema}.message SET
                        status = ${valueNode(MessageStatus.LOCKED)}
                    WHERE id = p_id;

                    PERFORM ${params.schema}.job_message_unlock(
                        p_id,
                        v_now + p_lock_ms * INTERVAL '1 MILLISECOND'
                    );

                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageRetryResultCode.MESSAGE_LOCKED)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.ACCEPTED)}
                WHERE id = p_id;

                UPDATE ${params.schema}.channel_state SET
                    next_message_id = p_id,
                    next_priority = v_message.priority
                WHERE name = v_message.channel_name
                AND next_message_id IS NULL;

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageRetryResultCode.MESSAGE_ACCEPTED)}
                );
            END;
            $$ LANGUAGE plpgsql;
        `,
    ]
}
