"use client";
import * as d3 from 'd3';
import { useEffect, useRef } from 'react';

export type GroupedBarsData = {
  label: string; // e.g., 'Run', 'Ride', 'Swim'
  values: { period: string; value: number }[]; // period: 'Last 7', 'This Month', 'YTD'
};

export default function D3GroupedBars({ data }: { data: GroupedBarsData[] }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 360;
    const margin = { top: 30, right: 20, bottom: 50, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const periods = Array.from(new Set(data.flatMap((d) => d.values.map((v) => v.period))));
    const x0 = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.label))
      .range([margin.left, margin.left + innerWidth])
      .paddingInner(0.2);
    const x1 = d3
      .scaleBand<string>()
      .domain(periods)
      .range([0, x0.bandwidth()])
      .padding(0.1);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data.flatMap((d) => d.values.map((v) => v.value))) || 0])
      .nice()
      .range([margin.top + innerHeight, margin.top]);

    const color = d3.scaleOrdinal<string, string>()
      .domain(periods)
      .range(['#60a5fa', '#34d399', '#fbbf24']);

    // Axes
    svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top + innerHeight})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .style('font-size', '12px');

    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '12px');

    // Bars
    const groups = svg
      .append('g')
      .selectAll('g')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d.label)},0)`);

    groups
      .selectAll('rect')
      .data((d) => d.values.map((v) => ({ ...v, label: d.label })))
      .enter()
      .append('rect')
      .attr('x', (d) => x1(d.period) || 0)
      .attr('y', (d) => y(d.value))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => y.range()[0] - y(d.value))
      .attr('fill', (d) => color(d.period));

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    periods.forEach((p, i) => {
      const g = legend.append('g').attr('transform', `translate(${i * 140}, 0)`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(p));
      g.append('text').attr('x', 18).attr('y', 10).text(p).style('font-size', '12px');
    });
  }, [data]);

  return <svg ref={ref} className="w-full h-auto" role="img" aria-label="Activity distances chart" />;
}



