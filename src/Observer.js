//* 为每个数组/对象数据创建一个Dep实例:
//* Dep实例中有depMap属性，key为数据属性的key，值为一个DepCollector数组，用于收集依赖；
//* Dep实例有两个方法：add和notify。add在getter过程中通过键添加watcher、
//* notify在setter过程中触发对应的watcher让它们重新求值并触发回调；
class Dep {
  constructor() {
    this.depMap = {};
  }
  //* 在getter过程中添加watcher
  add(key, watcher) {
    if (!watcher || !watcher instanceof Watcher) {
      return;
    }
    if (!this.depMap[key]) {
      this.depMap[key] = new DepCollector();
    }
    const inDep = this.depMap[key];
    watcher.setDepId(inDep.id);
    //* 重复的watcher不记录
    inDep.includes(watcher) ? "" : inDep.push(watcher);
  }
  notify(key, newVal) {
    if (!this.depMap[key]) return;
    this.depMap[key].updateList(watcher => watcher.run(newVal));
  }
}
let depCollectorId = 0;
class DepCollector {
  constructor() {
    const id = ++depCollectorId;
    this.id = id;
    DepCollector.map[id] = this;
    this.watList = [];
  }
  includes(watcher) {
    return this.watList.includes(watcher);
  }
  push(watcher) {
    this.watList.push(watcher);
  }
  updateList(cb) {
    this.watList.forEach(cb);
  }
  remove(watcher) {
    const index = this.watList.indexOf(watcher);
    if (index !== -1) {
      this.watList.splice(index, 1);
    }
  }
}
DepCollector.map = {};

let watcherId = 0;
class Watcher {
  /**
   *
   * @param {求值函数} func
   * @param {回调函数} cb
   */
  constructor(func, cb) {
    this.id = ++watcherId;
    this.func = func;
    this.cb = cb;
  }
  eval() {
    this.depIds = this.newDepIds;
    this.newDepIds = {};
    // 栈形式
    pushWatcher(this);
    this.value = this.func(); // 缓存新值
    popWatcher();
    this.clearDeps();
  }
  setDepId(id) {
    this.newDepIds = {};
    this.newDepIds[id] = true;
  }
  clearDeps() {
    // 移除无用的依赖
    for (let depId in this.depIds) {
      if (!this.newDepIds[depId]) {
        DepCollector.map[depId].remove(this);
      }
    }
  }
  //* 异步更新队列
  //* dep.notify() -> depCol.updateList() -> watcher.queue() ->
  //* queueWatcher() -> nextTick() -> flushSchedulerQueue() -> watcher.run() ->
  //* watcher.eval(), watcher.cb()
  queue() {
    queueWatcher(this);
  }
  run() {
    const oldVal = this.value;
    this.eval(); // 重新计算并搜集依赖
    this.cb(oldVal, this.value);
  }
}
let currentWatcheres = []; // 栈 computed属性
let currentWatcher = null;
const pushWatcher = function(watcher) {
  currentWatcheres.push(watcher);
  currentWatcher = watcher;
};
const popWatcher = function(watcher) {
  currentWatcheres.pop();
  currentWatcher =
    currentWatcheres.length > 0
      ? currentWatcheres[currentWatcheres.length - 1]
      : null;
};

function watch(func, cb) {
  const watcher = new Watcher(func, cb);
  watcher.eval();
  return watcher;
}

const nextTickCbs = [];
const nextTick = function(cb) {
  nextTickCbs.push(cb);
  if (nextTickCbs.length === 1) {
    requestIdleCallback(() => {
      nextTickCbs.forEach(cb => cb());
      nextTickCbs.length = 0;
    });
  }
};
//* 要更新的watcher队列（来自不同DepCol）
const queue = [];
let has = {};
let waiting = false;
let flushing = false;
let index = 0;
const queueWatcher = function(watcher) {
  const id = watcher.id;
  //* 避免重复添加多个相同watcher
  if (has[id]) {
    return;
  }
  has[id] = true;
  //* 若还没进入下一个event loop
  if (!flushing) {
    queue.push(watcher);
  } else {
    let i = queue.length - 1;
    while (i > index && queue[i].id > watcher.id) {
      i--;
    }
    //* 按照id大小顺序插入queue中
    queue.splice(i + 1, 0, watcher);
    if (waiting) return;
    //* 开始执行
    waiting = true;
    nextTick(flushSchedulerQueue);
  }
};
const flushSchedulerQueue = function() {
  flushing = true;
  let watcher, id;
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index];
    id = watcher.id;
    has[id] = false;
    watcher.run();
  }
  //* 清空队列
  index = queue.length = 0;
  has = {};
  waiting = flushing = false;
};
/**
 *
 * @param {需要代理的对象} target
 * 通过递归对内层数据进行代理
 */
const KEY_DEP = Symbol("KEY_DEP");
const KEY_DEP_ARRAY = Symbol("KEY_DEP_ARRAY");
function proxy(target = {}) {
  const dep = target[KEY_DEP] || new Dep();
  Object.keys(target).forEach(key => {
    const child = target[key];
    if (child && typeof child === "object") {
      target[key] = proxy(child);
    }
  });
  return _proxyObject(target, dep, Array.isArray(target));
}
/**
 *
 * @param {需要被代理的对象} target
 */
function _proxyObject(target, dep, isArray) {
  //* 通过闭包保存dep
  const data = new Proxy(target, {
    get(that, key) {
      //* currentWatcher指向当前在求值的watcher
      key === KEY_DEP
        ? ""
        : dep.add(isArray ? KEY_DEP_ARRAY : key, currentWatcher);
      return that[key];
    },
    set(target, key, val) {
      if (key === KEY_DEP) {
        return;
      } else {
        target[key] = typeof val === "object" ? proxy[val] : val;
        dep.notify(isArray ? KEY_DEP_ARRAY : key, val);
        return true;
      }
    }
  });
  return data;
}


const data = proxy({
  a: 1,
  b: 2
});

watch(() => {
  console.log(data.a + data.b + " hi!");
}, () => {
  console.log('fine');
})

export default{
  proxy,
  watch
};
// module.exports = {
//   proxy,
//   watch
// }
