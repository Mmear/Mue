import Ast from "./AST";
import Obs from "./Observer";
console.log(Ast);
class VNode {
  constructor(tag, attrs, text, children) {
    this.tag = tag;
    this.attrs = attrs;
    this.text = text;
    this.children = children;
  }
}
const build = function(vNode) {
  if (!vNode.tag && vNode.text)
    return (vNode.$el = document.createTextNode(vNode.text));
  if (vNode.tag) {
    const $el = document.createElement(vNode.tag);
    handleAttrs(vNode, $el);
    vNode.children.forEach(child => {
      $el.appendChild(build(child));
    });
    return (vNode.$el = $el);
  }
};
const handleAttrs = function({ attrs }, $el, preAttrs = {}) {
  // 处理vNode中的class属性
  if (
    preAttrs.class !== attrs.class ||
    preAttrs["v-class"] !== attrs["v-class"]
  ) {
    let clsStr = "";
    if (attrs.class) clsStr += attrs.class;
    if (attrs["v-class"]) clsStr += " " + attrs["v-class"];
    $el.className = clsStr;
  }
  if (attrs["v-on-click"] !== preAttrs["v-on-click"]) {
    // 匿名函数永远不相等
    if (attrs["v-on-click"]) $el.onclick = attrs["v-on-click"];
  }
};
const patch = function(preVode, vNode) {
  if (preVode.tag === vNode.tag) {
    vNode.$el = preVode.$el;
    if (vNode.text) {
      if (vNode.text !== preVode.text) vNode.$el.textContent = vNode.text;
    } else {
      vNode.$el = preVode.$el;
      preVode.children.forEach((preChild, i) => {
        patch(preChild, vNode.children[i]);
      });
      handleAttrs(vNode, vNode.$el, preVode.attrs);
    }
  } else {
    // 新老v-dom树结构不同时
  }
};

class Mue {
  /**
   *
   * @param {实例渲染的父节点} el
   * @param {一个函数，运行后将返回一个对象/数组，作为实例的数据} data
   * @param {实例的模板字符串} tpl
   * @param {实例方法} methods
   */
  constructor({ el, data, tpl, methods }) {
    // set render
    if (el instanceof Element) {
      this.$el = el;
    } else {
      this.$el = document.querySelector(el);
    }
    const ast = Ast.parseHtml(tpl);
    const renderCode = Ast.generateRender(ast);
    this.render = new Function(renderCode);
    // set data
    this.data = Obs.proxy(data.call(this));
    // set data proxy
    const proxyObj = new Proxy(this, {
      get(target, key) {
        return key in target.data ? target.data[key] : target[key];
      },
      set(target, key, val) {
        if (!(key in target.data) && key in target) {
          target[key] = val;
        } else {
          target.data[key] = val;
        }
        return true;
      }
    });
    this._proxyObj = proxyObj;
    // bind methods to proxy instance
    Object.keys(methods).forEach(m => {
      this[m] = methods[m].bind(proxyObj);
    });
    //watch
    const updateComponent = () => {
      // 求值函数，用于完成首次渲染工作
      this._update(this._render());
    };
    Obs.watch(updateComponent, () => {

    }); // 收集依赖
  }

  _update(vNode) {
    const preVode = this.preVode;
    if (preVode) {
      // 更新v-dom树
      patch(preVode, vNode);
    } else {
      // 进行第一次浏览器渲染
      this.preVode = vNode;
      this.$el.appendChild(build(vNode));
    }
  }

  _render() {
    // 调用render方法构建一颗VNode树，with作用域绑定_proxyObj
    return this.render.call(this._proxyObj);
  }

  _c(tag, attr, children) {
    return new VNode(tag, attr, null, children);
  }

  _v(text) {
    return new VNode(null, null, text, null);
  }
  
  _s(key) {
    const fnRE = /(.*)\(?:(.*)\)/;
    const match = fnRE.exec(key);
    if (match) {
      // 匹配到方法
      if (this[match[1]] && typeof this[match[1]] === "function") {
        this[match[1]].call(this._proxyObj, this[match[2]]);
      }
    }
    return this[key];
  }
}
Mue.new = function(opts) {
  return new Vue(opts)._proxyObj;
};

export { Mue };
