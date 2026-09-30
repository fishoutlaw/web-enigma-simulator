/* Enigma Lab — Py-Enigma-derived engine; MIT notice in licenses/. */
(() => {
"use strict";
const module0 = (() => {
/*
 * Enigma Lab 계산 엔진
 * Py-Enigma 1.0.2 (Brian Neal, MIT)를 참고하여 JavaScript로 재작성했습니다.
 * 원본 고지: licenses/Py-Enigma-MIT.txt / https://github.com/gremmie/enigma
 *
 * 읽는 순서: 공통 함수 → Rotor → Plugboard → TraceRecorder → EnigmaMachine.
 * 화면·DOM·애니메이션에 의존하지 않습니다. press()가 한 문자를 계산하고,
 * 화면은 반환된 기록을 재생합니다. 기록 조회로 기계를 다시 움직이지 않습니다.
 */
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 계산은 0~25, 화면의 내부 접점 번호는 계산 값 + 1로 표시합니다.
// JavaScript의 음수 나머지를 보정합니다. 예: mod(-1) === 25.
const mod = number => ((number % 26) + 26) % 26;
const toIndex = letter => ABC.indexOf(letter);
const toLetter = number => ABC[mod(number)];
const clean = text => text.replace(/[^a-zA-Z]/g, '').toUpperCase();
const defaults = () => ({
  rotors: ['I', 'II', 'III'], start: 'AAA', rings: 'AAA', plugs: [], reflector: 'B',
});

// 배열의 순서는 왼쪽·가운데·오른쪽입니다.
// 배선 문자열의 n번째 글자 = 내부 입력 n이 연결된 출력 접점.
// 두 번째 값은 다른 로터에 회전을 전달하는 노치의 창 문자입니다.
const DATA = {
  I: ['EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q'],
  II: ['AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E'],
  III: ['BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V'],
  IV: ['ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J'],
  V: ['VZBRGITYUPSDNHLXAWMJQOFECK', 'Z'],
};
const ROTOR_NAMES = Object.freeze(Object.keys(DATA));
const REFLECTOR = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
const wiringMap = letters => [...letters].map(toIndex);
const contact = number => ({number, letter: toLetter(number)});
const validPosition = value => typeof value === 'string' && /^[A-Z]{3}$/.test(value);

function validate(config) {
  if (!config || !Array.isArray(config.rotors) || config.rotors.length !== 3 ||
      new Set(config.rotors).size !== 3 || config.rotors.some(name => !Object.hasOwn(DATA, name))) {
    throw new Error('로터 I~V 중 서로 다른 3개를 선택하세요.');
  }
  if (!validPosition(config.start) || !validPosition(config.rings)) {
    throw new Error('시작 위치와 링 설정은 각각 A~Z 세 글자여야 합니다.');
  }
  const plugs = config.plugs ?? [];
  const used = new Set();
  if (!Array.isArray(plugs) || plugs.length > 10) throw new Error('플러그는 최대 10쌍입니다.');
  for (const pair of plugs) {
    if (typeof pair !== 'string' || !/^[A-Z]{2}$/.test(pair) || pair[0] === pair[1] ||
        [...pair].some(letter => used.has(letter))) {
      throw new Error('플러그의 자기 연결 또는 중복 연결은 할 수 없습니다.');
    }
    for (const letter of pair) used.add(letter);
  }
  if (config.reflector && config.reflector !== 'B') throw new Error('반사판은 B만 지원합니다.');
  // 호출자가 원래 설정 객체를 바꾸어도 기계의 설정은 변하지 않게 복사합니다.
  return structuredClone({...config, plugs, reflector: 'B'});
}

class Rotor {
  constructor(name, ring, position) {
    this.name = name;
    this.ring = ring;
    this.window = toIndex(position);
    this.forward = wiringMap(DATA[name][0]);
    this.reverse = Array(26);
    // 복귀는 같은 배선을 거꾸로 통과합니다. 별도 배선표를 중복 작성하지 않습니다.
    this.forward.forEach((output, input) => { this.reverse[output] = input; });
    this.notch = DATA[name][1];
  }

  // 앱의 링은 A(0)로 고정합니다. 엔진은 기준 데이터 비교를 위해 링 계산도 지원합니다.
  // 창 위치와 링의 차이가 고정 외부 접점에서 회전 코어로 들어가는 오프셋입니다.
  get offset() { return mod(this.window - this.ring); }
  get position() { return toLetter(this.window); }
  atNotch() { return this.position === this.notch; }
  rotate() { this.window = mod(this.window + 1); }

  signal(input, back = false) {
    // ① 외부 좌표 → 내부 좌표 ② 실제 배선 통과 ③ 내부 좌표 → 외부 좌표.
    // 예: 창 B / 링 A이면 외부 A(0)는 내부 1(화면 2번)에 닿습니다.
    const internalInput = mod(input + this.offset);
    const internalOutput = (back ? this.reverse : this.forward)[internalInput];
    return {output: mod(internalOutput - this.offset), internalInput, internalOutput};
  }

  snapshot(index) {
    // 시각화도 signal()의 실제 계산을 사용하므로 그림 전용 암호화 공식이 없습니다.
    return {
      component: `rotor${index}`, name: this.name, position: this.position,
      ring: toLetter(this.ring), offset: this.offset, notch: [this.notch],
      connections: Array.from({length: 26}, (_, input) => {
        const signal = this.signal(input);
        return {input, output: signal.output,
          internal_input: signal.internalInput, internal_output: signal.internalOutput};
      }),
    };
  }
}

class Plugboard {
  constructor(pairs) {
    // 연결 없는 문자는 그대로 통과합니다. AB 연결은 A→B와 B→A를 동시에 만듭니다.
    this.map = Array.from({length: 26}, (_, index) => index);
    for (const pair of pairs) {
      const [a, b] = wiringMap(pair);
      this.map[a] = b;
      this.map[b] = a;
    }
  }
  signal(input) { return this.map[input]; }
}

class TraceRecorder {
  constructor() { this.steps = []; }
  add(component, name, direction, input, output, internal) {
    const step = {component, name, direction, input: contact(input), output: contact(output)};
    if (internal) Object.assign(step, {
      offset: internal.offset,
      internal_input: contact(internal.input), internal_output: contact(internal.output),
    });
    this.steps.push(step);
    // 기록한 출력을 다음 부품에 전달해 경로와 암호문을 같은 계산에서 만듭니다.
    return output;
  }
}

class EnigmaMachine {
  constructor(config, position) {
    this.config = validate(config);
    position = position ?? this.config.start;
    if (!validPosition(position)) throw new Error('현재 위치는 A~Z 세 글자여야 합니다.');
    this.rotors = this.config.rotors.map((name, index) =>
      new Rotor(name, toIndex(this.config.rings[index]), position[index]));
    this.plugboard = new Plugboard(this.config.plugs);
    this.reflector = wiringMap(REFLECTOR);
  }
  get position() { return this.rotors.map(rotor => rotor.position).join(''); }

  step() {
    // 반드시 회전 전 노치를 한꺼번에 판정합니다. 오른쪽 로터는 매 입력마다 회전합니다.
    // 오른쪽 노치 → 가운데 회전. 가운데 노치 → 가운데와 왼쪽 모두 회전.
    // 따라서 가운데 로터가 연속 두 입력에서 회전하는 더블 스테핑이 생깁니다.
    const middle = this.rotors[2].atNotch() || this.rotors[1].atNotch();
    const left = this.rotors[1].atNotch();
    this.rotors[2].rotate();
    if (middle) this.rotors[1].rotate();
    if (left) this.rotors[0].rotate();
  }

  snapshot() {
    return {rotors: this.rotors.map((rotor, index) => rotor.snapshot(index)),
      reflector: [...this.reflector], plugboard: [...this.plugboard.map]};
  }

  // 정방향과 역방향에서 반복되는 로터 통과·기록 처리를 한 함수로 묶습니다.
  passRotor(input, index, back, trace) {
    const rotor = this.rotors[index];
    const signal = rotor.signal(input, back);
    return trace.add(`rotor${index}`, rotor.name, back ? 'return' : 'forward', input,
      signal.output, {offset: rotor.offset, input: signal.internalInput, output: signal.internalOutput});
  }

  passPlugboard(input, back, trace) {
    return trace.add('plugboard', '플러그보드', back ? 'return' : 'forward',
      input, this.plugboard.signal(input));
  }

  press(key, experiment = '', sequence = 1) {
    if (typeof key !== 'string' || !/^[A-Z]$/.test(key)) throw new Error('A~Z 한 글자를 입력하세요.');
    const before = this.position;
    // 실제 기계처럼 로터가 먼저 움직이고, 그 위치의 배선으로 신호를 처리합니다.
    this.step();
    const after = this.position;
    const trace = new TraceRecorder();
    let signal = toIndex(key);
    signal = trace.add('input', '입력', 'forward', signal, signal);
    signal = this.passPlugboard(signal, false, trace);
    for (const index of [2, 1, 0]) signal = this.passRotor(signal, index, false, trace);
    signal = trace.add('reflector', 'B', 'reflect', signal, this.reflector[signal],
      {offset: 0, input: signal, output: this.reflector[signal]});
    for (const index of [0, 1, 2]) signal = this.passRotor(signal, index, true, trace);
    signal = this.passPlugboard(signal, true, trace);
    // 문자 변화가 없는 단계도 포함하여 총 10단계를 기록합니다.
    return {
      id: `${experiment}:${sequence}`, sequence, input: key, output: toLetter(signal), before, after,
      moved: [0, 1, 2].filter(index => before[index] !== after[index]),
      config: structuredClone(this.config), steps: trace.steps, wiring: this.snapshot(),
    };
  }
}

// 문장 처리도 press()를 반복합니다. 제외된 문자에는 press()를 호출하지 않습니다.
// 복호화는 시작 설정을 복원한 뒤 이 함수에 암호문을 입력하는 동일한 연산입니다.
function process(payload) {
  const text = payload.text ?? '';
  const sequence = payload.sequence ?? 0;
  const experiment = payload.experiment ?? '';
  if (typeof text !== 'string' || text.length > 500) throw new Error('한 번에 최대 500자를 입력하세요.');
  if (!Number.isSafeInteger(sequence) || sequence < 0 || typeof experiment !== 'string' || experiment.length > 100) {
    throw new Error('실험 번호가 올바르지 않습니다.');
  }
  const machine = new EnigmaMachine(payload.config, payload.position);
  const processed = clean(text);
  const records = [...processed].map((letter, index) => machine.press(letter, experiment, sequence + index + 1));
  return {experiment, processed, excluded: [...text].length - processed.length, records,
    position: machine.position, wiring: machine.snapshot(), cipher: records.map(record => record.output).join('')};
}

return {ABC, mod, toIndex, toLetter, clean, defaults, ROTOR_NAMES, validate, Rotor, Plugboard, TraceRecorder, EnigmaMachine, process};
})();
globalThis.EnigmaEngine = Object.freeze(module0);
})();
