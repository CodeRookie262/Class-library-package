(function (w, un) {
  'use strict';
  // 声明状态值
  const rejected = 'rejected',
    pending = 'pending',
    fulfilled = 'fulfilled';

  // 工具类
  const util = {
    // 判断是否是数组/类数组
    isArrayLike: function (arr) {
      return (
        !!arr &&
        'length' in arr &&
        typeof arr.length === 'number' &&
        arr.window !== w &&
        typeof arr !== 'function' &&
        typeof arr.nodeType !== 'number'
      );
    },
  };

  /**
   *
   * @param {Function} executor 执行器函数，接受两个参数 resolve | reject 分别管理 MyPromise 的状态
   *
   */
  function MyPromise(executor) {
    if (typeof executor !== 'function') {
      throw TypeError('MyPromise resolver undefined is not a function');
    }

    //内部数据状态初始化
    this.status = pending;
    this.result = un;
    this.resolveFun = function () {};
    this.rejectFun = function () {};

    // 切换状态的函数
    /**
     * resolve 成功状态切换函数
     * @param {any} res 成功时传入的参数，便于后续链式接收
     */
    function resolve(res) {
      change.call(this, fulfilled, res);
    }

    /**
     * reject 失败状态切换函数
     * @param {any} err  失败时传入的参数，便于后续链式接收
     */
    function reject(err) {
      change.call(this, rejected, err);
    }

    /**
     *
     * @param {String} status 需要切换的状态值
     * @param {any} result 切换状态后附带的结果
     */
    function change(status, result) {
      if (this.status !== pending) return false;
      this.status = status;
      this.result = result;
      var _that = this;

      // 用宏任务模拟微任务，进入 EventLoop 待定执行
      var timer = setTimeout(function () {
        clearTimeout(timer);
        if (_that.status === fulfilled) {
          _that.resolveFun(_that.result);
        } else {
          _that.rejectFun(_that.result);
        }
      }, 0);
    }

    // 执行 executor，传入 resolve，reject 供使用者灵活切换状态
    try {
      executor(resolve.bind(this), reject.bind(this));
    } catch (err) {
      // 如果 executor 在执行期间报错则更改为 rejected （PS: 前提是报错前没有进行其他状态切换，否则无效）
      change.call(this, rejected, err);
    }
  }

  // 静态方法
  /**
   * 生成一个失败状态的 MyPromise 类
   * @param {any} res
   */
  MyPromise.resolve = function (res) {
    return new MyPromise(function (resolve) {
      resolve(res);
    });
  };

  /**
   * 生成一个成功状态的 MyPromise 类
   * @param {any} res
   */
  MyPromise.reject = function (err) {
    return new MyPromise(function (_, reject) {
      reject(err);
    });
  };

  /**
   * @param {ArrayLike} MyPromises
   * ArrayLike [any | MyPromiseInstance]
   * 如果是 MyPromiseInstance 则会判断其状态，如果是其他类型则直接视为成功状态
   */
  MyPromise.all = function (MyPromises) {
    return allFun(MyPromises, true);
  };

  /**
   * @param {ArrayLike} MyPromises
   * ArrayLike [any | MyPromiseInstance]
   * 如果是 MyPromiseInstance 则会判断其状态，如果是其他类型则直接视为成功状态
   */
  MyPromise.allSettled = function (MyPromises) {
    return allFun(MyPromises, false);
  };

  /**
   * @param {ArrayLike} MyPromises
   * ArrayLike [any | MyPromiseInstance]
   * 如果是 MyPromiseInstance 则会判断其状态，如果是其他类型则直接视为成功状态
   */
  MyPromise.race = function (MyPromises) {
    if (util.isArrayLike(MyPromises)) {
      return new MyPromise(function (resolve, reject) {
        var len = MyPromises.length;
        for (var i = 0; i < len; i++) {
          if (MyPromises[i] instanceof MyPromise) {
            MyPromises[i].then(resolve, reject);
          } else {
            resolve(MyPromises[i]);
          }
        }
      });
    } else {
      throw TypeError(
        'MyPromises is not iterable (cannot read property Symbol(Symbol.iterator))'
      );
    }
  };

  function allFun(MyPromises, filter) {
    var res = [];
    // MyPromises => Array | ArrayLike
    if (util.isArrayLike(MyPromises)) {
      var len = MyPromises.length,
        curSuccess = 0;
      return new MyPromise(function (resolve, reject) {
        if (len === 0) resolve(res);
        for (var i = 0; i < len; i++) {
          (function (idx) {
            if (MyPromises[idx] instanceof MyPromise) {
              var watch = function (val) {
                res[idx] = val;
                if (++curSuccess === len) {
                  resolve(res);
                }
              };
              MyPromises[idx].then(watch, filter ? reject : watch);
            } else {
              res[idx] = MyPromises[idx];
              if (++curSuccess === len) {
                resolve(res);
              }
            }
          })(i);
        }
      });
    } else {
      throw TypeError(
        'MyPromises is not iterable (cannot read property Symbol(Symbol.iterator))'
      );
    }
  }

  /**
   *
   * @param {ArrayLike} MyPromises
   *
   * 特性：any 方法接受一个数组/类数组
   *        如果数组为空则返回一个 fulfilled 状态的 MyPromise
   *        如果存在多个 fulfilled 状态的 MyPromise 实例则优先取第一个
   *        如果所有的 MyPromise 实例都为 rejected 状态的话，则返回一个 rejected 的 MyPromise 实例
   */
  MyPromise.any = function (MyPromises) {
    if (util.isArrayLike(MyPromises)) {
      return new MyPromise(function (resolve, reject) {
        var len = MyPromises.length;
        var n = 0;
        var errSet = [];
        if (len === 0) resolve([]);
        // 遍历 MyPromise 数组
        for (var i = 0; i < len; i++) {
          if (MyPromises[i] instanceof MyPromise) {
            MyPromises[i].then(
              function (res) {
                resolve(res);
                n++;
              },
              function (err) {
                n++;
                errSet.push(err);
                if (n === len) {
                  reject(errSet);
                }
              }
            );
          } else {
            resolve(MyPromises[i]);
          }
        }
      });
    } else {
      throw TypeError(
        'MyPromises is not iterable (cannot read property Symbol(Symbol.iterator))'
      );
    }
  };

  // 原型方法
  MyPromise.prototype = {
    constructor: MyPromise,
    then: function (resCall, failCall) {
      var _that = this;
      return new MyPromise(function (resolve, reject) {
        // 如果 then 中的 resolve,reject 没有填写的话，状态会顺延到下一个 then 中
        if (typeof resCall !== 'function') {
          resCall = function (res) {
            return res;
          };
        }
        if (typeof failCall !== 'function') {
          failCall = function (err) {
            return err;
          };
        }
        _that.resolveFun = function (res) {
          var ret = resCall(res);
          if (ret instanceof MyPromise) return ret.then(resolve, reject);
          resolve(ret);
        };
        _that.rejectFun = function (err) {
          var ret = failCall(err);
          if (ret instanceof MyPromise) return ret.then(resolve, reject);
          reject(ret);
        };
      });
    },
    catch: function (failCall) {
      if (typeof failCall !== 'function')
        failCall = function (val) {
          return val;
        };
      var _that = this;
      return new Promise(function (resolve, reject) {
        _that.then(resolve, function (err) {
          var ret = failCall(err);
          if (ret instanceof MyPromise) return ret.then(resolve, reject);
          resolve(ret);
        });
      });
    },
    finally: function (callback) {
      var _that = this;
      return new MyPromise(function (resolve, reject) {
        if (typeof callback !== 'function') {
          return _that.then(resolve, reject);
        }
        var finallyCall = function (val) {
          var ret = callback(val);
          if (ret instanceof MyPromise) return ret.then(resolve, reject);
          resolve(ret);
        };
        _that.then(finallyCall, finallyCall);
      });
    },
  };

  // 让其支持浏览器导入和CommonJS/ES6Module模块导入规范
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = MyPromise;
  } else {
    w.MyPromise = MyPromise;
  }
})(typeof window !== 'undefinde' ? window : {}, undefined);
