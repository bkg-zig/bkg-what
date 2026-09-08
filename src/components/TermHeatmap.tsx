import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { extractKeyTerms } from '../utils';

interface TermHeatmapProps {
  text: string;
}

export function TermHeatmap({ text }: TermHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !text) return;

    // Data prep
    const data = extractKeyTerms(text, 25);
    if (data.length === 0) return;

    // Calculate grid dimensions
    const cols = 5;
    const rows = Math.ceil(data.length / cols);

    // Get container width
    const containerWidth = containerRef.current.clientWidth;
    const width = containerWidth;
    
    // Define margins and cell sizes
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const cellSize = innerWidth / cols;
    const innerHeight = rows * cellSize;
    const height = innerHeight + margin.top + margin.bottom;

    // Clear previous SVG
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define color scale (Indigo scale to match theme)
    const maxCount = d3.max(data, d => d.count) || 1;
    const minCount = d3.min(data, d => d.count) || 0;
    
    // We map [0, maxCount] to a color range. Using an indigo range that matches the app's theme.
    const colorScale = d3.scaleLinear<string>()
      .domain([0, maxCount])
      .range(['rgba(0, 229, 255, 0.05)', 'rgba(0, 229, 255, 0.4)']); // from very dark cyan to bright cyan

    // Add cells
    const cells = g.selectAll('g.cell')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', (d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return `translate(${col * cellSize},${row * cellSize})`;
      });

    // Rectangles
    cells.append('rect')
      .attr('width', cellSize - 4) // 4px padding
      .attr('height', cellSize - 4)
      .attr('x', 2)
      .attr('y', 2)
      .attr('rx', 2) // sharp corners
      .attr('fill', d => colorScale(d.count))
      .attr('stroke', 'rgba(0, 229, 255, 0.3)')
      .attr('stroke-width', 1)
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 30)
      .attr('opacity', 1);

    // Text (Term)
    cells.append('text')
      .attr('x', cellSize / 2)
      .attr('y', cellSize / 2 - 4)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-weight', '400')
      .text(d => d.term.length > 10 ? d.term.substring(0, 8) + '...' : d.term)
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 30 + 200)
      .attr('opacity', 1);

    // Text (Count)
    cells.append('text')
      .attr('x', cellSize / 2)
      .attr('y', cellSize / 2 + 12)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--accent-cyan)')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(d => d.count)
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 30 + 200)
      .attr('opacity', 1);

    // Add tooltips
    cells.append('title')
      .text(d => `Term: ${d.term}\nFrequency: ${d.count}`);

  }, [text]);

  return (
    <div className="w-full mt-4" ref={containerRef}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-mono text-[var(--text-muted)] tracking-widest uppercase">Key Terms Heatmap</h3>
      </div>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
