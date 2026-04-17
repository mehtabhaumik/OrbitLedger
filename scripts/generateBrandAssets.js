const fs = require('fs');
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const palette = {
  primary: [20, 92, 82, 255],
  primaryDark: [13, 70, 63, 255],
  primarySurface: [229, 241, 237, 255],
  background: [246, 248, 247, 255],
  paper: [255, 255, 255, 255],
  line: [214, 224, 218, 255],
  lineStrong: [180, 197, 188, 255],
  due: [163, 72, 58, 255],
  paid: [36, 122, 80, 255],
  transparent: [0, 0, 0, 0],
};

function createCanvas(width, height, fill = palette.transparent) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = fill[0];
    pixels[offset + 1] = fill[1];
    pixels[offset + 2] = fill[2];
    pixels[offset + 3] = fill[3];
  }
  return { width, height, pixels };
}

function drawPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const offset = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.pixels[offset] = color[0];
  canvas.pixels[offset + 1] = color[1];
  canvas.pixels[offset + 2] = color[2];
  canvas.pixels[offset + 3] = color[3];
}

function drawRect(canvas, x, y, width, height, color) {
  x = Math.round(x);
  y = Math.round(y);
  width = Math.round(width);
  height = Math.round(height);
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      drawPixel(canvas, column, row, color);
    }
  }
}

function drawRoundedRect(canvas, x, y, width, height, radius, color) {
  x = Math.round(x);
  y = Math.round(y);
  width = Math.round(width);
  height = Math.round(height);
  radius = Math.round(radius);
  const right = x + width - 1;
  const bottom = y + height - 1;
  for (let row = y; row <= bottom; row += 1) {
    for (let column = x; column <= right; column += 1) {
      const dx = column < x + radius ? x + radius - column : column > right - radius ? column - (right - radius) : 0;
      const dy = row < y + radius ? y + radius - row : row > bottom - radius ? row - (bottom - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius) {
        drawPixel(canvas, column, row, color);
      }
    }
  }
}

function drawEllipseStroke(canvas, centerX, centerY, radiusX, radiusY, strokeWidth, color) {
  const left = Math.floor(centerX - radiusX - strokeWidth);
  const right = Math.ceil(centerX + radiusX + strokeWidth);
  const top = Math.floor(centerY - radiusY - strokeWidth);
  const bottom = Math.ceil(centerY + radiusY + strokeWidth);

  for (let row = top; row <= bottom; row += 1) {
    for (let column = left; column <= right; column += 1) {
      const normalized =
        ((column - centerX) * (column - centerX)) / (radiusX * radiusX) +
        ((row - centerY) * (row - centerY)) / (radiusY * radiusY);
      if (Math.abs(normalized - 1) <= strokeWidth / Math.max(radiusX, radiusY)) {
        drawPixel(canvas, column, row, color);
      }
    }
  }
}

function drawOrbitCue(canvas, centerX, centerY, scale, color) {
  drawEllipseStroke(canvas, centerX, centerY, 268 * scale, 118 * scale, 9 * scale, color);
  drawRoundedRect(canvas, centerX + 220 * scale, centerY - 28 * scale, 34 * scale, 34 * scale, 17 * scale, color);
}

function drawLedgerMark(canvas, originX, originY, scale) {
  drawRoundedRect(canvas, originX, originY, 464 * scale, 584 * scale, 38 * scale, palette.paper);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 64 * scale, 212 * scale, 42 * scale, 18 * scale, palette.primary);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 150 * scale, 364 * scale, 18 * scale, 9 * scale, palette.lineStrong);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 230 * scale, 364 * scale, 18 * scale, 9 * scale, palette.line);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 310 * scale, 364 * scale, 18 * scale, 9 * scale, palette.line);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 390 * scale, 364 * scale, 18 * scale, 9 * scale, palette.line);
  drawRoundedRect(canvas, originX + 50 * scale, originY + 470 * scale, 156 * scale, 20 * scale, 10 * scale, palette.paid);
  drawRoundedRect(canvas, originX + 298 * scale, originY + 462 * scale, 116 * scale, 34 * scale, 17 * scale, palette.due);
}

function createIcon() {
  const canvas = createCanvas(1024, 1024, palette.primary);
  drawRoundedRect(canvas, 126, 126, 772, 772, 172, palette.primaryDark);
  drawRoundedRect(canvas, 164, 164, 696, 696, 140, palette.primary);
  drawOrbitCue(canvas, 512, 502, 1, palette.primarySurface);
  drawLedgerMark(canvas, 280, 220, 1);
  return canvas;
}

function createAdaptiveIcon() {
  const canvas = createCanvas(1024, 1024, palette.transparent);
  drawOrbitCue(canvas, 512, 502, 1, palette.primarySurface);
  drawLedgerMark(canvas, 280, 220, 1);
  return canvas;
}

function createSplashIcon() {
  const canvas = createCanvas(1024, 1024, palette.transparent);
  drawOrbitCue(canvas, 512, 520, 0.88, palette.primarySurface);
  drawLedgerMark(canvas, 330, 250, 0.78);
  return canvas;
}

function createFavicon() {
  const canvas = createCanvas(48, 48, palette.primary);
  drawEllipseStroke(canvas, 24, 24, 16, 7, 1.4, palette.primarySurface);
  drawRoundedRect(canvas, 14, 10, 21, 28, 3, palette.paper);
  drawRoundedRect(canvas, 17, 14, 10, 3, 2, palette.primary);
  drawRect(canvas, 17, 21, 15, 2, palette.lineStrong);
  drawRect(canvas, 17, 27, 15, 2, palette.line);
  drawRect(canvas, 17, 33, 8, 2, palette.paid);
  return canvas;
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(canvas) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let row = 0; row < canvas.height; row += 1) {
    const sourceStart = row * canvas.width * 4;
    const targetStart = row * (canvas.width * 4 + 1);
    raw[targetStart] = 0;
    canvas.pixels.copy(raw, targetStart + 1, sourceStart, sourceStart + canvas.width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeAsset(path, canvas) {
  fs.writeFileSync(path, encodePng(canvas));
}

writeAsset('assets/icon.png', createIcon());
writeAsset('assets/adaptive-icon.png', createAdaptiveIcon());
writeAsset('assets/splash-icon.png', createSplashIcon());
writeAsset('assets/favicon.png', createFavicon());
