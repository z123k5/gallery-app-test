import Lock from "./lock.ts";
const lock = new Lock();

async function performReadAddOperation() {
    const readLock = await lock.lock();
    console.log("Start read+ing...");
    // 模拟读取操作
    await new Promise(resolve => setTimeout(resolve, 2000));
    readLock.set({ msg: "Finished read+ing", data: null });
    console.log("read+ end", readLock.type, lock.get().type);
    readLock.unlock();
}

async function performReadOperation() {
    const readLock = await lock.lock('r');
    console.log("Start reading...");
    // 模拟读取操作
    await new Promise(resolve => setTimeout(resolve, 2000));
    readLock.set({ msg: "Finished reading", data: null });
    console.log("read end", readLock.type, lock.get().type);
    readLock.unlock();
}

async function performWriteOperation() {
    const writeLock = await lock.lock('w');
    console.log("Start writing...");
    // 模拟写入操作
    await new Promise(resolve => setTimeout(resolve, 2000));
    writeLock.set({ msg: "Finished writing", data: null });
    console.log("write end", writeLock.type, lock.get().type);
    writeLock.unlock();
}

async function performReadWriteOperation() {
    const readWriteLock = await lock.lock('rw');

    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());

    console.log("Start reading and writing...");
    // 模拟读取和写入操作
    await new Promise(resolve => setTimeout(resolve, 2000));
    readWriteLock.set({ msg: "Finished reading and writing", data: null });
    console.log("readWrite end", readWriteLock.type, lock.get().type);
    readWriteLock.unlock();
}

async function lockTest() {
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Write...");
    performWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Write...");
    performWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting ReadWrite...");
    performReadWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Write...");
    performWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Write...");
    performWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log(lock.get());
    console.log("Starting Read+...");
    performReadAddOperation();
    console.log(lock.get());
    console.log("Starting Write...");
    performWriteOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
    console.log("Starting Read...");
    performReadOperation();
    console.log(lock.get());
}

export default lockTest;