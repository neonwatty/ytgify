import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MockServerConfig {
  port?: number;
  host?: string;
}

export interface VideoConfig {
  title: string;
  src: string;
  duration: number;
  width: number;
  height: number;
}

export class MockYouTubeServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private host: string = 'localhost';
  private fixturesPath: string;

  constructor(config: MockServerConfig = {}) {
    this.host = config.host || 'localhost';
    this.port = config.port || 0; // 0 = assign random available port
    this.fixturesPath = path.join(__dirname, '..', 'fixtures');
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, this.host, () => {
        const addr = this.server!.address() as any;
        this.port = addr.port;
        const url = `http://${this.host}:${this.port}`;
        console.log(`[Mock YouTube Server] Started at ${url}`);
        resolve(url);
      });

      this.server.on('error', (err) => {
        console.error('[Mock YouTube Server] Error:', err);
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[Mock YouTube Server] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      console.log(`[Mock YouTube Server] ${req.method} ${url.pathname}${url.search}`);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Route: /watch?v=VIDEO_ID - Serve YouTube watch page
      if (url.pathname === '/watch') {
        const videoId = url.searchParams.get('v');
        this.serveWatchPage(videoId, res);
        return;
      }

      // Route: /videos/* - Serve video files
      if (url.pathname.startsWith('/videos/')) {
        this.serveVideo(url.pathname, req, res);
        return;
      }

      // Route: /mock-youtube/* - Serve static assets (JS, CSS)
      if (url.pathname.startsWith('/mock-youtube/')) {
        this.serveAsset(url.pathname, res);
        return;
      }

      // 404 - Not found
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch (error) {
      console.error('[Mock YouTube Server] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private serveWatchPage(videoId: string | null, res: http.ServerResponse) {
    if (!videoId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing video ID parameter');
      return;
    }

    const videoConfig = this.getVideoConfig(videoId);
    if (!videoConfig) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Video not found: ${videoId}`);
      return;
    }

    const templatePath = path.join(this.fixturesPath, 'mock-youtube', 'youtube-watch.html');

    if (!fs.existsSync(templatePath)) {
      console.error(`[Mock YouTube Server] Template not found at ${templatePath}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Template file not found');
      return;
    }

    try {
      let html = fs.readFileSync(templatePath, 'utf-8');

      // Replace placeholders with video-specific data
      html = html.replace(/\{\{VIDEO_ID\}\}/g, videoId);
      html = html.replace(/\{\{VIDEO_TITLE\}\}/g, videoConfig.title);
      html = html.replace(/\{\{VIDEO_SRC\}\}/g, videoConfig.src);
      html = html.replace(/\{\{VIDEO_DURATION\}\}/g, videoConfig.duration.toString());
      html = html.replace(/\{\{VIDEO_WIDTH\}\}/g, videoConfig.width.toString());
      html = html.replace(/\{\{VIDEO_HEIGHT\}\}/g, videoConfig.height.toString());

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(html);
    } catch (error) {
      console.error('[Mock YouTube Server] Error reading template:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page template');
    }
  }

  private serveVideo(pathname: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const videoPath = path.join(this.fixturesPath, pathname);

    if (!fs.existsSync(videoPath)) {
      console.warn(`[Mock YouTube Server] Video not found: ${videoPath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Video file not found');
      return;
    }

    try {
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Handle range requests for video seeking
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        // Detect content type from file extension
        const ext = path.extname(videoPath).toLowerCase();
        const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });

        const stream = fs.createReadStream(videoPath, { start, end });
        stream.pipe(res);
      } else {
        // Serve entire video
        const ext = path.extname(videoPath).toLowerCase();
        const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        });

        const stream = fs.createReadStream(videoPath);
        stream.pipe(res);
      }
    } catch (error) {
      console.error('[Mock YouTube Server] Error serving video:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error serving video file');
    }
  }

  private serveAsset(pathname: string, res: http.ServerResponse) {
    const assetPath = path.join(this.fixturesPath, pathname);

    if (!fs.existsSync(assetPath)) {
      console.warn(`[Mock YouTube Server] Asset not found: ${assetPath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Asset not found');
      return;
    }

    try {
      const ext = path.extname(assetPath).toLowerCase();
      let contentType = 'text/plain';

      switch (ext) {
        case '.js':
          contentType = 'application/javascript; charset=utf-8';
          break;
        case '.css':
          contentType = 'text/css; charset=utf-8';
          break;
        case '.html':
          contentType = 'text/html; charset=utf-8';
          break;
        case '.json':
          contentType = 'application/json; charset=utf-8';
          break;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });

      const stream = fs.createReadStream(assetPath);
      stream.pipe(res);
    } catch (error) {
      console.error('[Mock YouTube Server] Error serving asset:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error serving asset');
    }
  }

  private getVideoConfig(videoId: string): VideoConfig | null {
    // Map video IDs to their configurations
    const videoConfigs: Record<string, VideoConfig> = {
      'mock-short': {
        title: 'Test Short Video (20s)',
        src: '/videos/test-short-20s.webm',
        duration: 20,
        width: 640,
        height: 360
      },
      'mock-medium': {
        title: 'Test Medium Video (10s)',
        src: '/videos/test-medium-10s.webm',
        duration: 10,
        width: 1280,
        height: 720
      },
      'mock-long': {
        title: 'Test Long Video (20s)',
        src: '/videos/test-long-20s.webm',
        duration: 20,
        width: 1920,
        height: 1080
      },
      'mock-hd': {
        title: 'Test HD Video (15s)',
        src: '/videos/test-hd-15s.webm',
        duration: 15,
        width: 1920,
        height: 1080
      }
    };

    return videoConfigs[videoId] || null;
  }

  getUrl(): string {
    if (!this.server || this.port === 0) {
      throw new Error('Server not started yet');
    }
    return `http://${this.host}:${this.port}`;
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.server !== null && this.port > 0;
  }
}

// Singleton instance for global setup/teardown
let serverInstance: MockYouTubeServer | null = null;

export function getMockServer(): MockYouTubeServer {
  if (!serverInstance) {
    serverInstance = new MockYouTubeServer();
  }
  return serverInstance;
}

export function clearMockServer(): void {
  serverInstance = null;
}
