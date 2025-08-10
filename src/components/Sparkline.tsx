"use client";
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

export default function Sparkline({ values, color = '#FF4D00', height = 36, compareValues, compareColor = '#ffffff55' }: { values: number[]; color?: string; height?: number; compareValues?: number[]; compareColor?: string }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = 160;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    if (!values || values.length === 0) return;

    const x = d3.scaleLinear().domain([0, values.length - 1]).range([0, width]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(values) || 0])
      .nice()
      .range([height - 2, 2]);

    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    svg
      .append('path')
      .attr('d', line(values) || '')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    if (compareValues && compareValues.length === values.length) {
      svg
        .append('path')
        .attr('d', line(compareValues) || '')
        .attr('fill', 'none')
        .attr('stroke', compareColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3 3')
        .attr('opacity', 0.8);
    }
  }, [values, color, height, compareValues, compareColor]);

  return <svg ref={ref} className="w-full h-auto text-[currentColor]" />;
}


