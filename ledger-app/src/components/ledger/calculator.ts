export function evaluateCalculatorExpression(expressionText: string) {
  const source = expressionText
    .trim()
    .replaceAll(",", "")
    .replace(/\s+/g, "")
    .replaceAll("×", "*")
    .replaceAll("÷", "/");

  if (!source) throw new Error("계산식을 입력해 주세요.");
  if (!/^[\d()+\-*/.]+$/.test(source) || /\*\*|\/\/|\.\./.test(source)) {
    throw new Error("계산식에 숫자와 +, -, ×, ÷, 괄호만 사용할 수 있어요.");
  }

  let index = 0;

  function peek() {
    return source[index];
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = source[index];
      index += 1;
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const operator = source[index];
      index += 1;
      const right = parseFactor();
      if (operator === "/" && right === 0) throw new Error("계산 결과를 확인해 주세요.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    if (peek() === "+") {
      index += 1;
      return parseFactor();
    }
    if (peek() === "-") {
      index += 1;
      return -parseFactor();
    }
    if (peek() === "(") {
      index += 1;
      const value = parseExpression();
      if (peek() !== ")") throw new Error("계산식을 다시 확인해 주세요.");
      index += 1;
      return value;
    }
    const start = index;
    while (index < source.length && /[\d.]/.test(source[index] ?? "")) index += 1;
    if (start === index) throw new Error("계산식을 다시 확인해 주세요.");
    const value = Number(source.slice(start, index));
    if (!Number.isFinite(value)) throw new Error("계산 결과를 확인해 주세요.");
    return value;
  }

  const result = parseExpression();
  if (index !== source.length || !Number.isFinite(result)) {
    throw new Error("계산 결과를 확인해 주세요.");
  }
  const rounded = Math.round(result);
  if (rounded < 0) throw new Error("계산 결과는 0원 이상이어야 해요.");
  return rounded;
}
