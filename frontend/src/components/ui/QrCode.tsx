type QrCodeProps = { value: string; label: string; className?: string };

const SIZE = 21;

function multiply(a: number, b: number) {
  let result = 0;
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
}

function divisor(degree: number) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function createMatrix(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 17) throw new Error("QR content exceeds version 1-L capacity");

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, 152 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; data.length < 19; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  const generator = divisor(7);
  const remainder = Array(7).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);
    for (let i = 0; i < remainder.length; i += 1) remainder[i] ^= multiply(generator[i], factor);
  }
  const codewords = [...data, ...remainder];
  const matrix: Array<Array<boolean | null>> = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  function setFunction(x: number, y: number, dark: boolean) {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) matrix[y][x] = dark;
  }

  function finder(cx: number, cy: number) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setFunction(x, y, dark);
      }
    }
  }

  finder(0, 0);
  finder(SIZE - 7, 0);
  finder(0, SIZE - 7);
  for (let i = 8; i < SIZE - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Error correction level L, mask pattern 0.
  const formatData = 0b01000;
  let remainderBits = formatData;
  for (let i = 0; i < 10; i += 1) remainderBits = (remainderBits << 1) ^ (((remainderBits >>> 9) & 1) * 0x537);
  const format = ((formatData << 10) | remainderBits) ^ 0x5412;
  const formatBit = (i: number) => ((format >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i += 1) setFunction(8, i, formatBit(i));
  setFunction(8, 7, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(7, 8, formatBit(8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i += 1) setFunction(SIZE - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i += 1) setFunction(8, SIZE - 15 + i, formatBit(i));
  setFunction(8, SIZE - 8, true);

  let bitIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < SIZE; vert += 1) {
      const y = upward ? SIZE - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (matrix[y][x] !== null) continue;
        const rawBit = bitIndex < codewords.length * 8
          ? ((codewords[Math.floor(bitIndex / 8)] >>> (7 - (bitIndex % 8))) & 1) !== 0
          : false;
        matrix[y][x] = rawBit !== ((x + y) % 2 === 0);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  return matrix as boolean[][];
}

export default function QrCode({ value, label, className = "" }: QrCodeProps) {
  const matrix = createMatrix(value);
  const path = matrix.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x} ${y}h1v1h-1z`] : [])).join("");

  return (
    <svg className={className} viewBox="-2 -2 25 25" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width="25" height="25" fill="#fff" />
      <path d={path} fill="#111827" />
    </svg>
  );
}
