import { sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { MessageStatus } from "@src/schema/message"

export enum MessageReleaseResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_RELEASED
}

export const messageReleaseInstall = (params: {
    schema: SqlRefNode
}) => {
    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_release(
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

                SELECT
                    channel_name,
                    priority
                FROM ${params.schema}.message
                WHERE id = p_id
                AND status = ${valueNode(MessageStatus.CREATED)}
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN QUERY SELECT
                        ${valueNode(MessageReleaseResultCode.MESSAGE_NOT_FOUND)};
                    RETURN;
                END IF;

                SELECT
                    max_concurrency
                FROM ${params.schema}.channel_policy
                WHERE name = v_message.channel_name
                FOR SHARE
                INTO v_channel_policy;

                IF v_channel_policy.max_concurrency IS NOT NULL THEN
                    v_channel_policy.max_concurrency := GREATEST(v_channel_policy.max_concurrency, 1);
                END IF;

                INSERT INTO ${params.schema}.channel_state (
                    name,
                    max_concurrency,
                    current_size,
                    current_concurrency,
                    next_message_id,
                    next_priority
                ) VALUES (
                    v_message.channel_name,
                    v_channel_policy.max_concurrency,
                    ${valueNode(0)},
                    ${valueNode(0)},
                    p_id,
                    v_message.priority
                ) ON CONFLICT (name) DO UPDATE SET
                    id = ${params.schema}.channel_state.id
                RETURNING current_size
                INTO v_channel_state;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.WAITING)},
                    waiting_at = v_now
                WHERE id = p_id;

                UPDATE ${params.schema}.channel_state SET
                    current_size = current_size + 1,
                    next_message_id = CASE WHEN next_message_id IS NULL THEN p_id ELSE next_message_id END,
                    next_priority = CASE WHEN next_message_id IS NULL THEN v_message.priority ELSE next_priority END
                WHERE name = v_message.channel_name;

                RETURN QUERY SELECT
                    ${valueNode(MessageReleaseResultCode.MESSAGE_RELEASED)};
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}
