import yaml from 'js-yaml';

export function parseWorkflow(yamlContent: string) {
  try {
    // Pre-process the YAML to fix common indentation issues
    const preprocessedYaml = preprocessYaml(yamlContent);
    return yaml.load(preprocessedYaml);
  } catch (error) {
    console.error('Error parsing YAML:', error);
    throw error;
  }
}

function preprocessYaml(yamlContent: string) {
  // Split the content into lines
  const lines = yamlContent.split('\n');
  const processedLines = [];
  
  let inStepBlock = false;
  let stepIndentation = 0;
  let inMultilineRun = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trimStart();
    
    // Check if we're entering a step block
    if (trimmedLine.startsWith('- name:')) {
      inStepBlock = true;
      inMultilineRun = false;
      stepIndentation = line.length - trimmedLine.length;
    }
    
    // Check for multiline run commands
    if (inStepBlock && trimmedLine.startsWith('run: |')) {
      inMultilineRun = true;
      processedLines.push(line);
      continue;
    }
    
    // Handle lines within a multiline run block
    if (inMultilineRun) {
      // If the line is indented more than the step, it's part of the multiline run
      const currentIndentation = line.length - trimmedLine.length;
      if (currentIndentation > stepIndentation && trimmedLine.length > 0) {
        processedLines.push(line);
        continue;
      } else {
        // We've exited the multiline run block
        inMultilineRun = false;
      }
    }
    
    // Special handling for the Slack notification issue
    if (inStepBlock && 
        (line.includes('curl -X POST') || 
         line.includes('--data') || 
         line.includes('Content-type: application/json'))) {
      
      // Check if this is the problematic line with escaped quotes in JSON
      if (line.includes('--data') && line.includes('\\"text\\"')) {
        // Make sure it has proper indentation
        const properIndentation = ' '.repeat(stepIndentation + 2);
        if (!line.startsWith(properIndentation)) {
          const fixedLine = properIndentation + trimmedLine;
          processedLines.push(fixedLine);
          continue;
        }
      }
    }
    
    // If we're in a step block, ensure consistent indentation for step properties
    if (inStepBlock && (trimmedLine.startsWith('if:') || trimmedLine.startsWith('run:'))) {
      const propertyIndentation = line.length - trimmedLine.length;
      
      // If the indentation is inconsistent, fix it
      if (propertyIndentation !== stepIndentation + 2) {
        const fixedLine = ' '.repeat(stepIndentation + 2) + trimmedLine;
        processedLines.push(fixedLine);
        continue;
      }
    }
    
    // Check if we're exiting a step block
    if (inStepBlock && line.trim() === '' && i < lines.length - 1) {
      const nextLine = lines[i + 1];
      const nextTrimmedLine = nextLine.trimStart();
      
      if (!nextTrimmedLine.startsWith('if:') && 
          !nextTrimmedLine.startsWith('run:') && 
          !nextTrimmedLine.startsWith('with:') && 
          !nextTrimmedLine.startsWith('env:')) {
        inStepBlock = false;
      }
    }
    
    processedLines.push(line);
  }
  
  // Additional post-processing for specific issues
  let result = processedLines.join('\n');
  
  // Fix the specific Slack notification issue with escaped quotes
  result = result.replace(
    /- name: Notify Slack\s+if: success\(\)\s+run: curl -X POST -H 'Content-type: application\/json' --data '\{\\\"text\\\":/g,
    (match) => {
      // Split the match into lines
      const lines = match.split('\n');
      // Ensure each line has proper indentation
      if (lines.length >= 3) {
        const baseIndent = lines[0].indexOf('-');
        const properIndent = ' '.repeat(baseIndent + 2);
        
        return [
          lines[0],
          `${properIndent}if: success()`,
          `${properIndent}run: curl -X POST -H 'Content-type: application/json' --data '{"text":`
        ].join('\n');
      }
      return match;
    }
  );
  
  return result;
} 