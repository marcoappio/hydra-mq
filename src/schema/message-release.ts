import { escapeRefNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { createHash } from "crypto"
import { MessageStatus } from "@src/schema/enum/message-status"

export enum MessageReleaseResultCode {
    MESSAGE_NOT_FOUND,
    MESSAGE_DEPENDENCIES_OUTSTANDING,
    MESSAGE_STATUS_INVALID,
    MESSAGE_DROPPED,
    MESSAGE_DEDUPLICATED,
    MESSAGE_ACCEPTED
}

export const messageReleaseInstall = (params: {
    schema: SqlRefNode
}) => {
    const hashPrefix = createHash("sha256")
        .update(escapeRefNode(params.schema))
        .update("message_release_lock")
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
                v_next_status INTEGER;
                v_result_code INTEGER;
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
                    delete_ms,
                    num_dependencies,
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
                ELSIF v_message.num_dependencies > 0 THEN
                    RETURN JSONB_BUILD_OBJECT(
                        'result_code', ${valueNode(MessageReleaseResultCode.MESSAGE_DEPENDENCIES_OUTSTANDING)},
                        'message', 'Message has dependencies'
                    );
                END IF;

                SELECT
                    max_concurrency,
                    max_size
                FROM ${params.schema}.channel_policy
                WHERE name = v_message.channel_name
                FOR SHARE
                INTO v_channel_policy;

                INSERT INTO ${params.schema}.channel_state (
                    name,
                    max_size,
                    max_concurrency,
                    current_size,
                    current_concurrency,
                    next_message_id,
                    next_priority
                ) VALUES (
                    v_message.channel_name,
                    v_channel_policy.max_size,
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

                IF v_channel_state.current_size >= v_channel_policy.max_size THEN
                    v_next_status := ${valueNode(MessageStatus.DROPPED)};
                    v_result_code := ${valueNode(MessageReleaseResultCode.MESSAGE_DROPPED)};
                ELSIF v_existing_message IS NOT NULL THEN
                    v_next_status := ${valueNode(MessageStatus.DEDUPLICATED)};
                    v_result_code := ${valueNode(MessageReleaseResultCode.MESSAGE_DEDUPLICATED)};
                ELSE
                    v_next_status := ${valueNode(MessageStatus.ACCEPTED)};
                    v_result_code := ${valueNode(MessageReleaseResultCode.MESSAGE_ACCEPTED)};
                END IF;

                IF v_next_status != ${valueNode(MessageStatus.ACCEPTED)} THEN
                    UPDATE ${params.schema}.message SET
                        status = v_next_status
                    WHERE id = p_id;

                    FOR v_message_parent IN
                        UPDATE ${params.schema}.message_parent SET
                            status = v_next_status
                        WHERE parent_message_id = p_id
                        RETURNING message_id
                    LOOP
                        PERFORM ${params.schema}.job_message_dependency_update(v_message_parent.message_id);
                    END LOOP;

                    PERFORM ${params.schema}.job_message_delete(
                        p_id,
                        v_now + v_message.delete_ms * INTERVAL '1 MILLISECOND'
                    );
                ELSE
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
                END IF;

                RETURN JSONB_BUILD_OBJECT('result_code', v_result_code);
            END;
            $$ LANGUAGE plpgsql;
        `

    ]
}
