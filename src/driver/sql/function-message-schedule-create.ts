import { SCHEDULE_SLIPPAGE_MINS as SCHEDULE_SLIPPAGE_THRESHOLD_MINS } from "@src/core/config"
import { type SqlRefNode, sql, valueNode } from "@src/core/sql"
import { ResultCode } from "@src/driver/result-code"

export const functionMessageScheduleCreateSql = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.message_schedule()
        RETURNS TABLE (
            o_result_code INTEGER,
            o_message_id UUID,
            o_group_id TEXT,
            o_queue_id TEXT,
            o_schedule_id TEXT
        ) AS $$
        DECLARE
            v_slippage_mins INTEGER := ${valueNode(SCHEDULE_SLIPPAGE_THRESHOLD_MINS)};
            v_now_mins INTEGER := EXTRACT(EPOCH FROM NOW()) / 60;
            v_cron_last_mins INTEGER;
            v_cron_timestamp TIMESTAMP;
            v_cron_match BOOLEAN;
            v_should_enqueue BOOLEAN;
            v_checked_at_timestamp TIMESTAMP;
            v_checked_at_timestamp_mins INTEGER;
            v_checked_at_timestamp_hours INTEGER;
            v_checked_at_timestamp_day INTEGER;
            v_checked_at_timestamp_month INTEGER;
            v_checked_at_timestamp_day_of_week INTEGER;
            v_schedule RECORD;
            v_enqueue RECORD;
        BEGIN
            SELECT 
                group_id,
                queue_id, 
                schedule_id, 
                payload,
                priority, 
                timeout_secs, 
                stale_secs,
                num_attempts, 
                GREATEST(
                    cron_last_mins, 
                    v_now_mins - v_slippage_mins
                ) AS cron_last_mins,
                cron_expr_mins,
                cron_expr_hours,
                cron_expr_days,
                cron_expr_months,
                cron_expr_days_of_week
            INTO v_schedule
            FROM ${params.schema}.schedule
            WHERE cron_last_mins < v_now_mins
            ORDER BY cron_last_mins ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF v_schedule IS NULL THEN
                RETURN QUERY SELECT
                    ${valueNode(ResultCode.SCHEDULE_NOT_AVAILABLE)}, 
                    ${valueNode(null)}::UUID, 
                    ${valueNode(null)}::TEXT, 
                    ${valueNode(null)}::TEXT, 
                    ${valueNode(null)}::TEXT;
                RETURN;
            END IF;

            v_cron_last_mins := v_schedule.cron_last_mins;
            v_should_enqueue := FALSE;

            WHILE v_cron_last_mins + 1 <= v_now_mins LOOP
                v_cron_last_mins := v_cron_last_mins + 1;
                v_cron_timestamp := TO_TIMESTAMP(v_cron_last_mins * 60) AT TIME ZONE 'UTC';
                v_cron_match := ${params.schema}.cron_test(
                    v_schedule.cron_expr_mins,
                    v_schedule.cron_expr_hours,
                    v_schedule.cron_expr_days,
                    v_schedule.cron_expr_months,
                    v_schedule.cron_expr_days_of_week,
                    v_cron_timestamp
                );

                IF v_cron_match THEN
                    v_should_enqueue := TRUE;
                    EXIT;
                END IF;
            END LOOP;

            UPDATE ${params.schema}.schedule SET
            cron_last_mins = v_now_mins
            WHERE group_id = v_schedule.group_id
            AND queue_id = v_schedule.queue_id
            AND schedule_id = v_schedule.schedule_id;

            IF NOT v_should_enqueue THEN
                RETURN QUERY SELECT
                    ${valueNode(ResultCode.SCHEDULE_EXHAUSTED)}, 
                    ${valueNode(null)}::UUID, 
                    v_schedule.group_id, 
                    v_schedule.queue_id,
                    v_schedule.schedule_id;
                RETURN;
            END IF;

            SELECT 
                message_enqueue.o_result_code, 
                message_enqueue.o_message_id
            INTO v_enqueue
            FROM ${params.schema}.message_enqueue(
                v_schedule.group_id,
                v_schedule.queue_id,
                v_schedule.payload,
                v_schedule.priority,
                v_schedule.timeout_secs,
                v_schedule.stale_secs,
                v_schedule.num_attempts,
                v_schedule.deduplication_id
            );

            IF v_enqueue.o_result_code = ${valueNode(ResultCode.MESSAGE_ENQUEUED)} THEN
                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.MESSAGE_ENQUEUED)}, 
                    v_enqueue.o_message_id, 
                    v_schedule.group_id,
                    v_schedule.queue_id,
                    v_schedule.schedule_id;
            ELSIF v_enqueue.o_result_code = ${valueNode(ResultCode.MESSAGE_UPDATED)} THEN
                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.MESSAGE_UPDATED)}, 
                    v_enqueue.o_message_id, 
                    v_schedule.group_id,
                    v_schedule.queue_id,
                    v_schedule.schedule_id;
            ELSE
                RETURN QUERY SELECT 
                    ${valueNode(ResultCode.QUEUE_CAPACITY_EXCEEDED)},
                    ${valueNode(null)}::UUID, 
                    v_schedule.group_id,
                    v_schedule.queue_id,
                    v_schedule.schedule_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
