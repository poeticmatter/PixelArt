import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { renderAsset } from "../core/render.ts";
import { createTestAsset } from "../core/testAssets.ts";
import { encodePng } from "./png.ts";

const SIGNATURE_LENGTH = 8;
/** Length, type and CRC fields around each chunk payload. */
const CHUNK_OVERHEAD = 12;

interface Chunk {
  type: string;
  payload: Buffer;
}

function readChunks(png: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = SIGNATURE_LENGTH;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, payload: png.subarray(offset + 8, offset + 8 + length) });
    offset += length + CHUNK_OVERHEAD;
  }
  return chunks;
}

function getChunkPayload(chunks: Chunk[], type: string): Buffer {
  const chunk = chunks.find((candidate) => candidate.type === type);
  if (!chunk) {
    throw new Error(`PNG has no ${type} chunk.`);
  }
  return chunk.payload;
}

describe("encodePng", () => {
  const image = renderAsset(createTestAsset(), 2);
  const png = encodePng(image);
  const chunks = readChunks(png);

  it("starts with the PNG signature", () => {
    expect([...png.subarray(0, SIGNATURE_LENGTH)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("emits IHDR, IDAT and IEND in order", () => {
    expect(chunks.map((chunk) => chunk.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("records the image size as 8-bit RGBA", () => {
    const header = getChunkPayload(chunks, "IHDR");
    expect([header.readUInt32BE(0), header.readUInt32BE(4), header[8], header[9]]).toEqual([4, 4, 8, 6]);
  });

  it("stores the exact RGBA bytes losslessly", () => {
    const scanlines = inflateSync(getChunkPayload(chunks, "IDAT"));
    const rowLength = image.width * 4;
    const pixelRows = Array.from({ length: image.height }, (_, y) =>
      scanlines.subarray(y * (rowLength + 1) + 1, (y + 1) * (rowLength + 1)),
    );
    expect(Buffer.concat(pixelRows).equals(Buffer.from(image.data))).toBe(true);
  });
});
