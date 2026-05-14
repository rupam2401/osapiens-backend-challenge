/**
 * Catch-all `/` route that renders README.md as styled HTML.
 *
 * The README is parsed once at boot rather than on every request:
 * - It's part of the deployment artifact and won't change at runtime.
 * - Avoids the callback nesting from `fs.readFile` and the per-request
 *   marked() call.
 * - If reading or parsing fails at boot we serve a fallback message.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { logger } from '../logger';

const router = express.Router();
const staticPath = path.join(__dirname, '../../public');
router.use('/public', express.static(staticPath));
const log = logger.child({ module: 'defaultRoute' });

const STYLES = `
  body {
    background-color: #1a1a1a;
    color: #ffffff;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    line-height: 1.6;
  }
  a { color: #1e90ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; height: auto; display: block; margin: 20px auto; }
  pre {
    background-color: #1e1e1e;
    color: #dcdcdc;
    padding: 10px;
    border-radius: 5px;
    overflow-x: auto;
  }
  code {
    background-color: #1e1e1e;
    color: #dcdcdc;
    padding: 2px 4px;
    border-radius: 3px;
  }
  h1, h2, h3, h4, h5, h6 { color: #ffcc00; }
  blockquote {
    color: #cccccc;
    border-left: 4px solid #ffcc00;
    padding-left: 10px;
    margin-left: 0;
    font-style: italic;
  }
`.trim();

function renderReadme(): string {
    const readmePath = path.join(__dirname, '../..', 'README.md');
    try {
        const md = fs.readFileSync(readmePath, 'utf8');
        const body = marked.parse(md, { async: false }) as string;
        return `<html><head><style>${STYLES}</style></head><body>${body}</body></html>`;
    } catch (err) {
        log.error({ err }, 'Error rendering README.md at boot');
        return '<html><body><h1>osapiens-backend</h1><p>README unavailable.</p></body></html>';
    }
}

const rendered = renderReadme();

router.get('/', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(rendered);
});

export default router;
