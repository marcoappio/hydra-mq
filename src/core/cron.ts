type CronFieldResult =
    | { resultType: 'CRON_FIELD_INVALID' }
    | { resultType: 'CRON_FIELD_PARSED', values: number[] }

type CronExprResult =
    | { resultType: 'CRON_EXPR_INVALID' }
    | {
        days: number[]
        daysOfWeek: number[]
        hours: number[]
        mins: number[]
        months: number[]
        resultType: 'CRON_EXPR_PARSED'
    }

const MIN_MINUTES = 0
const MAX_MINUTES = 59

const MIN_HOURS = 0
const MAX_HOURS = 23

const MIN_DAYS = 1
const MAX_DAYS = 31

const MIN_MONTHS = 1
const MAX_MONTHS = 12

const MIN_DAYS_OF_WEEK = 0
const MAX_DAYS_OF_WEEK = 6

export const parseCronField = (expr: string, min: number, max: number): CronFieldResult => {

    const result = new Set<number>()

    for (const pattern of expr.split(',')) {
        const steppedRange = pattern.split('/')
        if (steppedRange.length > 2) {
            return { resultType: 'CRON_FIELD_INVALID' }
        }

        let rangeStart: number
        let rangeEnd: number

        if (steppedRange[0] === '*') {
            rangeStart = min
            rangeEnd = max
        } else {
            const range = steppedRange[0].split('-')
            if (range.length > 2) {
                return { resultType: 'CRON_FIELD_INVALID' }
            }

            rangeStart = parseInt(range[0])

            if (isNaN(rangeStart) || rangeStart < min || rangeStart > max) {
                return { resultType: 'CRON_FIELD_INVALID' }
            }

            rangeEnd = range.length === 2 ? parseInt(range[1]) : rangeStart

            if (isNaN(rangeEnd) || rangeEnd < min || rangeEnd > max) {
                return { resultType: 'CRON_FIELD_INVALID' }
            }
        }

        const stepSize = steppedRange.length === 2 ? parseInt(steppedRange[1]) : 1
        if (isNaN(stepSize) || stepSize < 1) {
            return { resultType: 'CRON_FIELD_INVALID' }
        }

        for (let ix = rangeStart; ix <= rangeEnd; ix += stepSize) {
            result.add(ix)
        }

    }

    return { resultType: 'CRON_FIELD_PARSED', values: [...result] }

}

export const parseCronExpr = (expr: string): CronExprResult => {
    const fields = expr.split(' ')
    if (fields.length !== 5) {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    const mins = parseCronField(fields[0], MIN_MINUTES, MAX_MINUTES)

    if (mins.resultType === 'CRON_FIELD_INVALID') {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    const hours = parseCronField(fields[1], MIN_HOURS, MAX_HOURS)

    if (hours.resultType === 'CRON_FIELD_INVALID') {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    const days = parseCronField(fields[2], MIN_DAYS, MAX_DAYS)

    if (days.resultType === 'CRON_FIELD_INVALID') {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    const months = parseCronField(fields[3], MIN_MONTHS, MAX_MONTHS)

    if (months.resultType === 'CRON_FIELD_INVALID') {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    const daysOfWeek = parseCronField(fields[4], MIN_DAYS_OF_WEEK, MAX_DAYS_OF_WEEK)

    if (daysOfWeek.resultType === 'CRON_FIELD_INVALID') {
        return { resultType: 'CRON_EXPR_INVALID' }
    }

    return {
        days: days.values,
        daysOfWeek: daysOfWeek.values,
        hours: hours.values,
        mins: mins.values,
        months: months.values,
        resultType: 'CRON_EXPR_PARSED',
    }

}
