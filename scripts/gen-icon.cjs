// 生成应用图标 (256x256 PNG → ICO)
// 需要在安装了 sharp 的环境下运行

const sharp = require('sharp');

// 生成一个简约的收银系统图标
// 金色渐变背景 + 白色 ¥ 符号
const size = 256;
const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F59E0B"/>
      <stop offset="100%" style="stop-color:#D97706"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.2"/>
    </filter>
  </defs>
  <!-- 圆角矩形背景 -->
  <rect width="${size}" height="${size}" rx="48" ry="48" fill="url(#bg)"/>
  <!-- 白色 ¥ 符号 -->
  <g filter="url(#shadow)">
    <text x="${size/2}" y="${size/2 + 42}" text-anchor="middle"
          font-family="Arial, sans-serif" font-weight="bold" font-size="140" fill="white">¥</text>
  </g>
</svg>
`;

async function generateIcon() {
  const pngPath = 'build/app-icon.png';
  const icoPath = 'build/app-icon.ico';

  // 生成 PNG
  await sharp(Buffer.from(svg))
    .resize(256, 256)
    .png()
    .toFile(pngPath);

  // 生成 ICO (包含多种尺寸: 16, 32, 48, 64, 128, 256)
  // 使用 PNG 格式的 ICO（现代 ICO 支持 PNG 嵌入）
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map(s =>
      sharp(Buffer.from(svg))
        .resize(s, s)
        .png()
        .toBuffer()
    )
  );

  // ICO 文件结构
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = sizes.length;

  // 计算 PNG 数据偏移量
  let dataOffset = headerSize + dirEntrySize * numImages;
  const entries = [];
  let pngData = Buffer.alloc(0);

  for (let i = 0; i < numImages; i++) {
    const buf = pngBuffers[i];
    entries.push({
      width: sizes[i],
      height: sizes[i],
      size: buf.length,
      offset: dataOffset,
    });
    dataOffset += buf.length;
    pngData = Buffer.concat([pngData, buf]);
  }

  // 构建 ICO 文件
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // 保留，必须为 0
  header.writeUInt16LE(1, 2);      // 类型：1 = ICO
  header.writeUInt16LE(numImages, 4); // 图像数量

  const dirEntries = Buffer.alloc(dirEntrySize * numImages);
  for (let i = 0; i < numImages; i++) {
    const entry = entries[i];
    const offset = i * dirEntrySize;
    dirEntries.writeUInt8(entry.width >= 256 ? 0 : entry.width, offset);   // 宽度（256 用 0）
    dirEntries.writeUInt8(entry.height >= 256 ? 0 : entry.height, offset + 1); // 高度
    dirEntries.writeUInt8(0, offset + 2);   // 调色板
    dirEntries.writeUInt8(0, offset + 3);   // 保留
    dirEntries.writeUInt16LE(1, offset + 4);   // 色彩平面数
    dirEntries.writeUInt16LE(32, offset + 6);  // 位深度
    dirEntries.writeUInt32LE(entry.size, offset + 8);  // 图像数据大小
    dirEntries.writeUInt32LE(entry.offset, offset + 12); // 图像数据偏移
  }

  const ico = Buffer.concat([header, dirEntries, pngData]);
  require('fs').writeFileSync(icoPath, ico);

  console.log('Icons generated:');
  console.log('  PNG: ' + pngPath + ' (256x256)');
  console.log('  ICO: ' + icoPath + ' (' + sizes.join(', ') + 'px)');
}

generateIcon().catch(console.error);
