'use client';

import {useEffect, useRef, useState} from 'react';
import * as d3 from 'd3';
import {useTheme} from '@/context/ThemeContext';
import { checkWorkflowForErrors, WorkflowError } from '@/lib/workflowErrorChecker';
import { 
  createNodes, 
  addTextToNodes, 
  createForceSimulation, 
  createLinks, 
  updatePositions,
  addIndicator,
  createTreeLayout,
  createTreeLinks
} from '@/lib/d3Helpers';

interface WorkflowGraphProps {
  workflow: any;
}

export default function WorkflowGraph({ workflow }: WorkflowGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = useState<'jobs' | 'steps'>('jobs');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<{
    id: string;
    name: string;
    uses?: string;
    run?: string;
    variables: any[];
  } | null>(null);
  const [errors, setErrors] = useState<WorkflowError[]>([]);
  const [isEmptyWorkflow, setIsEmptyWorkflow] = useState<boolean>(false);

  const hasValidationErrors = () => {
    if (!workflow) {
      return false;
    }

    const workflowErrors = checkWorkflowForErrors(workflow);
    // Consider the workflow invalid if there are any error-type issues
    // (warnings and info messages don't prevent visualization)
    return workflowErrors.some(error => error.type === 'error');
  }

  // Validate workflow when it changes
  useEffect(() => {
    // Reset states
    setErrors([]);
    setIsEmptyWorkflow(false);

    // Check if workflow is empty or undefined
    if (!workflow) {
      setIsEmptyWorkflow(true);
      return;
    }

    // Check if workflow has no content (empty object)
    if (workflow && Object.keys(workflow).length === 0) {
      setIsEmptyWorkflow(true);
      return;
    }

    // Check if workflow has no jobs (might be a valid empty workflow file)
    if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
      setIsEmptyWorkflow(true);
      return;
    }

    // If we have a non-empty workflow, check for errors
    const workflowErrors = checkWorkflowForErrors(workflow);
    setErrors(workflowErrors);
  }, [workflow]);

  // Function to analyze variables in a step
  const analyzeStepVariables = (step: any) => {
    const variables: any[] = [];

    // Check for environment variables
    if (step.env) {
      Object.entries(step.env).forEach(([name, value]) => {
        variables.push({
          type: 'env',
          name,
          value,
        });
      });
    }

    // Check for expressions
    const stepStr = JSON.stringify(step);
    const expressionMatches = stepStr.match(/\$\{\{\s*([^}]+)\s*\}\}/g) || [];

    expressionMatches.forEach(match => {
      const expression = match.replace(/\$\{\{\s*/, '').replace(/\s*\}\}/, '').trim();
      let type = 'unknown';
      let predictedValue = 'Unknown';

      if (expression.startsWith('env.')) {
        type = 'environment';
        const envVar = expression.substring(4);
        predictedValue = `Value of ${envVar} environment variable`;
      } else if (expression.startsWith('secrets.')) {
        type = 'secret';
        predictedValue = '****** (secret)';
      } else if (expression.startsWith('github.')) {
        type = 'github context';
        const contextVar = expression.substring(7);

        // Predict common GitHub context values
        switch (contextVar) {
          case 'sha':
            predictedValue = '8f142c22a0c1e5a5f35b232974cabf45d66f7f1a';
            break;
          case 'ref':
            predictedValue = 'refs/heads/main';
            break;
          case 'event_name':
            predictedValue = 'push';
            break;
          case 'workflow':
            predictedValue = workflow.name || 'Workflow';
            break;
          case 'run_number':
            predictedValue = '42';
            break;
          default:
            predictedValue = `GitHub context: ${contextVar}`;
        }
      }

      variables.push({
        type: 'expression',
        expression,
        subtype: type,
        predictedValue,
      });
    });

    // Check for GitHub ENV modifications
    if (step.run) {
      const runStr = String(step.run);

      // Generic pattern for variable assignments to GITHUB_ENV
      const envExportMatches = runStr.match(/([A-Z_]+)=(.+?)>>\s*\$GITHUB_ENV/g) || [];

      envExportMatches.forEach(match => {
        const parts = match.split('=');
        if (parts.length >= 2) {
          const name = parts[0];
          const value = parts.slice(1).join('=').replace(/>>\s*\$GITHUB_ENV/, '').trim();

          // Check for special patterns in the value
          let predictedValue = undefined;
          let note = 'This variable will be available in subsequent steps';

          // Check for GitHub SHA truncation pattern
          if (value.includes('${GITHUB_SHA::')) {
            const shaMatch = value.match(/\$\{GITHUB_SHA::(\d+)\}/);
            const digits = shaMatch ? parseInt(shaMatch[1]) : 7;

            predictedValue = value
              .replace(/\$\{GITHUB_SHA::(\d+)\}/, '8f142c2')
              .replace(/\$\{GITHUB_RUN_NUMBER\}/, '42')
              .replace(/\$\{\{\s*env\.([^}]+)\s*\}\}/, 'myapp');

            note = `Sets a variable with truncated SHA (${digits} characters)`;
          }
          // Check for other common patterns
          else if (value.includes('GITHUB_')) {
            predictedValue = value
              .replace(/\$\{GITHUB_SHA\}/, '8f142c22a0c1e5a5f35b232974cabf45d66f7f1a')
              .replace(/\$\{GITHUB_RUN_NUMBER\}/, '42')
              .replace(/\$\{GITHUB_REF\}/, 'refs/heads/main')
              .replace(/\$\{\{\s*env\.([^}]+)\s*\}\}/, 'myapp');
          }

          variables.push({
            type: 'github_env',
            name,
            value,
            note,
            predictedValue
          });
        }
      });

      // Check for export statements
      const exportMatches = runStr.match(/export\s+([A-Z_]+)=(.+?)($|\n)/g) || [];

      exportMatches.forEach(match => {
        const parts = match.replace(/export\s+/, '').split('=');
        if (parts.length >= 2) {
          const name = parts[0];
          const value = parts.slice(1).join('=').replace(/($|\n)/, '').trim();

          variables.push({
            type: 'export',
            name,
            value,
            note: 'Shell environment variable (available in this step only)',
          });
        }
      });
    }

    return variables;
  };

  useEffect(() => {
    if (!workflow || !svgRef.current) return;

    if (hasValidationErrors()) {
      return;
    }

    // Clear previous graph
    d3.select(svgRef.current).selectAll('*').remove();

    // Create a container group for zoom behavior
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Set background color based on theme
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', isDarkMode ? '#1e1e1e' : 'white');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Add double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform as any, d3.zoomIdentity);
    });

    // Create a container for all graph elements
    const container = svg.append('g');

    // Add zoom controls (fixed position)
    const controls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 130}, 20)`);

    // Zoom in button
    controls.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 30)
      .attr('height', 30)
      .attr('rx', 5)
      .attr('fill', '#4B5563')
      .attr('cursor', 'pointer')
      .on('click', () => {
        svg.transition()
          .duration(300)
          .call(zoom.scaleBy as any, 1.3);
      });

    controls.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '18px')
      .attr('pointer-events', 'none')
      .text('+');

    // Zoom out button
    controls.append('rect')
      .attr('x', 40)
      .attr('y', 0)
      .attr('width', 30)
      .attr('height', 30)
      .attr('rx', 5)
      .attr('fill', '#4B5563')
      .attr('cursor', 'pointer')
      .on('click', () => {
        svg.transition()
          .duration(300)
          .call(zoom.scaleBy as any, 0.7);
      });

    controls.append('text')
      .attr('x', 55)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '18px')
      .attr('pointer-events', 'none')
      .text('-');
      
    // Reset zoom button
    controls.append('rect')
      .attr('x', 80)
      .attr('y', 0)
      .attr('width', 30)
      .attr('height', 30)
      .attr('rx', 5)
      .attr('fill', '#4B5563')
      .attr('cursor', 'pointer')
      .on('click', () => {
        // Center the view with the fixed scale
        const containerNode = container.node();
        if (!containerNode) return;
        
        const bounds = containerNode.getBBox();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        
        const fixedScale = 0.8;
        const translate = [width / 2 - fixedScale * x, height / 2 - fixedScale * y];
        
        svg.transition()
          .duration(300)
          .call(zoom.transform as any, d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(fixedScale)
          );
      });

    controls.append('text')
      .attr('x', 95)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('pointer-events', 'none')
      .text('⟳');

    // Add back button for steps view (fixed position)
    if (viewMode === 'steps') {
      const backButton = svg.append('g')
        .attr('class', 'back-button')
        .attr('transform', 'translate(20, 20)')
        .attr('cursor', 'pointer')
        .on('click', () => {
          setViewMode('jobs');
        });

      backButton.append('rect')
        .attr('width', 80)
        .attr('height', 30)
        .attr('rx', 5)
        .attr('ry', 5)
        .attr('fill', '#4B5563');

      backButton.append('text')
        .attr('x', 40)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .text('← Back');

      // Add text
      svg.append('text')
        .attr('class', 'job-title')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '14px')
        .attr('font-weight', 'normal')
        .text(`Job: ${selectedJob ? (workflow.jobs[selectedJob]?.name || selectedJob) : ''}`);
    }

    // Render the appropriate graph
    if (viewMode === 'jobs') {
      renderJobsGraph(container);
    } else if (viewMode === 'steps' && selectedJob) {
      renderStepsGraph(container, selectedJob);
    }

    // Center the view on the graph with a very short delay
    // This ensures the graph is rendered before we try to center it
    requestAnimationFrame(() => {
      const containerNode = container.node();
      if (!containerNode) return;
      
      const bounds = containerNode.getBBox();
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      
      // Use a fixed scale instead of auto-scaling based on graph size
      const fixedScale = 0.8;
      const translate = [width / 2 - fixedScale * x, height / 2 - fixedScale * y];
      
      // Apply the transform immediately without animation for initial render
      svg.call(zoom.transform as any, d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(fixedScale)
      );
    });

    // Add help text (fixed position)
    svg.append('text')
      .attr('x', 20)
      .attr('y', height - 20)
      .attr('text-anchor', 'start')
      .attr('font-size', '12px')
      .attr('fill', '#6B7280')
      .text('Scroll to zoom, drag to pan, double-click or use ⟳ button to reset view');

    return () => {
      // Cleanup
      svg.on('wheel.scroll', null);
    };
  }, [workflow, viewMode, selectedJob, selectedStep, hasValidationErrors, isEmptyWorkflow]);

  const renderJobsGraph = (container: any) => {
    // Create graph data
    const jobs = Object.entries(workflow.jobs || {}).map(([id, job]: [string, any]) => ({
      id,
      name: job.name || id,
      needs: job.needs || [],
      runsOn: job['runs-on'] || 'unknown',
      hasEnv: !!job.env,
      stepCount: (job.steps || []).length,
    }));

    const links = jobs
      .filter(job => job.needs && job.needs.length)
      .flatMap(job =>
        job.needs.map((need: string) => ({
          source: need,
          target: job.id,
        }))
      );

    // Set up the SVG
    const width = svgRef.current!.clientWidth;
    const height = svgRef.current!.clientHeight;

    // Create tree layout with explicit center position and consistent spacing
    const { nodes, links: pathLinks, linkPathGenerator } = createTreeLayout(jobs, links, {
      width,
      height,
      direction: 'vertical',
      nodeWidth: 180,
      nodeHeight: 80,
      levelSpacing: 200,
      siblingSpacing: 250, // Increased for more consistent spacing
      centerX: width / 2,
      centerY: 120
    });

    // Create curved links
    const link = createTreeLinks(container, pathLinks, linkPathGenerator);

    // Create nodes
    const node = createNodes(container, nodes, {
      width: 180,
      height: 80,
      fill: '#4299e1',
      stroke: '#2b6cb0',
      onClick: (event: any, d: any) => {
        setSelectedJob(d.id);
        setViewMode('steps');
      },
      showShadow: true
    });

    // Add job name
    addTextToNodes(node, {
      text: (d: any) => d.name,
      x: 90,
      y: 30,
      fontSize: '14px',
      fontWeight: 'bold',
      fill: 'white'
    });

    // Add runner info
    addTextToNodes(node, {
      text: (d: any) => `runs-on: ${d.runsOn}`,
      x: 90,
      y: 50,
      fontSize: '12px',
      fontWeight: 'normal',
      fill: 'white'
    });

    // Add step count
    addTextToNodes(node, {
      text: (d: any) => `${d.stepCount} step${d.stepCount !== 1 ? 's' : ''}`,
      x: 90,
      y: 68,
      fontSize: '12px',
      fontWeight: 'normal',
      fill: 'white'
    });

    // Add env indicator
    addIndicator(node, {
      filter: (d: any) => d.hasEnv,
      cx: 165,
      cy: 15,
      radius: 6,
      fill: '#48bb78'
    });

    // Position nodes
    node.attr('transform', (d: any) => `translate(${d.x - 90}, ${d.y - 40})`);
  };

  const renderStepsGraph = (container: any, jobId: string) => {
    const job = workflow.jobs[jobId];
    if (!job || !job.steps) return;

    // Create steps data
    const steps = job.steps.map((step: any, index: number) => {
      const stepId = `step-${index}`;
      const variables = analyzeStepVariables(step);

      return {
        id: stepId,
        name: step.name || `Step ${index + 1}`,
        uses: step.uses,
        run: step.run,
        hasEnv: !!step.env,
        hasVariables: variables.length > 0,
        variables,
      };
    });

    // Create sequential links between steps
    const links = steps.slice(0, -1).map((step: { id: string }, index: number) => ({
      source: step.id,
      target: `step-${index + 1}`,
    }));

    // Set up the SVG
    const width = svgRef.current!.clientWidth;
    const height = svgRef.current!.clientHeight;

    // Create tree layout - for steps we use a simple vertical chain with consistent spacing
    const { nodes, links: pathLinks, linkPathGenerator } = createTreeLayout(steps, links, {
      width,
      height,
      direction: 'vertical',
      nodeWidth: 180,
      nodeHeight: 100,
      levelSpacing: 200, // Increased for more consistent spacing
      siblingSpacing: 250, // Increased for more consistent spacing
      centerX: width / 2,
      centerY: 120
    });

    // Create curved links
    const link = createTreeLinks(container, pathLinks, linkPathGenerator);

    // Create nodes
    const node = createNodes(container, nodes, {
      width: 180,
      height: 100,
      fill: (d: any) => d.uses ? '#8B5CF6' : '#F59E0B',
      stroke: (d: any) => d.uses ? '#6D28D9' : '#D97706',
      onClick: (event: any, d: any) => {
        setSelectedStep(d);
      },
      showShadow: true
    });

    // Add step name
    addTextToNodes(node, {
      text: (d: any) => d.name,
      x: 90,
      y: 30,
      fontSize: '14px',
      fontWeight: 'bold',
      fill: 'white',
      maxLength: 20
    });

    // Add action/command info
    addTextToNodes(node, {
      text: (d: any) => d.uses ? `uses: ${d.uses.split('@')[0]}` : 'run command',
      x: 90,
      y: 50,
      fontSize: '12px',
      fontWeight: 'normal',
      fill: 'white',
      maxLength: 25
    });

    // Add version info for actions
    node.filter((d: any) => d.uses)
      .call(node => {
        addTextToNodes(node, {
          text: (d: any) => `@${d.uses.split('@')[1] || 'latest'}`,
          x: 90,
          y: 70,
          fontSize: '12px',
          fontWeight: 'normal',
          fill: 'white'
        });
      });

    // Add variables indicator
    addIndicator(node, {
      filter: (d: any) => d.hasVariables,
      cx: 165,
      cy: 15,
      radius: 6,
      fill: '#48bb78'
    });

    // Position nodes
    node.attr('transform', (d: any) => `translate(${d.x - 90}, ${d.y - 50})`);
  };

  if (isEmptyWorkflow) {
    return <div className="h-full flex flex-col">
      <div
          className={`flex-1 border rounded-md overflow-auto p-4 flex items-center justify-center ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
               xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3 className="text-lg font-medium mb-2">No Workflow to Visualize</h3>
          <p>Paste a GitHub Actions workflow on the left to see the visualization.</p>
        </div>
      </div>
    </div>
  }

  if (hasValidationErrors()) {
    return <div className="h-full flex flex-col">
      <div
          className={`flex-1 border rounded-md overflow-auto p-4 flex items-center justify-center ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
               xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <h3 className="text-lg font-medium mb-2">Cannot Visualize Workflow</h3>
          <p className="mb-4">The workflow contains errors that prevent visualization.</p>
          {errors.filter(error => error.type === 'error').length > 0 && (
              <div
                  className={`text-left p-4 rounded-md ${isDarkMode ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-700'}`}>
                <h4 className="font-medium mb-2">Errors to fix:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {errors.filter(error => error.type === 'error').map((error, index) => (
                      <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
          )}
        </div>
      </div>
    </div>
  }

  return (
      <div className="h-full flex flex-col">
        <div className="mb-4 text-sm text-gray-600 flex justify-between">
          <div>
            {viewMode === 'jobs' && (
                <span>Click on a job to see its steps. Green dots indicate jobs with environment variables.</span>
            )}

            {viewMode === 'steps' && (
                <span>Purple nodes are actions, orange nodes are commands. Click on a step to see variable details.</span>
            )}
          </div>
        </div>
        <div className={`flex-1 border rounded-md overflow-hidden ${isDarkMode ? 'border-gray-700 bg-[#1e1e1e]' : 'border-gray-200 bg-white'}`}>
          <svg ref={svgRef} width="100%" height="100%"></svg>
        </div>
      </div>
  );
}
