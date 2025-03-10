type PromiseResolveFn = (arg?: any) => void

export class Semaphore {
    private count: number
    private readonly queue: PromiseResolveFn[]

    constructor(count = 1) {
        this.count = count
        this.queue = []
    }

    async acquireAll() {
        if (this.count > 0) {
            this.count = 0
        } else {
            await new Promise(resolve => {
                this.queue.push(resolve)
            })
        }
    }

    async acquire() {
        if (this.count > 0) {
            this.count -= 1
        } else {
            await new Promise(resolve => {
                this.queue.push(resolve)
            })
        }
    }

    release() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift() as PromiseResolveFn
            resolve()
        } else {
            this.count += 1
        }
    }
}
