export class StateMachine {
  constructor(initial = 'idle'){
    this.state = initial;
    this.listeners = new Set();
  }

  onChange(fn){
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(state){
    if(this.state === state) return;
    const prev = this.state;
    this.state = state;
    for(const l of this.listeners) l(this.state, prev);
  }

  get(){ return this.state }
}
