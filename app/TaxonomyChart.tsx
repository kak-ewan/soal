'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Question {
  number: number;
  text?: string;
  type: string;
  correctAnswer?: string;
  rubrikAsesmen?: string;
  taxonomyLevel?: string;
  taxonomyAnalysis?: string;
  profilLulusanDimensi?: string;
  prinsipPM?: string;
  hasIllustration: boolean;
  illustrationPrompt: string;
  renderedSvg?: string;
  indikatorSoal?: string;
  stimulusAsesmen?: string;
  materiTopik?: string;
}

interface TaxonomyChartProps {
  questions: Question[];
  taksonomi: "SOLO" | "BLOOM";
  soloLevels: string[];
  bloomLevels: string[];
}

export default function TaxonomyChart({
  questions,
  taksonomi,
  soloLevels,
  bloomLevels,
}: TaxonomyChartProps) {
  const barChartRef = useRef<SVGSVGElement | null>(null);
  const pieChartRef = useRef<SVGSVGElement | null>(null);

  // 1. Process data for Taxonomy
  const activeLevels = taksonomi === "SOLO" ? soloLevels : bloomLevels;
  
  const taxonomyData = activeLevels.map(level => {
    const count = questions.filter(q => {
      if (!q.taxonomyLevel) return false;
      const levelNorm = level.toLowerCase().trim();
      const qNorm = q.taxonomyLevel.toLowerCase().trim();
      return qNorm === levelNorm || qNorm.includes(levelNorm) || levelNorm.includes(qNorm);
    }).length;

    // Map code to short display for Bloom
    let shortName = level;
    if (taksonomi === "BLOOM") {
      if (level.includes("Mengingat")) shortName = "C1 Mengingat";
      else if (level.includes("Memahami")) shortName = "C2 Memahami";
      else if (level.includes("Menerapkan")) shortName = "C3 Menerapkan";
      else if (level.includes("Menganalisis")) shortName = "C4 Menganalisis";
      else if (level.includes("Mengevaluasi")) shortName = "C5 Mengevaluasi";
      else if (level.includes("Mencipta")) shortName = "C6 Mencipta";
    }
    return { name: level, displayName: shortName, count };
  });

  // 2. Process data for Dimensi Profil Lulusan
  const dimensiCounts: { [key: string]: number } = {};
  questions.forEach(q => {
    const dim = q.profilLulusanDimensi || "Mandiri";
    // Get primary dimension (before comma/ampersand)
    let cleanDim = dim.split(',')[0].split('&')[0].trim();
    if (cleanDim.length > 25) cleanDim = cleanDim.slice(0, 22) + '...';
    dimensiCounts[cleanDim] = (dimensiCounts[cleanDim] || 0) + 1;
  });

  const dimensiData = Object.entries(dimensiCounts).map(([name, count]) => ({
    name,
    count,
  }));

  // Render Bar Chart
  useEffect(() => {
    if (!barChartRef.current) return;

    // Clear previous drawings
    d3.select(barChartRef.current).selectAll('*').remove();

    const svg = d3.select(barChartRef.current);
    const width = 450;
    const height = 240;
    const margin = { top: 25, right: 35, bottom: 40, left: 95 };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X scale
    const maxVal = d3.max(taxonomyData, d => d.count) || 4;
    const x = d3.scaleLinear()
      .domain([0, maxVal])
      .range([0, chartWidth]);

    // Y scale
    const y = d3.scaleBand()
      .domain(taxonomyData.map(d => d.displayName))
      .range([0, chartHeight])
      .padding(0.28);

    // Grid lines for X - soft slate lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(
        d3.axisBottom(x)
          .tickSize(-chartHeight)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#f1f5f9').attr('stroke-width', 1.5));

    // Axes
    const xAxis = d3.axisBottom(x).ticks(Math.min(5, maxVal)).tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(y).tickSize(0);

    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
      .call(g => g.select('.domain').attr('stroke', '#e2e8f0'))
      .call(g => g.selectAll('text').attr('fill', '#94a3b8').style('font-size', '9px').style('font-family', 'var(--font-mono, monospace)'));

    const yAxisG = g.append('g').call(yAxis);
      
    yAxisG.call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#475569')
      .style('font-size', '9.5px')
      .style('font-weight', '600')
      .style('font-family', 'inherit')
      .attr('dx', '-8px');

    // Custom beautiful teal to blue color array for consistency
    const barColors = ["#0d9488", "#0f766e", "#14b8a6", "#0284c7", "#3b82f6", "#6366f1"];
    const color = (i: number) => barColors[i % barColors.length];

    // Bars
    const bars = g.selectAll('.bar-group')
      .data(taxonomyData)
      .enter()
      .append('g')
      .attr('class', 'bar-group');

    // Rounded bar rectangles
    bars.append('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.displayName) || 0)
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', (d, i) => color(i))
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr('width', d => x(d.count));

    // Poin label counts
    bars.append('text')
      .attr('class', 'bar-label')
      .attr('y', d => (y(d.displayName) || 0) + y.bandwidth() / 2)
      .attr('x', d => x(d.count) + 8)
      .attr('dy', '.35em')
      .attr('text-anchor', 'start')
      .attr('fill', '#334155')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('font-family', 'var(--font-mono, monospace)')
      .text(d => d.count > 0 ? `${d.count}` : '')
      .style('opacity', 0)
      .transition()
      .delay(200)
      .duration(400)
      .style('opacity', 1);

    // Interactivity
    bars.selectAll('rect')
      .on('mouseover', function() {
        d3.select(this)
          .transition()
          .duration(120)
          .attr('fill-opacity', 0.85);
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(120)
          .attr('fill-opacity', 1.0);
      });

  }, [questions, taksonomi, soloLevels, bloomLevels, taxonomyData]);

  // Render Donut Chart for Dimensi Profil Lulusan
  useEffect(() => {
    if (!pieChartRef.current || dimensiData.length === 0) return;

    d3.select(pieChartRef.current).selectAll('*').remove();

    const svg = d3.select(pieChartRef.current);
    const width = 450;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 25;

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2 - 50}, ${height / 2})`);

    // Merdeka Curriculum visual color palette
    const color = d3.scaleOrdinal<string>()
      .domain(dimensiData.map(d => d.name))
      .range(['#0d9488', '#4f46e5', '#ca8a04', '#059669', '#db2777', '#7c3aed', '#2563eb', '#dc2626']);

    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(radius * 0.45)
      .outerRadius(radius * 0.82)
      .cornerRadius(4);

    const arcHover = d3.arc<any>()
      .innerRadius(radius * 0.45)
      .outerRadius(radius * 0.90)
      .cornerRadius(4);

    const arcs = g.selectAll('.arc')
      .data(pie(dimensiData))
      .enter()
      .append('g')
      .attr('class', 'arc');

    // Draw donut arcs
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .attr('stroke', '#ffffff')
      .style('stroke-width', '2px')
      .style('cursor', 'pointer')
      .transition()
      .duration(700)
      .attrTween('d', function(d: any) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t)) || '';
        };
      });

    // Donut label inner
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.15em')
      .style('font-size', '10px')
      .style('font-weight', '500')
      .style('fill', '#94a3b8')
      .text('TOTAL SOAL');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.85em')
      .style('font-size', '22px')
      .style('font-weight', '800')
      .style('fill', '#1e293b')
      .style('font-family', 'var(--font-mono, monospace)')
      .text(questions.length);

    // Donut chart Legend on the right
    const legendG = svg.append('g')
      .attr('transform', `translate(${width - 175}, 35)`);

    const legendItems = legendG.selectAll('.legend-item')
      .data(dimensiData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 22})`);

    legendItems.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 3)
      .attr('fill', d => color(d.name));

    legendItems.append('text')
      .attr('x', 16)
      .attr('y', 9)
      .style('font-size', '9.5px')
      .style('font-weight', '700')
      .style('fill', '#475569')
      .text(d => {
        const title = d.name.length > 17 ? d.name.slice(0, 15) + '..' : d.name;
        return `${title} (${d.count})`;
      });

    // Handle interactive hover expansions
    arcs.selectAll('path')
      .on('mouseover', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr('d', arcHover);
      })
      .on('mouseout', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(120)
          .attr('d', arc);
      });

  }, [questions, dimensiData]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 no-print">
      {/* 1. Bar Chart container */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
        <div>
          <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-display mb-1">
            📊 Sebaran Level Taksonomi ({taksonomi})
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
            Menunjukkan sebaran tingkat penguasaan kognitif dari paket soal yang dirancang secara visual.
          </p>
        </div>
        <div className="flex justify-center mt-3 select-none">
          <svg
            ref={barChartRef}
            width="100%"
            height="180"
            viewBox="0 0 450 240"
            preserveAspectRatio="xMidYMid meet"
            className="w-full max-w-[450px]"
          />
        </div>
      </div>

      {/* 2. Donut Chart container */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
        <div>
          <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 font-display mb-1">
            🎯 Orientasi Dimensi Profil Lulusan
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
            Persentase porsi integrasi penanaman Dimensi Profil Lulusan pada seluruh butir soal.
          </p>
        </div>
        <div className="flex justify-center mt-3 select-none">
          {dimensiData.length > 0 ? (
            <svg
              ref={pieChartRef}
              width="100%"
              height="180"
              viewBox="0 0 450 240"
              preserveAspectRatio="xMidYMid meet"
              className="w-full max-w-[450px]"
            />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-slate-400 italic text-[10.5px]">
              Belum ada data dimensi Profil Lulusan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
