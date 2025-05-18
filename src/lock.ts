type LockType = 'r' | 'w' | 'rw';
type LockState = { msg: string; data: any };

class Lock {
  private queue: { type: LockType | 'r+'; resolve: (lock: any) => void }[] = [];
  private currentLock: { type: LockType; count: number | null } | null = null;
  private state: LockState = { msg: '', data: null };
  private hasRPlus: boolean = false;
  /**
   * 请求一个锁，并返回一个Promise，该Promise解析为包含解锁方法、设置方法和锁类型的对象。你必须及时调用其中的unlock方法来释放锁，否则锁会卡死。
   * - 读锁本质上不是互斥的，场上可以同时存在多个读锁和一个写锁，场上不能同时存在多个写锁或读写锁，场上存在读写锁时，其他锁均会被锁定（这与大部分只理解读/写锁的ai的理解不同，这里的逻辑为读尽量不阻塞，除非遇到读写锁）。
   * - 可插队的读锁通常不会被锁定，除非刚好遇到了读写锁正在进行，普通读锁在遇到超过一个写锁后会排队（只有一个写锁时不会锁定）
   * 
   * 用法：
   * ```
   * const readLock = await lock.lock();// 请求一个可插队的读锁（'r': 读锁，'w': 写锁，'rw': 读写锁，'r+': 可插队的读锁）
   * // 这里可以进行一些操作，比如读取数据，更新数据等。
   * readLock.set({ msg: "Finished read+ing", data: null }); // 使用锁期间可以设置锁的状态，以便其他异步代码读取进度等信息。
   * console.log(readLock.type, lock.get().type); // readLock.type将得到这个锁的类型，lock.get().type得到当前最强锁的类型。
   * readLock.unlock(); // 你必须及时的调用unlock来释放锁，否则锁会卡死。
   * ```
   * 
   * @param type 锁的类型，可以是'r'（读锁）、'w'（写锁）、'rw'（读写锁）或'r+'（可插队的读锁，默认值）。
   * @returns 返回一个Promise，解析为一个对象，包含解锁方法（unlock）、设置方法（set）和锁类型（type）。
   */
  lock(type: 'r' | 'w' | 'rw' | 'r+' = 'r+'): Promise<{ unlock: () => void; set: (state: LockState) => void; type: LockType | 'r+' }> {
    return new Promise((resolve) => {
      if (type === 'r+' && this.currentLock?.count && this.currentLock?.count > 0 && (this.currentLock?.type === 'r' || this.currentLock?.type === 'w')) {
        //如果是r+且可以插队时，那么插队
        this.currentLock.count++;
        resolve({
          unlock: () => this.unlock('r'),
          set: this.set.bind(this),
          type: 'r+'
        });
      }
      else {
        if (type === 'r+') {
          this.hasRPlus = true;
        }
        this.queue.push({ type, resolve });
        this.checkQueue();
      }
    });
  }

  private checkQueue() {
    if (this.queue.length === 0) return;

    const next = this.queue[0];
    if (!this.currentLock || !this.currentLock?.count) {
      this.currentLock = { type: next.type === 'r+' ? 'r' : next.type, count: 1 };
      this.queue.shift();
      //再次检查队列，如果下一个也是读，那么加进来
      this.checkQueue();
      next.resolve({
        unlock: () => this.unlock(next.type === 'r+' ? 'r' : next.type),
        set: this.set.bind(this),
        type: next.type
      });
    } else if (this.currentLock.type === 'rw') {
      //读写锁时不可以加入任何新的锁
      // 什么都不做，等待rw释放
    } else if (this.currentLock.type === 'w') {
      //写锁时可以加入新的读锁，不能加入新的写锁或读写锁
      if (next.type === 'r') {
        this.currentLock.count++;
        this.queue.shift();
        //再次检查队列，如果下一个也是读，那么加进来
        this.checkQueue();
        next.resolve({
          unlock: () => this.unlock(next.type === 'r+' ? 'r' : next.type),
          set: this.set.bind(this),
          type: next.type
        });
      }
    } else if (this.currentLock.type === 'r') {
      //读锁时可以加入新的读锁或写锁（但写锁只能加入一次），不能加入读写锁
      if (next.type === 'r') {
        this.currentLock.count++;
        this.queue.shift();
        //再次检查队列，如果下一个也是读，那么加进来
        this.checkQueue();
        next.resolve({
          unlock: () => this.unlock(next.type === 'r+' ? 'r' : next.type),
          set: this.set.bind(this),
          type: next.type
        });
      } else if (next.type === 'w') {
        this.currentLock.type = 'w';
        this.currentLock.count++;
        this.queue.shift();
        //再次检查队列，如果下一个也是读，那么加进来
        this.checkQueue();
        next.resolve({
          unlock: () => this.unlock(next.type === 'r+' ? 'r' : next.type),
          set: this.set.bind(this),
          type: next.type
        });
      }
    }
    if (this.hasRPlus) {
      //遍历队列，如果存在r+，且可以插队，那么插队
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        if (item.type === 'r+' && this.currentLock?.count && this.currentLock?.count > 0 && (this.currentLock?.type === 'r' || this.currentLock?.type === 'w')) {
          //如果是r+且可以插队时，那么插队
          this.currentLock.count++;
          this.queue.splice(i, 1);
          item.resolve({
            unlock: () => this.unlock('r'),
            set: this.set.bind(this),
            type: 'r+'
          });
        }
      }
      if (this.get()['r+'] === 0) {
        this.hasRPlus = false;
      }
    }
  }

  unlock(type: LockType) {
    if (!this.currentLock) return;

    if (this.currentLock.count && this.currentLock.count > 1) {
      this.currentLock.count--;
    } else {
      this.currentLock.count = null;
    }

    if (this.currentLock?.type === type) {
      this.currentLock.type = 'r';
    }

    // 解锁后再次检查队列
    this.checkQueue();
  }

  set(state: LockState) {
    this.state = state;
  }

  /**
 * 获取当前资源的状态和锁信息以及队列计数
 * 
 * 此方法通过合并当前锁信息、状态和队列中每种类型操作的计数，
 * 提供了一个快照式的视图，用于诊断和监控目的。
 * 
 * @returns {Object} 返回一个对象，包含以下字段：
 * - `type` (string): 当前锁的类型，可以是'r'（读锁）、'w'（写锁）、'rw'（读写锁），对于“可插队的读锁”在这里因为锁已开始运行因此返回为'r'而非'r+'。
 * - `count` (number): 当前锁的计数，表示当前锁的并发数量。
 * - `msg` (string): 当前锁的状态信息，由.set()方法设置的。
 * - `data` (any): 当前锁的状态数据，由.set()方法设置的。
 * - `r` (number): 队列中读取操作的数量。
 * - `w` (number): 队列中写入操作的数量。
 * - `rw` (number): 队列中读写操作的数量。
 * - `r+` (number): 队列中追加读取操作的数量。
 */
  get() {
    const queueCounts = this.queue.reduce(
      (acc, curr) => {
        acc[curr.type]++;
        return acc;
      },
      { r: 0, w: 0, rw: 0, 'r+': 0 }
    );

    return {
      ...this.currentLock,
      ...this.state,
      ...queueCounts
    };
  }
}

export default Lock;