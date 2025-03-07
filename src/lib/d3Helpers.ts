import * as d3 from 'd3';

/**
 * Creates a node group with a rectangle and text elements
 * @param container - The D3 selection container to append nodes to
 * @param data - The data array for the nodes
 * @param options - Configuration options for the nodes
 * @returns The created node selection
 */
export function createNodes(
  container: d3.Selection<any, any, any, any>,
  data: any[],
  options: {
    width?: number;
    height?: number;
    rx?: number;
    fill?: string | ((d: any) => string);
    stroke?: string | ((d: any) => string);
    onClick?: (event: any, d: any) => void;
    showShadow?: boolean;
  }
) {
  const {
    width = 180,
    height = 80,
    rx = 8,
    fill = '#4299e1',
    stroke = '#2b6cb0',
    onClick,
    showShadow = true
  } = options;

  // Create node groups
  const node = container.append('g')
    .selectAll('g')
    .data(data)
    .enter()
    .append('g');

  // Add click handler if provided
  if (onClick) {
    node.on('click', onClick);
  }

  // Add rectangles for nodes
  node.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('rx', rx)
    .attr('ry', rx)
    .attr('fill', fill)
    .attr('stroke', stroke)
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer');

  // Add shadow if requested
  if (showShadow) {
    node.select('rect')
      .attr('filter', 'drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.2))');
  }

  return node;
}

/**
 * Adds text to node elements
 * @param node - The D3 selection of nodes
 * @param options - Configuration options for the text
 */
export function addTextToNodes(
  node: d3.Selection<any, any, any, any>,
  options: {
    text: string | ((d: any) => string);
    x?: number;
    y?: number;
    fontSize?: string;
    fontWeight?: string;
    fill?: string;
    textAnchor?: string;
    maxLength?: number;
  }
) {
  const {
    text,
    x = 90,
    y = 30,
    fontSize = '14px',
    fontWeight = 'bold',
    fill = 'white',
    textAnchor = 'middle',
    maxLength
  } = options;

  node.append('text')
    .attr('text-anchor', textAnchor)
    .attr('x', x)
    .attr('y', y)
    .attr('fill', fill)
    .attr('font-weight', fontWeight)
    .attr('font-size', fontSize)
    .text((d: any) => {
      const textValue = typeof text === 'function' ? text(d) : text;
      if (maxLength && textValue.length > maxLength) {
        return textValue.substring(0, maxLength - 3) + '...';
      }
      return textValue;
    })
    .attr('cursor', 'pointer');
}

/**
 * Creates a force simulation for graph layout
 * @param nodes - The nodes array
 * @param links - The links array
 * @param options - Configuration options for the simulation
 * @returns The created force simulation
 */
export function createForceSimulation(
  nodes: any[],
  links: any[],
  options: {
    width: number;
    height: number;
    linkDistance?: number;
    chargeStrength?: number;
    verticalSpacing?: number;
    verticalStrength?: number;
    horizontalStrength?: number;
    collisionRadius?: number;
    collisionStrength?: number;
    nodeWidth?: number;
    nodeHeight?: number;
  }
) {
  const {
    width,
    height,
    linkDistance = 200,
    chargeStrength = -1500,
    verticalSpacing = 150,
    verticalStrength = 0.2,
    horizontalStrength = 0.1,
    collisionRadius = 100,
    collisionStrength = 0.8,
    nodeWidth = 90,
    nodeHeight = 40
  } = options;

  // Create a force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(linkDistance))
    .force('charge', d3.forceManyBody().strength(chargeStrength))
    .force('center', d3.forceCenter(width / 2, height / 2))
    // Add y-positioning force for vertical layout
    .force('y', d3.forceY().strength(verticalStrength).y((d: any, i) => {
      return (i * verticalSpacing) + 100;
    }))
    // Reduce x-force to keep nodes more aligned vertically
    .force('x', d3.forceX().strength(horizontalStrength).x(width / 2))
    // Add collision detection to prevent overlap
    .force('collision', d3.forceCollide().radius(collisionRadius).strength(collisionStrength));

  // Fix nodes in place after initial layout
  simulation.on('end', () => {
    nodes.forEach((d: any) => {
      d.fx = d.x;
      d.fy = d.y;
    });
  });

  // Update positions on simulation tick
  simulation.on('tick', () => {
    // Constrain nodes to stay within bounds
    nodes.forEach((d: any) => {
      d.x = Math.max(nodeWidth, Math.min(width - nodeWidth, d.x));
      d.y = Math.max(nodeHeight, Math.min(height - nodeHeight, d.y));
      
      // Fix position after initial layout
      if (simulation.alpha() < 0.1) {
        d.fx = d.x;
        d.fy = d.y;
      }
    });
  });

  return simulation;
}

/**
 * Creates links between nodes
 * @param container - The D3 selection container to append links to
 * @param links - The links data array
 * @param options - Configuration options for the links
 * @returns The created link selection
 */
export function createLinks(
  container: d3.Selection<any, any, any, any>,
  links: any[],
  options: {
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    markerEnd?: string;
    createArrowMarker?: boolean;
  } = {}
) {
  const {
    stroke = '#999',
    strokeWidth = 2,
    strokeOpacity = 0.6,
    markerEnd = 'url(#arrowhead)',
    createArrowMarker = true
  } = options;

  // Create arrow marker if requested
  if (createArrowMarker) {
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
      .attr('fill', stroke)
      .style('stroke', 'none');
  }

  // Draw links
  const link = container.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', stroke)
    .attr('stroke-opacity', strokeOpacity)
    .attr('stroke-width', strokeWidth)
    .attr('marker-end', markerEnd);

  return link;
}

/**
 * Updates the positions of links and nodes based on simulation
 * @param link - The D3 selection of links
 * @param node - The D3 selection of nodes
 * @param nodeWidth - The width offset for node positioning
 * @param nodeHeight - The height offset for node positioning
 */
export function updatePositions(
  link: d3.Selection<any, any, any, any>,
  node: d3.Selection<any, any, any, any>,
  nodeWidth: number = 90,
  nodeHeight: number = 40
) {
  link
    .attr('x1', (d: any) => d.source.x)
    .attr('y1', (d: any) => d.source.y)
    .attr('x2', (d: any) => d.target.x)
    .attr('y2', (d: any) => d.target.y);

  node
    .attr('transform', (d: any) => `translate(${d.x - nodeWidth}, ${d.y - nodeHeight})`);
}

/**
 * Adds an indicator circle to nodes
 * @param node - The D3 selection of nodes
 * @param options - Configuration options for the indicator
 */
export function addIndicator(
  node: d3.Selection<any, any, any, any>,
  options: {
    filter: (d: any) => boolean;
    cx?: number;
    cy?: number;
    radius?: number;
    fill?: string;
  }
) {
  const {
    filter,
    cx = 165,
    cy = 15,
    radius = 6,
    fill = '#48bb78'
  } = options;

  node.filter(filter)
    .append('circle')
    .attr('cx', cx)
    .attr('cy', cy)
    .attr('r', radius)
    .attr('fill', fill)
    .attr('cursor', 'pointer');
} 