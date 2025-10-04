const fs = require('fs');
const path = require('path');

// Function to extract data imports and usage from a Vue component
function analyzeComponentData(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const dataSources = {
    importedDataFiles: new Set(),
    importedDataFunctions: new Set(),
    storeAccess: new Set(),
    dataUsage: new Set(),
    apiCalls: new Set(),
    props: new Set()
  };

  // Extract imports from data directory
  const dataImportRegex = /import\s+\w+\s+from\s+['"]@\/data\/([^'"]+)['"]/g;
  let match;
  while ((match = dataImportRegex.exec(content)) !== null) {
    dataSources.importedDataFiles.add(match[1]);
  }

  // Extract $fetch calls to data directory
  const fetchRegex = /\$fetch\s*\(\s*['"]\/data\/([^'"]+)['"]/g;
  while ((match = fetchRegex.exec(content)) !== null) {
    dataSources.importedDataFiles.add(match[1]);
  }

  // Extract store usage
  const storeRegex = /use(\w+)Store\(\)/g;
  while ((match = storeRegex.exec(content)) !== null) {
    const storeMatch = match[0].match(/use(\w+)Store/);
    if (storeMatch) {
      dataSources.storeAccess.add(storeMatch[1].toLowerCase());
    }
  }

  // Extract composable usage
  const composableRegex = /use(\w+)\(\)/g;
  while ((match = composableRegex.exec(content)) !== null) {
    dataSources.importedDataFunctions.add(`use${match[1]}`);
  }

  // Extract props definitions
  const propsRegex = /defineProps\(\s*\{([^}]+)\}/g;
  while ((match = propsRegex.exec(content)) !== null) {
    const propsBlock = match[1];
    const propNames = propsBlock.match(/(\w+):/g);
    if (propNames) {
      propNames.forEach(prop => {
        dataSources.props.add(prop.replace(':', ''));
      });
    }
  }

  // Extract API calls
  const apiRegex = /\$fetch\s*\(\s*['"]\/api\/([^'"]+)['"]/g;
  while ((match = apiRegex.exec(content)) !== null) {
    dataSources.apiCalls.add(match[1]);
  }

  return {
    importedDataFiles: Array.from(dataSources.importedDataFiles),
    importedDataFunctions: Array.from(dataSources.importedDataFunctions),
    storeAccess: Array.from(dataSources.storeAccess),
    dataUsage: Array.from(dataSources.dataUsage),
    apiCalls: Array.from(dataSources.apiCalls),
    props: Array.from(dataSources.props)
  };
}

// Function to get all Vue files recursively
function getVueFiles(dirPath, files = [], basePath = dirPath) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getVueFiles(fullPath, files, basePath);
    } else if (item.endsWith('.vue') || item.endsWith('.ts') || item.endsWith('.js')) {
      const relativePath = path.relative(basePath, fullPath);
      files.push({
        fullPath,
        relativePath,
        extension: path.extname(item)
      });
    }
  }

  return files;
}

// Function to extract documented keys from Data.md
function extractDocumentedKeys() {
  const content = fs.readFileSync('Data.md', 'utf8');
  const sections = {};

  // Split by sections (## headers)
  const sectionRegex = /^## (.+)$/gm;
  let lastSection = '';
  let lastSubSection = '';
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sectionMatch = line.match(/^## (.+)$/);
    const subSectionMatch = line.match(/^### (.+)\.json$/);

    if (sectionMatch) {
      lastSection = sectionMatch[1];
      lastSubSection = '';
    } else if (subSectionMatch) {
      lastSubSection = subSectionMatch[1];
      // Create a unique key combining section and subsection
      const fullKey = `${lastSection}/${lastSubSection}`;
      sections[fullKey] = [];
    } else if (lastSubSection && line.includes('`')) {
      // Extract keys from the line
      const keyMatches = line.match(/`([^`]+)`/g);
      if (keyMatches) {
        const fullKey = `${lastSection}/${lastSubSection}`;
        keyMatches.forEach(match => {
          const key = match.slice(1, -1); // Remove backticks
          if (!sections[fullKey].includes(key)) {
            sections[fullKey].push(key);
          }
        });
      }
    }
  }

  return sections;
}

// Function to map stores to their data sources
function getStoreDataMapping() {
  return {
    'assets': ['core/assets.json'],
    'wallets': ['core/wallets.json'],
    'users': ['core/users.json', 'relationships/user_assets.json'],
    'strategies': ['core/strategies.json', 'relationships/strategy_assets.json'],
    'chat': ['chat/conversations.json', 'chat/messages.json'],
    'tracking': ['tracking/analytics.json', 'tracking/component_usage.json', 'tracking/user_interactions.json'],
    'bitcoin': ['Bitcoin.json']
  };
}

// Main function
function main() {
  const componentsDir = './components';
  const componentFiles = getVueFiles(componentsDir);
  const documentedKeys = extractDocumentedKeys();
  const storeDataMapping = getStoreDataMapping();


  let markdown = '# Components Data Usage Analysis\n\n';
  markdown += 'This document shows which data sources each component uses and their corresponding keys in Data.md.\n\n';

  // Sort files by path for consistent ordering
  componentFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  componentFiles.forEach(({ fullPath, relativePath, extension }) => {
    const analysis = analyzeComponentData(fullPath);

    // Only include components that actually use data
    const hasDataUsage = analysis.importedDataFiles.length > 0 ||
                        analysis.importedDataFunctions.length > 0 ||
                        analysis.storeAccess.length > 0 ||
                        analysis.props.length > 0 ||
                        analysis.apiCalls.length > 0;

    if (hasDataUsage) {
      markdown += `## ${relativePath}\n\n`;

      if (analysis.props.length > 0) {
        markdown += `**Props (Data received from parent):**\n`;
        analysis.props.forEach(prop => {
          markdown += `- \`${prop}\`\n`;
        });
        markdown += '\n';
      }

      if (analysis.importedDataFiles.length > 0) {
        markdown += `**Direct Data Imports:**\n`;
        analysis.importedDataFiles.forEach(file => {
          markdown += `- \`${file}\`\n`;
          // Try to find corresponding section in Data.md
          const fileName = path.basename(file, path.extname(file));
          const sectionName = Object.keys(documentedKeys).find(section =>
            section.toLowerCase().includes(fileName.toLowerCase()) ||
            fileName.toLowerCase().includes(section.toLowerCase().replace(/\s+/g, ''))
          );
          if (sectionName) {
            markdown += `  - **Data.md Section:** ${sectionName}\n`;
            markdown += `  - **Key Examples:** ${documentedKeys[sectionName].slice(0, 3).join(', ')}${documentedKeys[sectionName].length > 3 ? '...' : ''}\n`;
          }
        });
        markdown += '\n';
      }

      if (analysis.storeAccess.length > 0) {
        markdown += `**Store Access (Data Sources):**\n`;
        analysis.storeAccess.forEach(store => {
          markdown += `- \`${store}\`\n`;
          // Find data sources for this store
          const dataSources = storeDataMapping[store] || [];
          if (dataSources.length > 0) {
            markdown += `  - **Data Files:** ${dataSources.join(', ')}\n`;
            dataSources.forEach(dataFile => {
              // Remove .json extension from dataFile for matching
              const dataFileBase = dataFile.replace('.json', '');
              // Try to find matching section in documentedKeys
              const sectionName = Object.keys(documentedKeys).find(section => {
                return section === dataFileBase || section.endsWith(`/${dataFileBase}`);
              });
              if (sectionName && documentedKeys[sectionName].length > 0) {
                markdown += `  - **${dataFile} Keys:** ${documentedKeys[sectionName].slice(0, 3).join(', ')}${documentedKeys[sectionName].length > 3 ? '...' : ''}\n`;
              }
            });
          }
        });
        markdown += '\n';
      }

      if (analysis.importedDataFunctions.length > 0) {
        markdown += `**Data Functions/Composables:**\n`;
        analysis.importedDataFunctions.forEach(func => {
          markdown += `- \`${func}\`\n`;
        });
        markdown += '\n';
      }

      if (analysis.apiCalls.length > 0) {
        markdown += `**API Calls:**\n`;
        analysis.apiCalls.forEach(api => {
          markdown += `- \`${api}\`\n`;
        });
        markdown += '\n';
      }
    }
  });

  // Write to Components.md
  fs.writeFileSync('Components.md', markdown);
  console.log('Components.md has been restructured with clean component data analysis!');
}

main();
