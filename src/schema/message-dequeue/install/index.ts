import { rawNode, refNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { messageDequeueQueryChannelState } from "@src/schema/message-dequeue/install/query/channel-state"
import { messageDequeueQueryMessage } from "@src/schema/message-dequeue/install/query/message"
import { MessageStatus } from "@src/schema/message"

export enum MessageDequeueResultCode {
    QUEUE_EMPTY,
    MESSAGE_DEQUEUED,
}

export const messageDequeueInstall = (params: {
    schema: SqlRefNode
}) => {
    const channelStateQuery = messageDequeueQueryChannelState({
        schema: params.schema,
        limit: valueNode(1),
        select: [
            refNode("name"),
            refNode("current_concurrency"),
            refNode("next_message_id"),
        ]
    })

    const messageQuery = messageDequeueQueryMessage({
        schema: params.schema,
        limit: valueNode(1),
        channelName: refNode("v_channel_state", "name"),
        select: [
            refNode("id"),
            refNode("priority"),
            refNode("waiting_at"),
        ]
    })

    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_dequeue()
            RETURNS TABLE (
                o_result_code INTEGER,
                o_id UUID,
                o_channel_name TEXT,
                o_payload TEXT,
                o_num_attempts INTEGER,
                o_num_dependencies_failed INTEGER,
                o_dependency_failure_cascade BOOLEAN
            ) AS $$
            DECLARE
                v_now TIMESTAMP;
                v_channel_state RECORD;
                v_message RECORD;
                v_next_message RECORD;
            BEGIN
                v_now := NOW();

                ${rawNode(channelStateQuery)}
                FOR UPDATE SKIP LOCKED
                INTO v_channel_state;

                IF v_channel_state IS NULL THEN
                    RETURN QUERY SELECT 
                        ${valueNode(MessageDequeueResultCode.QUEUE_EMPTY)}, 
                        ${valueNode(null)}::UUID, 
                        ${valueNode(null)}::TEXT, 
                        ${valueNode(null)}::TEXT, 
                        ${valueNode(null)}::INTEGER,
                        ${valueNode(null)}::INTEGER,
                        ${valueNode(null)}::BOOLEAN;
                    RETURN;
                END IF;

                UPDATE ${params.schema}.message SET
                    is_processed = ${valueNode(true)},
                    status = ${valueNode(MessageStatus.PROCESSING)},
                    sweep_after = v_now + (max_processing_secs * INTERVAL '1 second'),
                    num_attempts = num_attempts - 1
                WHERE id = v_channel_state.next_message_id
                RETURNING 
                    id, 
                    payload, 
                    num_attempts, 
                    num_dependencies_failed,
                    dependency_failure_cascade
                INTO v_message;

                UPDATE ${params.schema}.channel_state SET
                    current_concurrency = v_channel_state.current_concurrency + 1
                WHERE name = v_channel_state.name;

                ${rawNode(messageQuery)}
                INTO v_next_message;

                IF v_next_message IS NULL THEN
                    UPDATE ${params.schema}.channel_state SET
                        next_message_id = ${valueNode(null)},
                        next_priority = ${valueNode(null)},
                        dequeued_at = v_now
                    WHERE name = v_channel_state.name;
                ELSE
                    UPDATE ${params.schema}.channel_state SET
                        next_message_id = v_next_message.id,
                        next_priority = v_next_message.priority,
                        dequeued_at = v_now
                    WHERE name = v_channel_state.name;
                END IF;

                RETURN QUERY SELECT
                    ${valueNode(MessageDequeueResultCode.MESSAGE_DEQUEUED)},
                    v_message.id,
                    v_channel_state.name,
                    v_message.payload,
                    v_message.num_attempts,
                    v_message.num_dependencies_failed,
                    v_message.dependency_failure_cascade;
            END;
            $$ LANGUAGE plpgsql;
    `,
    ]
}
