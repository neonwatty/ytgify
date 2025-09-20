import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateTile(htmlFile, outputFile, width, height) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set viewport to exact dimensions
        await page.setViewport({
            width: width,
            height: height,
            deviceScaleFactor: 1 // Exact dimensions
        });

        // Load the HTML file
        const filePath = `file://${path.join(__dirname, htmlFile)}`;
        await page.goto(filePath, {
            waitUntil: 'networkidle0'
        });

        // Take screenshot
        await page.screenshot({
            path: outputFile,
            type: 'png',
            clip: {
                x: 0,
                y: 0,
                width: width,
                height: height
            }
        });

        console.log(`✅ Generated: ${outputFile}`);
    } catch (error) {
        console.error(`❌ Error generating ${outputFile}:`, error);
    } finally {
        await browser.close();
    }
}

async function generateAllTiles() {
    console.log('🎨 Starting tile generation...\n');

    // Generate Marquee Promotional Tile
    await generateTile(
        'marquee-tile.html',
        'marquee-tile-1400x560.png',
        1400,
        560
    );

    // Generate Small Promotional Tile
    await generateTile(
        'small-tile.html',
        'small-tile-440x280.png',
        440,
        280
    );

    console.log('\n✨ Tile generation complete!');
    console.log('\nGenerated files:');
    console.log('  • marquee-tile-1400x560.png (Marquee Promotional Tile)');
    console.log('  • small-tile-440x280.png (Small Promotional Tile)');
    console.log('\nThese tiles are ready to upload to the Chrome Web Store!');
}

// Run generation
generateAllTiles();