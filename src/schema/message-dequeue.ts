import { escapeRefNode, rawNode, refNode, sql, valueNode, type SqlRefNode, type SqlValueNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageDequeueResultCode {
    QUEUE_EMPTY,
    MESSAGE_DEQUEUED,
}

const messageFetch = (params: {
    channelName: SqlValueNode | SqlRefNode
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.message
        WHERE status = ${valueNode(MessageStatus.ACCEPTED)}
        AND channel_name = ${params.channelName}
        ORDER BY 
            priority ASC NULLS FIRST,
            channel_priority ASC NULLS FIRST,
            accepted_at ASC
        LIMIT ${params.limit}
    `
}

const channelStateFetch = (params: {
    select : SqlRefNode[],
    limit: SqlValueNode | SqlRefNode
    schema: SqlRefNode
}) => {
    const selectRefs = params.select.map(escapeRefNode).join(", ")
    return sql `
        SELECT ${rawNode(selectRefs)}
        FROM ${params.schema}.channel_state
        WHERE next_message_id IS NOT NULL AND (max_concurrency IS NULL OR current_concurrency < max_concurrency)
        ORDER BY 
            next_priority DESC NULLS LAST,
            dequeued_at ASC NULLS FIRST
        LIMIT ${params.limit}
    `
}

export const messageDequeueInstall = (params: {
    schema: SqlRefNode
}) => {
    const channelStateQuery = channelStateFetch({
        schema: params.schema,
        limit: valueNode(1),
        select: [
            refNode("name"),
            refNode("current_concurrency"),
            refNode("next_message_id"),
        ]
    })

    const messageQuery = messageFetch({
        schema: params.schema,
        limit: valueNode(1),
        channelName: refNode("v_channel_state", "name"),
        select: [
            refNode("id"),
            refNode("priority"),
            refNode("accepted_at"),
        ]
    })

    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_dequeue()
            RETURNS JSONB AS $$
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
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageDequeueResultCode.QUEUE_EMPTY)}
                    );
                END IF;

                UPDATE ${params.schema}.message SET
                    is_processed = ${valueNode(true)},
                    status = ${valueNode(MessageStatus.PROCESSING)},
                    sweep_after = v_now + (max_processing_ms * INTERVAL '1 MILLISECOND'),
                    num_attempts = num_attempts + 1
                WHERE id = v_channel_state.next_message_id
                RETURNING 
                    id, 
                    name,
                    payload,
                    num_attempts,
                    priority,
                    channel_priority
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

                RETURN JSONB_BUILD_OBJECT(
                    'result_code', ${valueNode(MessageDequeueResultCode.MESSAGE_DEQUEUED)},
                    'id', v_message.id,
                    'channel_name', v_channel_state.name,
                    'num_attempts', v_message.num_attempts,
                    'priority', v_message.priority,
                    'name', v_message.name,
                    'channel_priority', v_message.channel_priority,
                    'payload', v_message.payload
                );
            END;
            $$ LANGUAGE plpgsql;
    `,
    ]
}
