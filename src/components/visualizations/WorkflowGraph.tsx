'use client';

import {useEffect, useRef, useState} from 'react';
import * as d3 from 'd3';
import {useTheme} from '@/context/ThemeContext';
import { checkWorkflowForErrors, WorkflowError } from '@/lib/workflowErrorChecker';

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
    const container = svg.append('g')
      .attr('class', 'container');

    // Add a background rect to catch zoom events
    container.append('rect')
      .attr('width', width * 3)
      .attr('height', height * 3)
      .attr('x', -width)
      .attr('y', -height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all');

    // Add zoom controls (fixed position)
    const controls = svg.append('g')
      .attr('class', 'zoom-controls')
      .attr('transform', `translate(${width - 100}, 20)`);

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
          .attr('fill', 'white') // Same as zoom button text
          .attr('font-size', '14px')  // Smaller to match button text
          .attr('font-weight', 'normal')  // Remove bold
          .text(`Job: ${selectedJob ? (workflow.jobs[selectedJob]?.name || selectedJob) : ''}`);
    }

    // Add help text (fixed position)
    svg.append('text')
      .attr('x', 20)
      .attr('y', height - 20)
      .attr('text-anchor', 'start')
      .attr('font-size', '12px')
      .attr('fill', '#6B7280')
      .text('Scroll to zoom, drag to pan, double-click to reset view');

    if (viewMode === 'jobs') {
      renderJobsGraph(container);
    } else if (viewMode === 'steps' && selectedJob) {
      renderStepsGraph(container, selectedJob);
    }

    // Add variable details panel if a step is selected
    if (selectedStep) {
      // Create a fixed panel in the top right with scrollable content
      const panelWidth = 320;
      const panelHeight = Math.min(500, height - 100);

      // Panel container
      const detailsPanel = svg.append('g')
        .attr('class', 'details-panel')
        .attr('transform', `translate(${width - panelWidth - 20}, 70)`);

      // Panel background
      detailsPanel.append('rect')
        .attr('width', panelWidth)
        .attr('height', panelHeight)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', 'white')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 2)
        .attr('opacity', 0.98);

      // Panel header background
      detailsPanel.append('rect')
        .attr('width', panelWidth)
        .attr('height', 40)
        .attr('rx', 8)
        .attr('ry', 0)
        .attr('fill', '#3B82F6')
        .attr('opacity', 0.9);

      // Close button
      const closeButton = detailsPanel.append('g')
        .attr('transform', `translate(${panelWidth - 30}, 20)`)
        .attr('cursor', 'pointer')
        .on('click', () => {
          setSelectedStep(null);
        });

      closeButton.append('circle')
        .attr('r', 12)
        .attr('fill', 'white')
        .attr('opacity', 0.8);

      closeButton.append('text')
        .attr('x', 0)
        .attr('y', 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .attr('fill', '#3B82F6')
        .text('×');

      // Panel title
      detailsPanel.append('text')
        .attr('x', 15)
        .attr('y', 25)
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .text('Step Details');

      // Create a clipping path for scrollable content
      detailsPanel.append('defs')
        .append('clipPath')
        .attr('id', 'details-clip')
        .append('rect')
        .attr('x', 0)
        .attr('y', 40)
        .attr('width', panelWidth)
        .attr('height', panelHeight - 40);

      // Scrollable content container
      const content = detailsPanel.append('g')
        .attr('clip-path', 'url(#details-clip)')
        .attr('transform', 'translate(0, 40)');

      // Add scrollbar
      const scrollbarWidth = 8;
      const scrollbarTrack = detailsPanel.append('rect')
        .attr('x', panelWidth - scrollbarWidth - 5)
        .attr('y', 45)
        .attr('width', scrollbarWidth)
        .attr('height', panelHeight - 50)
        .attr('rx', 4)
        .attr('fill', '#E5E7EB');

      // Calculate scrollbar height and position based on content
      const contentHeight = (selectedStep.variables?.length || 0) * 90 + 120;
      const visibleHeight = panelHeight - 40;
      const scrollRatio = Math.min(1, visibleHeight / contentHeight);
      const scrollbarHeight = Math.max(30, scrollRatio * (panelHeight - 50));

      const scrollbarThumb = detailsPanel.append('rect')
        .attr('x', panelWidth - scrollbarWidth - 5)
        .attr('y', 45)
        .attr('width', scrollbarWidth)
        .attr('height', scrollbarHeight)
        .attr('rx', 4)
        .attr('fill', '#9CA3AF')
        .attr('cursor', 'pointer');

      // Add scroll behavior
      let scrollPos = 0;
      const maxScroll = Math.max(0, contentHeight - visibleHeight);

      // Mouse wheel scrolling
      svg.on('wheel.scroll', function(event) {
        if (selectedStep) {
          event.preventDefault();
          const delta = event.deltaY;
          scrollPos = Math.min(maxScroll, Math.max(0, scrollPos + delta));
          updateScroll();
        }
      });

      // Drag scrollbar
      const scrollDrag = d3.drag()
        .on('drag', function(event) {
          const trackHeight = panelHeight - 50 - scrollbarHeight;
          const dragRatio = event.dy / trackHeight;
          const scrollDelta = dragRatio * maxScroll;
          scrollPos = Math.min(maxScroll, Math.max(0, scrollPos + scrollDelta));
          updateScroll();
        });

      scrollbarThumb.call(scrollDrag as any);

      function updateScroll() {
        const scrollRatio = maxScroll > 0 ? scrollPos / maxScroll : 0;
        const thumbY = 45 + scrollRatio * (panelHeight - 50 - scrollbarHeight);

        content.attr('transform', `translate(0, ${40 - scrollPos})`);
        scrollbarThumb.attr('y', thumbY);
      }

      // Step name
      content.append('text')
        .attr('x', 15)
        .attr('y', 25)
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .attr('fill', '#111827')
        .text(selectedStep.name);

      // Step type
      content.append('text')
        .attr('x', 15)
        .attr('y', 50)
        .attr('font-size', '14px')
        .attr('fill', '#4B5563')
        .text(selectedStep.uses
          ? `Action: ${selectedStep.uses}`
          : `Command: ${selectedStep.run || 'None'}`);

      // Variables section
      content.append('rect')
        .attr('x', 15)
        .attr('y', 65)
        .attr('width', panelWidth - 30)
        .attr('height', 30)
        .attr('rx', 4)
        .attr('fill', '#F3F4F6');

      content.append('text')
        .attr('x', 25)
        .attr('y', 85)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#111827')
        .text('Variables');

      if (selectedStep.variables && selectedStep.variables.length > 0) {
        const variablesList = content.append('g')
          .attr('transform', 'translate(0, 100)');

        selectedStep.variables.forEach((variable, index) => {
          const yOffset = index * 90;

          // Variable box
          variablesList.append('rect')
            .attr('x', 15)
            .attr('y', yOffset)
            .attr('width', panelWidth - 45) // Make room for scrollbar
            .attr('height', 80)
            .attr('rx', 4)
            .attr('fill', (d) => {
              if (variable.type === 'expression') return '#EFF6FF'; // Blue bg for expressions
              if (variable.type === 'env') return '#ECFDF5'; // Green bg for env vars
              if (variable.type === 'github_env') return '#FEF3C7'; // Yellow bg for GitHub env
              if (variable.type === 'export') return '#F5F3FF'; // Purple bg for exports
              return '#F9FAFB';
            })
            .attr('stroke', (d) => {
              if (variable.type === 'expression') return '#BFDBFE'; // Blue border
              if (variable.type === 'env') return '#A7F3D0'; // Green border
              if (variable.type === 'github_env') return '#FDE68A'; // Yellow border
              if (variable.type === 'export') return '#DDD6FE'; // Purple border
              return '#E5E7EB';
            })
            .attr('stroke-width', 1);

          // Variable name/expression
          variablesList.append('text')
            .attr('x', 25)
            .attr('y', yOffset + 25)
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#111827')
            .text(() => {
              if (variable.type === 'expression') {
                return `$\{\{ ${variable.expression} \}\}`;
              } else if (variable.type === 'env') {
                return `env.${variable.name}`;
              } else if (variable.type === 'github_env') {
                return `${variable.name}=${variable.value.substring(0, 30)}${variable.value.length > 30 ? '...' : ''}`;
              } else if (variable.type === 'export') {
                return `export ${variable.name}=${variable.value.substring(0, 25)}${variable.value.length > 25 ? '...' : ''}`;
              } else {
                return 'Unknown variable';
              }
            });

          // Variable value/prediction
          variablesList.append('text')
            .attr('x', 25)
            .attr('y', yOffset + 50)
            .attr('font-size', '13px')
            .attr('fill', '#4B5563')
            .text(() => {
              if (variable.type === 'expression') {
                return `Predicted: ${variable.predictedValue}`;
              } else if (variable.type === 'env') {
                return `Value: ${variable.value}`;
              } else if (variable.predictedValue) {
                return `Example: ${variable.predictedValue}`;
              } else if (variable.note) {
                return variable.note;
              } else {
                return 'No prediction available';
              }
            });

          // Additional info if available
          if (variable.note && !variable.note.includes('This variable will be available')) {
            variablesList.append('text')
              .attr('x', 25)
              .attr('y', yOffset + 70)
              .attr('font-size', '12px')
              .attr('fill', '#6B7280')
              .text(variable.note);
          }
        });
      } else {
        content.append('text')
          .attr('x', 25)
          .attr('y', 120)
          .attr('font-size', '14px')
          .attr('fill', '#6B7280')
          .text('No variables used in this step');
      }
    }

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

    // Create a force simulation with vertical layout
    const simulation = d3.forceSimulation(jobs as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      // Add y-positioning force for vertical layout
      .force('y', d3.forceY().strength(0.1).y((d: any, i) => {
        return (i * 120) + 100; // Position jobs vertically with spacing
      }))
      // Reduce x-force to keep jobs more aligned vertically
      .force('x', d3.forceX().strength(0.1).x(width / 2));

    // Draw links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Define arrow marker
    container.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // Draw nodes
    const node = container.append('g')
      .selectAll('g')
      .data(jobs)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event: any, d: any) => {
        setSelectedJob(d.id);
        setViewMode('steps');
      });

    // Add rectangles for nodes with increased size
    node.append('rect')
      .attr('width', 180)
      .attr('height', 80)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', '#4299e1')
      .attr('stroke', '#2b6cb0')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer');

    // Add job name with better text positioning
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 30)
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .attr('font-size', '14px')
      .text((d: any) => d.name)
      .attr('cursor', 'pointer');

    // Add runner info
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 50)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text((d: any) => `runs-on: ${d.runsOn}`)
      .attr('cursor', 'pointer');

    // Add step count
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 68)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text((d: any) => `${d.stepCount} step${d.stepCount !== 1 ? 's' : ''}`)
      .attr('cursor', 'pointer');

    // Add env indicator
    node.filter((d: any) => d.hasEnv)
      .append('circle')
      .attr('cx', 165)
      .attr('cy', 15)
      .attr('r', 6)
      .attr('fill', '#48bb78')
      .attr('cursor', 'pointer');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x - 90}, ${d.y - 40})`);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
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

    // Create links between steps (sequential)
    const links = steps.slice(0, -1).map((step: { id: string }, index: number) => ({
      source: step.id,
      target: `step-${index + 1}`,
    }));

    // Set up the SVG
    const width = svgRef.current!.clientWidth;
    const height = svgRef.current!.clientHeight;

    // Create a force simulation with vertical layout
    const simulation = d3.forceSimulation(steps as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      // Add y-positioning force for vertical layout
      .force('y', d3.forceY().strength(0.2).y((d: any, i) => {
        return (i * 120) + 100; // Position steps vertically with spacing
      }))
      // Reduce x-force to keep steps more aligned vertically
      .force('x', d3.forceX().strength(0.2).x(width / 2));

    // Draw links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Define arrow marker
    container.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    // Draw nodes
    const node = container.append('g')
      .selectAll('g')
      .data(steps)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))
      .on('click', (event: any, d: any) => {
        setSelectedStep(d);
      });

    // Add rectangles for nodes
    node.append('rect')
      .attr('width', 180)
      .attr('height', 100)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (d: any) => d.uses ? '#8B5CF6' : '#F59E0B')
      .attr('stroke', (d: any) => d.uses ? '#6D28D9' : '#D97706')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer');

    // Add step name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 30)
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .attr('font-size', '14px')
      .text((d: any) => d.name.length > 20 ? d.name.substring(0, 17) + '...' : d.name);

    // Add action/command info
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 55)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text((d: any) => {
        if (d.uses) return `uses: ${d.uses.length > 20 ? d.uses.substring(0, 17) + '...' : d.uses}`;
        if (d.run) return `run: ${d.run.length > 20 ? d.run.substring(0, 17) + '...' : d.run}`;
        return 'No action or command';
      });

    // Add variable indicator
    node.filter((d: any) => d.hasVariables)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', 90)
      .attr('y', 80)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text((d: any) => `Uses ${d.variables.length} variable${d.variables.length !== 1 ? 's' : ''}`);

    // Add env indicator
    node.filter((d: any) => d.hasEnv)
      .append('circle')
      .attr('cx', 165)
      .attr('cy', 15)
      .attr('r', 6)
      .attr('fill', '#48bb78')
      .attr('cursor', 'pointer');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x - 90}, ${d.y - 50})`);
    });

    // Drag functions
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
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
