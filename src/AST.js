// Abstract syntax tree
const ASTElementType = {
  NORMAL: Symbol("ASTElementType: NORMAL"),
  PLAINTEXT: Symbol("ASTElementType: PLAINTEXT")
};
class ASTElement {
  constructor(tag, type, text) {
    this.tag = tag;
    this.type = type;
    this.text = text;
    this.attrs = [];
    this.children = [];
  }
  addAttr(key, val) {
    this.attrs.push([key, val]);
  }
  addChild(child) {
    this.children.push(child);
  }
}
const parseHtml = function(html) {
  const stack = []; // 存放ASTElement的栈结构
  let root; // AST的根节点
  let currentElement; // 当前正在处理的ASTElemnt实例，stack的栈顶元素
  let index = 0;
  let currentTag;
  let self_closed = false;

  const advance = function(length) {
    index += length; // 保存当前html字符串解析位置
    html = html.substring(length);
  };

  const endTag = /^<\/([\w\-+]+)>/; // 结束标签正则表达式
  const startTag = {
    open: /^<([\w\-]+)/,
    close: /^\s*>/,
    attr: /^\s*([\w\-]+)(?:(=)(?:"([^"]*)"+))?/
  };

  const end = function() {
    stack.pop(); // 匹配到结束标签，将当前ASTElement弹出
    currentElement = stack[stack.length - 1];
  };

  const parseEndTag = function(tagName) {
    if (tagName !== currentTag) {
      // 自闭合标签
      stack.pop();
    }
    end();
  };

  const start = function(match) {
    if (!root) root = match;
    if (currentElement) currentElement.addChild(match);

    stack.push(match);
    currentElement = match;
  };

  const parseStartTag = function() {
    const start = html.match(startTag.open);
    if (start) {
      const astElement = new ASTElement(start[1], ASTElementType.NORMAL);
      //currentTag = start[1];
      advance(start[0].length);
      let end;
      let attr;
      //* 在遇到结束标签之前，将所有属性添加至元素实例中
      while (
        !(end = html.match(startTag.close)) &&
        (attr = html.match(startTag.attr))
      ) {
        advance(attr[0].length);
        astElement.addAttr(attr[1], attr[3]);
      }
      if (end) {
        advance(end[0].length);
        return astElement;
      }
    }
  };

  const handleStartTag = function(astElement) {
    start(astElement);
  };

  const chars = function(text) {
    // 生成文本节点
    if (/^\s*$/.test(text)) return;
    currentElement.addChild(
      new ASTElement(null, ASTElementType.PLAINTEXT, text)
    );
  };

  while (html) {
    const textEnd = html.indexOf("<");
    if (textEnd === 0) {
      // 判断 < 是不是第一个字符
      // 处理结束标签
      const endTagMatch = html.match(endTag);
      if (endTagMatch) {
        const curIndex = index;
        advance(endTagMatch[0].length); // 跳过结束标签
        parseEndTag(endTagMatch[1], curIndex, index);
        continue;
      }
      // 处理开始标签
      const startTagMatch = parseStartTag();
      if (startTagMatch) {
        handleStartTag(startTagMatch);
        continue;
      }
    }
    const text = html.substring(0, textEnd); // 将当前位置至下一个 < 字符之间的字符均作为文本处理
    advance(textEnd);
    if (text) chars(text); // 处理文本
  }
  return root;
};
const parseText = function(text) {
  const tagRE = /\{\{(.+?)\}\}/g; // +?懒惰匹配
  if (!text) return;
  if (!tagRE.test(text)) {
    // 若文本节点不存在{{}}包含的相关方法/变量，返回字符串
    return JSON.stringify(text);
  }
  tagRE.lastIndex = 0;
  const tokens = [];
  let lastIndex = 0;
  let match, index, tokenValue;
  while ((match = tagRE.exec(text))) {
    index = match.index; // 匹配到的字符串首位位置
    if (index > lastIndex) {
      tokenValue = text.slice(lastIndex, index); // 加入 {{ 之前的字符
      tokens.push(JSON.stringify(tokenValue));
    }
    tokens.push(`s_${match[1].trim()}`); // 加入 {{}} 中的字符
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    // 将剩余部分加入tokens中
    tokenValue = text.slice(lastIndex); // 加入最后一个 }} 之后的字符
    tokens.push(JSON.stringify(tokenValue));
  }
  return tokens.join("+"); // 将 a{{foo(c)}}b 转换为 a + foo(c) + b 形式
};
const parseHandler = function(handler) {
  console.log(handler, /^\w+$/.test(handler));
  if (/^\w+$/.test(handler)) return handler; // v-on-click: foo 形式
  return `function($event){${handler}}`; // v-on-click: foo($event, 1) 形式
};
const parseAttrs = function(attrs) {
  const attrsStr = attrs
    .map(pair => {
      const [k, v] = pair;
      if (k.indexOf("v-") === 0) {
        if (k.indexOf("v-on") === 0) {
          // 类似v-on-click的情况
          return `'${k}': ${parseHandler(v)}`;
        } else {
          // 类似v-class的情况
          return `'${k}': ${parseText(v)}`;
        }
      } else {
        return `'${k}': ${parseText(v)}`;
      }
    })
    .join(",");
  return `{${attrsStr}}`; // { attrstr: Array }
};
// 生成代码
const genElement = function(el) {
  if (el.type === ASTElementType.NORMAL) {
    if (el.children.length) {
      const childrenStr = el.children.map(c => genElement(c)).join(",");
      return `_c('${el.tag}', ${el.attrs}, [${childrenStr}])`;
    }
    return `_c('${el.tag}', ${el.attrs})`;
  } else if (el.type === ASTElementType.PLAINTEXT) { // 
    let match;
    const bRE = /^(?:s_)(.*)/;
    const val = el.text.split('+').map(e => {
      if (match = bRE.exec(e)) {
        return `_s('${match[1]}')`;
      } else {
        return e;
      }
    })
    return `_v(${val.join('+')})`;
  }
};
// 生成基本信息
const getRenderTree = function({ type, tag, text, attrs, children }) {
  return {
    type,
    tag,
    text: parseText(text),
    attrs: parseAttrs(attrs),
    children: children.map(x => getRenderTree(x))
  };
};
// 对抽象语法树进行处理
const generateRender = function(ast) {
  const code = genElement(getRenderTree(ast));
  return `with(this){return ${code} }`;
};
// const word = `<div>d{{ say(hi) }}b</div>`;

// console.log(generateRender(parseHtml(word)));

// ES6
export default{
  generateRender,
  parseHtml
};

// Node CommonJS
// module.exports = {
//   generateRender,
//   parseHtml
// }