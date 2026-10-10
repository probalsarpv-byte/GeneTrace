export function createChromatogramViewer(containerId, ab1Data) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error("Container not found");
  container.innerHTML = '';
  
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.height = '300px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.border = '1px solid #ccc';
  
  const canvas = document.createElement('canvas');
  canvas.width = container.clientWidth || 800;
  canvas.height = 300;
  canvas.style.display = 'block';
  wrapper.appendChild(canvas);
  
  const toolbar = document.createElement('div');
  toolbar.style.padding = '5px';
  toolbar.style.background = '#f9fafb';
  toolbar.style.borderBottom = '1px solid #ccc';
  
  const btnZoomIn = document.createElement('button');
  btnZoomIn.textContent = 'Zoom In';
  const btnZoomOut = document.createElement('button');
  btnZoomOut.textContent = 'Zoom Out';
  const btnReset = document.createElement('button');
  btnReset.textContent = 'Reset';
  
  toolbar.appendChild(btnZoomIn);
  toolbar.appendChild(btnZoomOut);
  toolbar.appendChild(btnReset);
  
  container.appendChild(toolbar);
  container.appendChild(wrapper);

  const ctx = canvas.getContext('2d');
  
  let zoom = 1;
  let offset = 0;
  
  let trimStart = 0;
  let trimEnd = ab1Data.sequenceLength - 1;
  
  const colors = { A: '#22c55e', C: '#3b82f6', G: '#1f2937', T: '#ef4444' };
  
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!ab1Data.traces.A) return;
    const maxVal = Math.max(
      ...ab1Data.traces.A, ...ab1Data.traces.C, ...ab1Data.traces.G, ...ab1Data.traces.T
    );
    
    const traceLen = ab1Data.traceLength;
    const pointsPerPixel = traceLen / (canvas.width * zoom);
    
    // Draw traces
    ['A', 'C', 'G', 'T'].forEach(base => {
      ctx.beginPath();
      ctx.strokeStyle = colors[base];
      ctx.lineWidth = 1.5;
      const trace = ab1Data.traces[base];
      for (let x = 0; x < canvas.width; x++) {
        const traceIdx = Math.floor((x + offset) * pointsPerPixel);
        if (traceIdx >= 0 && traceIdx < traceLen) {
          const val = trace[traceIdx];
          const y = canvas.height - 30 - (val / maxVal) * (canvas.height - 50);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });
    
    // Draw bases & quality
    if (ab1Data.peakLocations && ab1Data.baseCalls) {
      for (let i = 0; i < ab1Data.sequenceLength; i++) {
        const peak = ab1Data.peakLocations[i];
        const x = (peak / pointsPerPixel) - offset;
        
        if (x >= 0 && x <= canvas.width) {
          const base = ab1Data.baseCalls[i];
          const q = ab1Data.qualityScores ? ab1Data.qualityScores[i] : 0;
          
          let bg = '#ef4444';
          if (q >= 30) bg = '#22c55e';
          else if (q >= 20) bg = '#eab308';
          
          ctx.fillStyle = bg;
          ctx.fillRect(x - 5, 5, 10, 15);
          
          ctx.fillStyle = '#fff';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(base, x, 16);
          
          // Selection overlay if trimmed
          if (i < trimStart || i > trimEnd) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x - (pointsPerPixel / 2), 0, pointsPerPixel, canvas.height);
          }
        }
      }
    }
  }
  
  btnZoomIn.onclick = () => { zoom *= 1.5; draw(); };
  btnZoomOut.onclick = () => { zoom /= 1.5; if (zoom < 1) zoom = 1; draw(); };
  btnReset.onclick = () => { zoom = 1; offset = 0; draw(); };
  
  let isDragging = false;
  let lastX = 0;
  
  canvas.onmousedown = (e) => {
    isDragging = true;
    lastX = e.clientX;
  };
  
  canvas.onmousemove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    offset -= dx / zoom;
    if (offset < 0) offset = 0;
    lastX = e.clientX;
    draw();
  };
  
  canvas.onmouseup = () => isDragging = false;
  canvas.onmouseleave = () => isDragging = false;
  
  canvas.onwheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) zoom *= 1.1;
    else zoom /= 1.1;
    if (zoom < 1) zoom = 1;
    draw();
  };

  draw();
  
  return {
    getTrimBoundaries: () => ({ start: trimStart, end: trimEnd }),
    getSelectedRegion: () => ({ start: trimStart, end: trimEnd }),
    setTrimBoundaries: (s, e) => { trimStart = s; trimEnd = e; draw(); },
    destroy: () => { container.innerHTML = ''; }
  };
}
