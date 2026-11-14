import { useEffect, useRef } from "react";

// A lightweight canvas sphere: drawn locally, with no network, WebGL, or live data.
export function FireGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let angle = 0;
    let previous = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const continents = [
      [[68,-168],[73,-125],[60,-105],[50,-82],[25,-80],[12,-98],[28,-120],[48,-137],[68,-168]],
      [[12,-78],[3,-60],[-8,-38],[-28,-48],[-54,-70],[-34,-77],[-8,-80],[12,-78]],
      [[70,-12],[72,32],[62,70],[52,112],[38,142],[18,122],[10,103],[24,78],[34,45],[35,14],[52,-7],[70,-12]],
      [[36,-10],[35,18],[13,42],[-2,50],[-30,29],[-35,15],[-16,1],[2,-8],[20,-16],[36,-10]],
      [[-12,112],[-11,135],[-23,153],[-40,148],[-44,117],[-29,113],[-12,112]],
      [[78,48],[82,92],[74,155],[63,177],[57,137],[64,90],[78,48]],
    ] as const;

    const project = (lat: number, lon: number, cx: number, cy: number, radius: number) => {
      const longitude = lon + angle;
      const x = Math.cos(lat) * Math.sin(longitude);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(longitude);
      const tilt = -0.24;
      return {
        x: cx + radius * x,
        y: cy - radius * (y * Math.cos(tilt) - z * Math.sin(tilt)),
        z: y * Math.sin(tilt) + z * Math.cos(tilt),
      };
    };

    const draw = (time: number) => {
      if (time - previous > 28 || previous === 0) {
        const delta = previous ? Math.min(time - previous, 60) : 0;
        previous = time;
        if (!reduceMotion.matches) angle += delta * 0.00016;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const cx = width * 0.5;
        const cy = height * 0.5;
        const radius = Math.min(width * 0.39, height * 0.43);
        const halo = ctx.createRadialGradient(cx, cy, radius * 0.38, cx, cy, radius * 1.42);
        halo.addColorStop(0, "rgba(16,174,216,.20)");
        halo.addColorStop(.52, "rgba(19,95,140,.10)");
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);

        const sphere = ctx.createRadialGradient(cx - radius * .38, cy - radius * .4, radius * .04, cx + radius * .08, cy + radius * .08, radius * 1.2);
        sphere.addColorStop(0, "#164964");
        sphere.addColorStop(.34, "#0b2b43");
        sphere.addColorStop(.78, "#071727");
        sphere.addColorStop(1, "#030a12");
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = sphere;
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - .5, 0, Math.PI * 2);
        ctx.clip();

        const ambient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        ambient.addColorStop(0, "rgba(86,218,246,.10)");
        ambient.addColorStop(.45, "rgba(2,16,29,0)");
        ambient.addColorStop(1, "rgba(255,107,44,.07)");
        ctx.fillStyle = ambient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Fine latitude and longitude traces, clipped to the visible hemisphere.
        ctx.lineWidth = .72;
        ctx.strokeStyle = "rgba(92,210,239,.36)";
        for (let lat = -75; lat <= 75; lat += 15) {
          ctx.beginPath();
          let drawing = false;
          for (let i = 0; i <= 160; i++) {
            const point = project(lat * Math.PI / 180, i * Math.PI / 80, cx, cy, radius);
            if (point.z <= 0) { drawing = false; continue; }
            if (drawing) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
            drawing = true;
          }
          ctx.stroke();
        }
        for (let lon = 0; lon < 180; lon += 15) {
          ctx.beginPath();
          let drawing = false;
          for (let i = 0; i <= 90; i++) {
            const point = project((-90 + i * 2) * Math.PI / 180, lon * Math.PI / 180, cx, cy, radius);
            if (point.z <= 0) { drawing = false; continue; }
            if (drawing) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
            drawing = true;
          }
          ctx.stroke();
        }

        // Simplified continent silhouettes are illustrative, not geospatial data.
        for (const outline of continents) {
          ctx.beginPath();
          let drawing = false;
          for (let edge = 1; edge < outline.length; edge++) {
            const [lat0, lon0] = outline[edge - 1];
            const [lat1, lon1] = outline[edge];
            for (let step = 0; step <= 10; step++) {
              const t = step / 10;
              const point = project((lat0 + (lat1 - lat0) * t) * Math.PI / 180, (lon0 + (lon1 - lon0) * t) * Math.PI / 180, cx, cy, radius);
              if (point.z <= 0) { drawing = false; continue; }
              if (drawing) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
              drawing = true;
            }
          }
          ctx.closePath();
          ctx.fillStyle = "rgba(31,103,128,.28)";
          ctx.fill();
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = "rgba(255,143,76,.70)";
          ctx.stroke();
        }

        // Restrained cyan data particles, generated deterministically.
        for (let i = 0; i < 42; i++) {
          const lat = (-67 + ((i * 37) % 134)) * Math.PI / 180;
          const lon = ((i * 137.5) % 360) * Math.PI / 180;
          const point = project(lat, lon, cx, cy, radius);
          if (point.z <= .12) continue;
          const alpha = .18 + point.z * .58;
          ctx.beginPath();
          ctx.arc(point.x, point.y, point.z > .78 ? 1.45 : .8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(109,229,248,${alpha})`;
          ctx.fill();
        }

        // A fine atmospheric rim gives the sphere depth without implying live routes.
        const rim = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
        rim.addColorStop(0, "rgba(87,220,244,.18)");
        rim.addColorStop(.5, "rgba(113,237,255,.94)");
        rim.addColorStop(1, "rgba(255,125,57,.36)");
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -.95, Math.PI * 1.0);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = rim;
        ctx.shadowColor = "rgba(38,205,239,.52)";
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;

        // Reference ticks around the edge provide instrument depth, not network events.
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 72; i++) {
          const a = i * Math.PI / 36 + angle * .25;
          const inner = radius + 9;
          const outer = inner + (i % 6 === 0 ? 9 : 3);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
          ctx.strokeStyle = i % 6 === 0 ? "rgba(255,127,60,.62)" : "rgba(100,192,214,.22)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    const onMotionChange = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      frame = requestAnimationFrame(draw);
    };
    reduceMotion.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduceMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={ref} className="fire-globe-canvas" aria-hidden="true" />;
}
