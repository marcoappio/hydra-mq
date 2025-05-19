import { escapeRefNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { createHash } from "crypto"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageReleaseResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_STATUS_INVALID,
    MESSAGE_DEDUPLICATED,
    MESSAGE_ACCEPTED
}

export const messageReleaseInstall = (params: {
    schema: SqlRefNode
}) => {
    const hashPrefix = createHash("sha256")
        .update(escapeRefNode(params.schema))
        .update("MESSAGE_RELEASE::DEDUPLICATE")
        .digest("hex")

    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_release(
                p_id UUID
            ) RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message RECORD;
                v_lock_id INTEGER;
                v_existing_message RECORD;
                v_message_parent RECORD;
                v_channel_policy RECORD;
                v_channel_state RECORD;
            BEGIN
                v_now := NOW();

                SELECT
                    name,
                    status,
                    channel_name,
                    priority
                FROM ${params.schema}.message
                WHERE id = p_id
                FOR UPDATE
                INTO v_message;

                IF v_message IS NULL THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageReleaseResultCode.MESSAGE_NOT_FOUND)}
                    );
                ELSIF v_message.status != ${valueNode(MessageStatus.CREATED)} THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageReleaseResultCode.MESSAGE_STATUS_INVALID)}
                    );
                END IF;

                SELECT
                    max_concurrency
                FROM ${params.schema}.channel_policy
                WHERE name = v_message.channel_name
                FOR SHARE
                INTO v_channel_policy;

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
                RETURNING current_size, next_message_id
                INTO v_channel_state;

                v_lock_id := HASHTEXT(${valueNode(hashPrefix)} || v_message.name);
                PERFORM PG_ADVISORY_XACT_LOCK(v_lock_id);

                SELECT id
                FROM ${params.schema}.message
                WHERE status = ${valueNode(MessageStatus.ACCEPTED)}
                AND NOT is_processed
                AND name = v_message.name
                LIMIT 1
                INTO v_existing_message;

                IF v_existing_message IS NOT NULL THEN
                    DELETE FROM ${params.schema}.channel_state
                    WHERE name = v_message.channel_name
                    AND current_size = 0;

                    DELETE FROM ${params.schema}.message
                    WHERE id = p_id;

                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageReleaseResultCode.MESSAGE_DEDUPLICATED)}
                    );
                END IF;

                IF v_channel_state.next_message_id IS NULL THEN
                    UPDATE ${params.schema}.channel_state SET
                        current_size = current_size + 1,
                        next_message_id = p_id,
                        next_priority = v_message.priority
                    WHERE name = v_message.channel_name;
                ELSE
                    UPDATE ${params.schema}.channel_state SET
                        current_size = current_size + 1
                    WHERE name = v_message.channel_name;
                END IF;

                UPDATE ${params.schema}.message SET
                    status = ${valueNode(MessageStatus.ACCEPTED)},
                    accepted_at = v_now
                WHERE id = p_id;

                RETURN JSONB_BUILD_OBJECT('result_code', ${valueNode(MessageReleaseResultCode.MESSAGE_ACCEPTED)});
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}
