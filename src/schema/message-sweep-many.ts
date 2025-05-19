import { parseCronExpr } from "@src/core/cron"
import { arrayNode, sql, valueNode, type SqlRefNode } from "@src/core/sql"
import { JobType } from "@src/schema/enum/job-type"
import { MessageStatus } from "@src/schema/enum/message-status"

export const messageSweepManyInstall = (params: {
    schema: SqlRefNode
}) => {
    const parsedCronExpr = parseCronExpr("* * * * *")
    if (parsedCronExpr.resultType !== "CRON_EXPR_PARSED") {
        throw new Error("Invalid cron expression")
    }

    return [
        sql `
            CREATE FUNCTION ${params.schema}.message_sweep_many()
            RETURNS JSONB AS $$
            DECLARE
                v_now TIMESTAMP;
                v_message_ids UUID[];
                v_id UUID;
            BEGIN
                v_now := NOW();
                v_message_ids := ARRAY[]::UUID[];

                FOR v_id IN 
                    SELECT id FROM ${params.schema}.message
                    WHERE status = ${valueNode(MessageStatus.PROCESSING)}
                    AND sweep_after <= v_now
                    ORDER BY sweep_after ASC
                LOOP
                    v_message_ids := ARRAY_APPEND(v_message_ids, v_id);
                    PERFORM ${params.schema}.job_message_retry(v_id);
                END LOOP;

                RETURN JSONB_BUILD_OBJECT(
                    'ids', TO_JSONB(v_message_ids)
                );
            END;
            $$ LANGUAGE plpgsql;
        `,

        sql `
            INSERT INTO ${params.schema}.job (
                type, 
                params,
                is_recurring, 
                cron_expr_mins,
                cron_expr_hours,
                cron_expr_days,
                cron_expr_months,
                cron_expr_days_of_week,
                process_after
            ) VALUES (
                ${valueNode(JobType.MESSAGE_SWEEP_MANY)},
                ${valueNode(JSON.stringify({}))},
                ${valueNode(true)},
                ${arrayNode(parsedCronExpr.expression.mins)},
                ${arrayNode(parsedCronExpr.expression.hours)},
                ${arrayNode(parsedCronExpr.expression.days)},
                ${arrayNode(parsedCronExpr.expression.months)},
                ${arrayNode(parsedCronExpr.expression.daysOfWeek)},
                NOW()
            )
        `
    ]
}
