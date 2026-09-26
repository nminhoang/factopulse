// Small QR code generator with no dependencies (works in Expo Go, and can also
// produce an SVG string for printing).
//
// Supports plain ASCII text up to 106 characters, byte mode, error correction
// level M (about 15% of the code can be damaged or dirty and it still scans),
// QR versions 1 to 6. Machine labels only need a few characters.

interface VersionSpec {
  /** error-correction codewords per block */
  ec: number;
  /** number of blocks */
  blocks: number;
  /** data codewords per block */
  data: number;
  /** alignment pattern centre coordinates */
  align: number[];
}

// Level M block layout for versions 1..6 (index 0 = version 1).
const VERSIONS: VersionSpec[] = [
  { ec: 10, blocks: 1, data: 16, align: [] },
  { ec: 16, blocks: 1, data: 28, align: [6, 18] },
  { ec: 26, blocks: 1, data: 44, align: [6, 22] },
  { ec: 18, blocks: 2, data: 32, align: [6, 26] },
  { ec: 24, blocks: 2, data: 43, align: [6, 30] },
  { ec: 16, blocks: 4, data: 27, align: [6, 34] },
];

export const QR_MAX_CHARS = VERSIONS[VERSIONS.length - 1].data * VERSIONS[VERSIONS.length - 1].blocks - 2;

// ---- Reed-Solomon error correction over GF(256) -------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsGenerator(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
}

// ---- Matrix drawing ------------------------------------------------------

function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function penaltyScore(m: boolean[][], size: number): number {
  let score = 0;

  // Rule 1: runs of 5+ same-colour modules in a row or column.
  for (let a = 0; a < size; a++) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        const cur = horizontal ? m[a][b] : m[b][a];
        const prev = horizontal ? m[a][b - 1] : m[b - 1][a];
        if (cur === prev) {
          run++;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
  }

  // Rule 2: 2x2 blocks of the same colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  }

  // Rule 3: patterns that look like a finder pattern.
  const p1 = [true, false, true, true, true, false, true, false, false, false, false];
  const p2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (let a = 0; a < size; a++) {
    for (let b = 0; b + 11 <= size; b++) {
      for (const horizontal of [true, false]) {
        let match1 = true;
        let match2 = true;
        for (let k = 0; k < 11; k++) {
          const v = horizontal ? m[a][b + k] : m[b + k][a];
          if (v !== p1[k]) match1 = false;
          if (v !== p2[k]) match2 = false;
        }
        if (match1) score += 40;
        if (match2) score += 40;
      }
    }
  }

  // Rule 4: balance of dark and light modules.
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encode plain ASCII text as a QR code. Returns a square matrix where
 * `true` is a dark module. Throws if the text is not ASCII or too long.
 */
export function encodeQr(text: string): boolean[][] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 127) throw new Error('QR text must be plain ASCII');
    bytes.push(c);
  }
  const vi = VERSIONS.findIndex((v) => v.data * v.blocks - 2 >= bytes.length);
  if (vi < 0) throw new Error(`QR text too long (max ${QR_MAX_CHARS} characters)`);
  const spec = VERSIONS[vi];
  const version = vi + 1;
  const size = version * 4 + 17;
  const totalData = spec.data * spec.blocks;

  // 1. Build the data bit stream: mode (byte), length, bytes, terminator, padding.
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, totalData * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    data.push(v);
  }
  for (let pad = 0xec; data.length < totalData; pad ^= 0xec ^ 0x11) data.push(pad);

  // 2. Error correction per block, then interleave.
  const gen = rsGenerator(spec.ec);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const blk = data.slice(b * spec.data, (b + 1) * spec.data);
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, gen));
  }
  const codewords: number[] = [];
  for (let i = 0; i < spec.data; i++) for (const blk of dataBlocks) codewords.push(blk[i]);
  for (let i = 0; i < spec.ec; i++) for (const blk of ecBlocks) codewords.push(blk[i]);

  // 3. Draw the fixed patterns.
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunction(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);
  const align = spec.align;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      const overlapsFinder =
        (i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0);
      if (overlapsFinder) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunction(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  const drawFormat = (mask: number) => {
    const fmt = 0b00 << 3 | mask; // error correction level M = 00
    let rem = fmt;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = ((fmt << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((fbits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(i));
    setFunction(8, size - 8, true); // always-dark module
  };
  drawFormat(0); // reserve the format areas so data is not drawn there

  // 4. Place the data bits in the zig-zag pattern.
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
          modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex++;
        }
      }
    }
  }

  // 5. Try all 8 masks, keep the best.
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && maskApplies(mask, x, y)) modules[y][x] = !modules[y][x];
      }
    }
  };
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = penaltyScore(modules, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    applyMask(mask); // undo
  }
  applyMask(bestMask);
  drawFormat(bestMask);
  return modules;
}

/** Convert a QR matrix to an SVG string (white background, black modules, quiet zone). */
export function qrToSvg(matrix: boolean[][], border = 4): string {
  const n = matrix.length + border * 2;
  let d = '';
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (matrix[y][x]) d += `M${x + border},${y + border}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
    `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  );
}
