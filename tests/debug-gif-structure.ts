/**
 * Debug script to examine GIF structure
 * Run with: npx ts-node tests/debug-gif-structure.ts <path-to-gif>
 */

async function debugGifStructure(gifUrl: string) {
  // This would need to run in a browser context
  console.log('Examining GIF structure...');
  console.log('URL:', gifUrl);
}

// For now, let's create a simpler inline test
export async function examineGifBuffer(buffer: Buffer) {
  console.log('\n=== GIF Structure Analysis ===\n');
  console.log('Total size:', buffer.length, 'bytes');

  // Header
  const signature = buffer.toString('ascii', 0, 6);
  console.log('Signature:', signature);

  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    console.log('❌ Invalid GIF signature!');
    return;
  }

  // Logical Screen Descriptor
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const packedFields = buffer[10];

  console.log('Dimensions:', `${width}x${height}`);
  console.log('Packed Fields (byte 10):', '0x' + packedFields.toString(16).padStart(2, '0'));

  // Parse packed fields
  const hasGlobalColorTable = (packedFields & 0x80) !== 0;
  const colorResolution = ((packedFields & 0x70) >> 4) + 1;
  const sortFlag = (packedFields & 0x08) !== 0;
  const globalColorTableSize = 2 ** ((packedFields & 0x07) + 1);

  console.log('Has Global Color Table:', hasGlobalColorTable);
  console.log('Color Resolution:', colorResolution, 'bits');
  console.log('Sort Flag:', sortFlag);
  console.log('Global Color Table Size:', globalColorTableSize, 'colors');

  if (hasGlobalColorTable) {
    const tableBytes = globalColorTableSize * 3;
    console.log('Global Color Table Length:', tableBytes, 'bytes');
    console.log('Global Color Table spans bytes 13 to', 13 + tableBytes - 1);
    console.log('Data stream starts at byte', 13 + tableBytes);

    // Show first few palette colors
    console.log('\nFirst 3 palette colors:');
    for (let i = 0; i < 3 && i < globalColorTableSize; i++) {
      const offset = 13 + (i * 3);
      const r = buffer[offset];
      const g = buffer[offset + 1];
      const b = buffer[offset + 2];
      console.log(`  Color ${i}: RGB(${r}, ${g}, ${b})`);
    }
  } else {
    console.log('Data stream starts at byte 13');
  }

  // Count frames starting from correct position
  const dataStartPos = hasGlobalColorTable ? 13 + (globalColorTableSize * 3) : 13;
  console.log('\n=== Scanning for frames starting at byte', dataStartPos, '===\n');

  let frameCount = 0;
  let position = dataStartPos;

  while (position < buffer.length) {
    const byte = buffer[position];

    if (byte === 0x21) { // Extension
      const label = buffer[position + 1];
      console.log(`Byte ${position}: Extension (0x21), label: 0x${label?.toString(16).padStart(2, '0')}`);
      position += 2;
      let blockSize = buffer[position];
      while (blockSize > 0 && position < buffer.length) {
        position += blockSize + 1;
        blockSize = buffer[position];
      }
      position++;
    } else if (byte === 0x2C) { // Image descriptor
      frameCount++;
      console.log(`Byte ${position}: ✅ FRAME #${frameCount} (Image Separator 0x2C)`);
      position++;
      if (position + 9 <= buffer.length) {
        const frameLeft = buffer.readUInt16LE(position);
        const frameTop = buffer.readUInt16LE(position + 2);
        const frameWidth = buffer.readUInt16LE(position + 4);
        const frameHeight = buffer.readUInt16LE(position + 6);
        console.log(`  Position: (${frameLeft}, ${frameTop}), Size: ${frameWidth}x${frameHeight}`);
      }
      position += 9;

      // Skip image data
      if (position < buffer.length) {
        position++; // LZW minimum
        let subBlockSize = buffer[position];
        while (subBlockSize > 0 && position < buffer.length) {
          position += subBlockSize + 1;
          if (position < buffer.length) {
            subBlockSize = buffer[position];
          }
        }
        position++;
      }
    } else if (byte === 0x3B) { // Trailer
      console.log(`Byte ${position}: Trailer (0x3B) - End of GIF`);
      break;
    } else {
      position++;
    }
  }

  console.log('\n=== Summary ===');
  console.log('Total frames found:', frameCount);
  console.log('Bytes scanned:', position, 'of', buffer.length);
}
