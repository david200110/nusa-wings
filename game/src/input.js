// Nusa Wings — keyboard and mouse input. One shared state object; the
// flight model reads it every frame. Keys are tracked by code so layout
// does not matter, and every handled key also fires a one-shot "pressed"
// event the game loop consumes (pause, view toggle, gear, restart).

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.lookX = 0; // accumulated camera look offset, radians
    this.lookY = 0;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = () => { this.mouseDown = true; };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onMouseMove = (e) => {
      if (!this.mouseDown) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once, on the frame the key went down; consumed by endFrame().
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Control axes, each in [-1, 1].
  get pitchAxis() {
    return (this.down('ArrowDown') ? 1 : 0) - (this.down('ArrowUp') ? 1 : 0);
  }

  get rollAxis() {
    return (this.down('ArrowRight') ? 1 : 0) - (this.down('ArrowLeft') ? 1 : 0);
  }

  get yawAxis() {
    return (this.down('KeyD') ? 1 : 0) - (this.down('KeyA') ? 1 : 0);
  }

  get throttleUp() {
    return this.down('KeyW', 'ShiftLeft', 'ShiftRight');
  }

  get throttleDown() {
    return this.down('KeyS', 'ControlLeft', 'ControlRight');
  }

  // Drain the mouse deltas into the look offset, then clear them.
  consumeLook() {
    this.lookX = Math.max(-1.2, Math.min(1.2, this.lookX - this.mouseDX * 0.0035));
    this.lookY = Math.max(-0.5, Math.min(0.5, this.lookY - this.mouseDY * 0.0025));
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  endFrame() {
    this.pressed.clear();
  }
}
