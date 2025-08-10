"use client";
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

export default function D3Bars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    const width = 360;
    const height = 220;
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const x = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.label))
      .range([margin.left, margin.left + innerW])
      .padding(0.2);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 0])
      .nice()
      .range([margin.top + innerH, margin.top]);

    svg.append('g').attr('transform', `translate(0, ${margin.top + innerH})`).call(d3.axisBottom(x));
    svg.append('g').attr('transform', `translate(${margin.left}, 0)`).call(d3.axisLeft(y));

    svg
      .append('g')
      .selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => x(d.label) || 0)
      .attr('y', (d) => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', (d) => y.range()[0] - y(d.value))
      .attr('fill', color);
  }, [data, color]);

  return <svg ref={ref} className="w-full h-auto" />;
}


