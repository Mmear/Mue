import { Mue } from './Mue'
const testEle = document.createElement('div');
const opts = {
  el: '#app',
  data() {
    return {
      a: 'Mue',
    }
  },
  tpl: `<div>{{ a }}</div>`,
  methods: {
    say() {
      console.log('hi');
    }
  }
}
const ins = new Mue(opts);
setTimeout(() => {
  ins.a = 'Que'
}, 5000);
