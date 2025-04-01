import { sql, valueNode, type SqlRefNode } from "@src/core/sql"

const LIMIT_YEARS = 5

export enum CronNextResultCode {
    TIMESTAMP_FOUND,
    TIMESTAMP_NOT_FOUND
}

export const cronNextInstall = (params: {
    schema: SqlRefNode
}) => [
    sql `
        CREATE FUNCTION ${params.schema}.cron_next(
            p_cron_expr_mins INTEGER[],
            p_cron_expr_hours INTEGER[],
            p_cron_expr_days INTEGER[],
            p_cron_expr_months INTEGER[],
            p_cron_expr_days_of_week INTEGER[],
            p_timestamp TIMESTAMP
        ) RETURNS TABLE (
            o_result_code INTEGER,
            o_timestamp TIMESTAMP
        ) AS $$
        DECLARE
            v_limit TIMESTAMP;
            v_min INTEGER;
            v_hour_carry INTEGER;
            v_hour INTEGER;
            v_day_carry INTEGER;
            v_day INTEGER;
            v_month_carry INTEGER;
            v_month INTEGER;
            v_year_carry INTEGER;
            v_year INTEGER;
            v_days_in_month INTEGER;
            v_day_of_week INTEGER;
        BEGIN
            p_timestamp := p_timestamp + INTERVAL '1 MINUTE';
            v_limit := p_timestamp + INTERVAL '1 YEAR' * ${valueNode(LIMIT_YEARS)};

            WHILE TRUE LOOP
                IF p_timestamp > v_limit THEN
                    RETURN QUERY SELECT
                        ${valueNode(CronNextResultCode.TIMESTAMP_NOT_FOUND)},
                        ${valueNode(null)}::TIMESTAMP;
                    RETURN;
                END IF;

                v_min := EXTRACT(MINUTE FROM p_timestamp);
                v_hour := EXTRACT(HOUR FROM p_timestamp);
                v_day := EXTRACT(DAY FROM p_timestamp);
                v_month := EXTRACT(MONTH FROM p_timestamp);
                v_year := EXTRACT(YEAR FROM p_timestamp);

                SELECT INTO v_min, v_hour_carry
                    COALESCE(MIN(x), p_cron_expr_mins[1]),
                    CASE WHEN COUNT(x) = 0 THEN 1 ELSE 0 END
                FROM UNNEST(p_cron_expr_mins) AS x
                WHERE x >= v_min;

                v_hour := v_hour + v_hour_carry;
                SELECT INTO v_hour, v_day_carry
                    COALESCE(MIN(x), p_cron_expr_hours[1]),
                    CASE WHEN COUNT(x) = 0 THEN 1 ELSE 0 END
                FROM UNNEST(p_cron_expr_hours) AS x
                WHERE x >= v_hour;

                v_day := v_day + v_day_carry;
                SELECT INTO v_day, v_month_carry
                    COALESCE(MIN(x), p_cron_expr_days[1]),
                    CASE WHEN COUNT(x) = 0 THEN 1 ELSE 0 END
                FROM UNNEST(p_cron_expr_days) AS x
                WHERE x >= v_day;

                v_month := v_month + v_month_carry;
                SELECT INTO v_month, v_year_carry
                    COALESCE(MIN(x), p_cron_expr_months[1]),
                    CASE WHEN COUNT(x) = 0 THEN 1 ELSE 0 END
                FROM UNNEST(p_cron_expr_months) AS x
                WHERE x >= v_month;

                v_year := v_year + v_year_carry;

                v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', MAKE_DATE(v_year, v_month, 1) + INTERVAL '1 MONTH') - INTERVAL '1 DAY'));

                IF v_day > v_days_in_month THEN
                    p_timestamp := MAKE_TIMESTAMP(v_year, v_month, 1, 0, 0, 0);
                    p_timestamp := p_timestamp + INTERVAL '1 MONTH';
                    CONTINUE;
                END IF;

                v_day_of_week := EXTRACT(DOW FROM MAKE_DATE(v_year, v_month, v_day));
                IF NOT (v_day_of_week = ANY(p_cron_expr_days_of_week)) THEN
                    p_timestamp := MAKE_TIMESTAMP(v_year, v_month, v_day, 0, 0, 0);
                    p_timestamp := p_timestamp + INTERVAL '1 DAY';
                    CONTINUE;
                END IF;

                RETURN QUERY SELECT
                    ${valueNode(CronNextResultCode.TIMESTAMP_FOUND)},
                    MAKE_TIMESTAMP(v_year, v_month, v_day, v_hour, v_min, 0);
                RETURN;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
    `,
]
