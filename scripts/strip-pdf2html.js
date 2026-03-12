#!/usr/bin/env node
/**
 * Strips pdf2htmlEX artifacts from converted HTML. Keeps three page images for layout reference.
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'Third party claim form (1).html');
const output = join(root, 'reference-claim-form.html');

let html = readFileSync(input, 'utf-8');

// Remove generator comment and meta
html = html.replace(/<!-- Created by pdf2htmlEX[^>]*-->\n?/g, '');
html = html.replace(/<meta name="generator" content="pdf2htmlEX"\/>\n?/g, '');

// Remove sidebar and outline (entire div#sidebar)
html = html.replace(/<div id="sidebar">[\s\S]*?<div id="outline">[\s\S]*?<\/div>\s*<\/div>/g, '');

// Remove loading indicator
html = html.replace(/<div[^>]*class="loading-indicator[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');

// Remove pdf2htmlEX script block
html = html.replace(/<script[^>]*>[\s\S]*?pdf2htmlEX[\s\S]*?<\/script>/g, '');

// Simplify styles: remove fancy styles, sidebar styles, animations
// Keep only base .pf, .pc, .bi and minimal print styles
const minimalStyles = `
<style type="text/css">
.pf{position:relative;background-color:white;overflow:hidden;margin:0;border:0;page-break-after:always;page-break-inside:avoid}
.pc{position:absolute;border:0;padding:0;margin:0;top:0;left:0;width:100%;height:100%;overflow:hidden;display:block}
.bi{position:absolute;border:0;margin:0;user-select:none}
.w0{width:595px;}
.h0{height:842px;}
@media print{@page{margin:0}html,body{margin:0}#sidebar{display:none}}
</style>`;

// Replace the first few style blocks with minimal
html = html.replace(/<style type="text\/css">[\s\S]*?<\/style>\s*(?=<style|<link|<script|<body)/g, (m, i) => {
  return i === 0 ? minimalStyles : '';
});
// Remove all remaining style blocks except our minimal one (simplified: remove from first style to </head>)
const headEnd = html.indexOf('</head>');
const headStart = html.indexOf('<head>');
let headContent = html.slice(headStart, headEnd);
// Remove @font-face and other heavy blocks
headContent = headContent.replace(/@font-face\{[^}]+\}/g, '');
headContent = headContent.replace(/@keyframes[^}]+\}[^}]*\}/g, '');
headContent = headContent.replace(/\.ff\d+[^}]+\}/g, '');
headContent = headContent.replace(/\.m\d+[^}]+\}/g, '');
// Replace head content - keep only minimal
const newHead = '<head>\n<meta charset="utf-8"/>\n' + minimalStyles + '\n</head>';
html = html.slice(0, headStart) + newHead + html.slice(headEnd);

// Remove page-container margin for sidebar (we removed sidebar)
html = html.replace(/id="page-container"/, 'id="page-container" style="left:0"');

writeFileSync(output, html, 'utf-8');
console.log('Wrote', output);
