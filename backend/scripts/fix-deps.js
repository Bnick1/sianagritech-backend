// scripts/fix-deps.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing dependencies...\n');

// Check for missing express-validator in middleware
const validationPath = path.join(__dirname, '..', 'middleware', 'validation.js');
if (fs.existsSync(validationPath)) {
  let content = fs.readFileSync(validationPath, 'utf8');
  
  // Fix sanitize-html import
  if (content.includes("import sanitizeHtml from 'sanitize-html'")) {
    content = content.replace(
      "import sanitizeHtml from 'sanitize-html';",
      `// Simple HTML sanitizer (no external dependencies)
const sanitizeHtml = (input, options = {}) => {
  if (!input || typeof input !== 'string') return input || '';
  
  let output = input;
  const config = {
    allowedTags: options.allowedTags || [],
    allowedAttributes: options.allowedAttributes || {},
    disallowedTagsMode: options.disallowedTagsMode || 'escape'
  };
  
  // Basic XSS prevention
  const dangerousPatterns = [
    /<script\\b[^>]*>(.*?)<\\/script>/gi,
    /javascript:[^'"]*/gi,
    /on\\w+\\s*=/gi
  ];
  
  dangerousPatterns.forEach(pattern => {
    output = output.replace(pattern, '');
  });
  
  if (config.disallowedTagsMode === 'escape') {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    output = output.replace(/[&<>"'/]/g, match => escapeMap[match]);
  }
  
  return output.trim();
};`
    );
    
    fs.writeFileSync(validationPath, content);
    console.log('✅ Fixed validation.js sanitize-html dependency');
  }
}

console.log('\n✅ Dependency fixes applied. Run: npm install');