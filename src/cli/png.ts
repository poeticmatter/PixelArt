import { deflateSync } from "node:zlib";

import type { RgbaImage } from "../core/render.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BIT_DEPTH = 8;
const COLOR_TYPE_RGBA = 6;
const FILTER_NONE = 0;
const BYTES_PER_PIXEL = 4;

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let byte = 0; byte < 256; byte++) {
    let crc = byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[byte] = crc >>> 0;
  }
  return table;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, payload: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const typeAndPayload = Buffer.concat([Buffer.from(type, "ascii"), payload]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndPayload));
  return Buffer.concat([length, typeAndPayload, checksum]);
}

function createHeaderPayload(image: RgbaImage): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.writeUInt8(BIT_DEPTH, 8);
  header.writeUInt8(COLOR_TYPE_RGBA, 9);
  // Bytes 10-12: compression, filter and interlace methods, all 0 (the only standard values).
  return header;
}

/** PNG requires a filter-type byte at the start of every scanline. */
function toFilteredScanlines(image: RgbaImage): Buffer {
  const rowLength = image.width * BYTES_PER_PIXEL;
  const scanlines = Buffer.alloc(image.height * (rowLength + 1));
  for (let y = 0; y < image.height; y++) {
    const targetOffset = y * (rowLength + 1);
    scanlines[targetOffset] = FILTER_NONE;
    scanlines.set(image.data.subarray(y * rowLength, (y + 1) * rowLength), targetOffset + 1);
  }
  return scanlines;
}

/** Encodes an RGBA image as a lossless 8-bit RGBA PNG. */
export function encodePng(image: RgbaImage): Buffer {
  return Buffer.concat([
    PNG_SIGNATURE,
    createChunk("IHDR", createHeaderPayload(image)),
    createChunk("IDAT", deflateSync(toFilteredScanlines(image))),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}
