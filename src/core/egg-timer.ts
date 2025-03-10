type EggTimerFn = () => void

export class EggTimer {

    private readonly eggTimerFn: EggTimerFn
    private timer: Timer | null

    constructor(timeoutFn: EggTimerFn) {
        this.eggTimerFn = timeoutFn
        this.timer = null
    }

    set(timeoutMs: number) {
        if (this.timer) {
            clearTimeout(this.timer)
        }
        this.timer = setTimeout(this.eggTimerFn, timeoutMs)
    }

    clear() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }

}
