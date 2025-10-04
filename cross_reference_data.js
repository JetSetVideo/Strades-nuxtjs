const fs = require('fs');

// Function to extract all data keys from Data.md
function extractDocumentedKeys() {
  const content = fs.readFileSync('Data.md', 'utf8');
  const keys = new Set();

  // Match all lines with `key` pattern
  const keyRegex = /`\s*([^`]+)`/g;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    const key = match[1].trim();
    keys.add(key);
  }

  return keys;
}

// Function to extract component data keys from Components.md
function extractComponentKeys() {
  const content = fs.readFileSync('Components.md', 'utf8');
  const componentData = {};

  // Split by component sections
  const sections = content.split(/^## /m);

  sections.forEach(section => {
    if (section.includes('**Template Data Usage:**')) {
      const lines = section.split('\n');
      const componentName = lines[0].trim();
      const templateUsage = [];

      let inTemplateSection = false;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '**Template Data Usage:**') {
          inTemplateSection = true;
          continue;
        }
        if (inTemplateSection && line.startsWith('- `') && line.endsWith('`')) {
          const key = line.slice(3, -1); // Remove "- `" and "`"
          templateUsage.push(key);
        }
        if (inTemplateSection && (line.startsWith('**') || line === '')) {
          break;
        }
      }

      if (templateUsage.length > 0) {
        componentData[componentName] = templateUsage;
      }
    }
  });

  return componentData;
}

// Function to filter out non-data keys (noise like CSS values, D3 methods, etc.)
function isLikelyDataKey(key) {
  // Filter out obvious non-data patterns
  if (
    // CSS values and units
    /\d+(\.\d+)?(px|em|rem|%|vh|vw|pt|cm|mm|in|deg|rad|s|ms)$/.test(key) ||
    // Pure numbers or very short strings
    /^(\d+(\.\d+)?|[a-zA-Z]{1,2})$/.test(key) ||
    // D3.js methods
    key.includes('d3.') || key.includes('.attr') || key.includes('.append') ||
    key.includes('.transition') || key.includes('.scale') || key.includes('.arc') ||
    // JavaScript keywords and primitives
    /^(true|false|null|undefined|item|index|key|value|in|of|Math\.|Array\.|Object\.|String\.|Number\.)/.test(key) ||
    // HTML attributes
    /^(to|style|class|id|type|name|placeholder|disabled|readonly|required)$/.test(key) ||
    // Common Vue directives and props
    key.startsWith('@') || key.startsWith('v-') || key.startsWith('on') ||
    // Very short keys (likely not meaningful data)
    key.length < 3 ||
    // Chart/plotting data (numeric strings)
    /^\d+\.\d+[a-zA-Z]\d+\.\d+$/.test(key) ||
    // CSS-like values
    /^rgba?\(/.test(key) || /^#[0-9a-fA-F]{3,6}$/.test(key)
  ) {
    return false;
  }

  return true;
}

// Function to check if a component key is valid based on documented keys
function isValidDataKey(componentKey, documentedKeys) {
  // Direct match
  if (documentedKeys.has(componentKey)) {
    return true;
  }

  // Check if component key is a subpath of documented keys
  for (const docKey of documentedKeys) {
    // If component key like "article.title" and doc key like "categories[n].articles[n].title"
    if (docKey.includes(componentKey) || componentKey.includes(docKey.replace(/\[n\]/g, ''))) {
      return true;
    }

    // Check property access patterns
    const componentParts = componentKey.split('.');
    const docParts = docKey.split('.');

    // If component accesses a property that exists in the documented structure
    if (componentParts.length >= 1 && docParts.some(part => part === componentParts[componentParts.length - 1])) {
      return true;
    }
  }

  return false;
}

// Main function
function main() {
  const documentedKeys = extractDocumentedKeys();
  const componentData = extractComponentKeys();

  console.log(`Found ${documentedKeys.size} documented data keys`);
  console.log(`Found ${Object.keys(componentData).length} components with data usage`);

  // Filter component keys to remove noise
  const filteredComponentData = {};
  Object.keys(componentData).forEach(component => {
    const filteredKeys = componentData[component].filter(key => isLikelyDataKey(key));
    if (filteredKeys.length > 0) {
      filteredComponentData[component] = filteredKeys;
    }
  });

  // Find inconsistencies
  const issues = {
    missingInDocumentation: new Set(),
    usedInComponents: new Set()
  };

  Object.values(filteredComponentData).forEach(keys => {
    keys.forEach(key => {
      issues.usedInComponents.add(key);
      if (!isValidDataKey(key, documentedKeys)) {
        issues.missingInDocumentation.add(key);
      }
    });
  });

  // Update Components.md with cross-reference analysis
  let existingContent = fs.readFileSync('Components.md', 'utf8');

  let markdown = existingContent;
  markdown += '\n\n# Data Key Cross-Reference Analysis\n\n';

  markdown += '## Summary\n\n';
  markdown += `- **Documented data keys:** ${documentedKeys.size}\n`;
  markdown += `- **Components with data usage:** ${Object.keys(filteredComponentData).length}\n`;
  markdown += `- **Data keys used in components:** ${issues.usedInComponents.size}\n`;
  markdown += `- **Missing from documentation:** ${issues.missingInDocumentation.size}\n\n`;

  if (issues.missingInDocumentation.size > 0) {
    markdown += '## Data Keys Used in Components but Missing from Data.md\n\n';
    Array.from(issues.missingInDocumentation).sort().forEach(key => {
      markdown += `- \`${key}\`\n`;
    });
    markdown += '\n';
  }

  markdown += '## Component Data Usage (Filtered)\n\n';
  Object.keys(filteredComponentData).sort().forEach(component => {
    markdown += `### ${component}\n\n`;
    markdown += '**Filtered Data Keys:**\n';
    filteredComponentData[component].forEach(key => {
      const isValid = isValidDataKey(key, documentedKeys);
      const status = isValid ? '✓' : '✗';
      markdown += `- ${status} \`${key}\`\n`;
    });
    markdown += '\n';
  });

  fs.writeFileSync('Components.md', markdown);
  console.log('Components.md has been updated with cross-reference analysis!');

  // Return the issues for the next step
  return {
    filteredComponentData,
    issues
  };
}

// Export for use in next script
module.exports = { main };

if (require.main === module) {
  main();
}
