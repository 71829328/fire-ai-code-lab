import { useEffect, useRef } from "react";

// Orthographic projection of a rotating 3D sphere. No network or WebGL dependency.
export function FireGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let angle = 0;
    let previous = 0;
    let lastDraw = -1000;
    const draw = (time: number) => {
      if (time-lastDraw < (motion.matches ? 250 : 33)) { frame=requestAnimationFrame(draw); return; }
      lastDraw=time;
      const size = Math.min(420, Math.max(120, canvas.clientWidth));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixels = Math.round(size * dpr);
      if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels; }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,size,size);
      const center = size / 2, radius = size * .43;
      if (!motion.matches && previous) angle += Math.min(time-previous,100)*.00025;
      previous = time;
      const glow = ctx.createRadialGradient(center-radius*.3,center-radius*.3,0,center,center,radius);
      glow.addColorStop(0,"#164e63"); glow.addColorStop(1,"#04101d");
      ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();
      const project = (lat:number,lon:number) => {
        const x=Math.cos(lat)*Math.sin(lon+angle), y=Math.sin(lat), z=Math.cos(lat)*Math.cos(lon+angle);
        const tilt=.25;
        return {x:center+radius*x,y:center-radius*(y*Math.cos(tilt)-z*Math.sin(tilt)),z:y*Math.sin(tilt)+z*Math.cos(tilt)};
      };
      const line=(points:{x:number;y:number;z:number}[])=>{
        ctx.beginPath();let active=false;
        for(const p of points){if(p.z<0){active=false;continue;}if(active)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);active=true;}
        ctx.strokeStyle="#22d3ee88";ctx.lineWidth=.8;ctx.stroke();
      };
      for(let lat=-75;lat<=75;lat+=15)line(Array.from({length:145},(_,i)=>project(lat*Math.PI/180,i*Math.PI/72)));
      for(let lon=0;lon<360;lon+=15)line(Array.from({length:73},(_,i)=>project(-Math.PI/2+i*Math.PI/72,lon*Math.PI/180)));
      // Stylized continent outlines, intentionally not a geographic map.
      const continents = [
        [[65,-165],[72,-110],[55,-60],[45,-65],[25,-80],[15,-90],[30,-115],[55,-135],[65,-165]],
        [[12,-80],[5,-50],[-10,-35],[-35,-55],[-55,-70],[-20,-75],[12,-80]],
        [[70,-10],[72,70],[55,150],[35,140],[10,105],[22,75],[35,45],[35,15],[55,-10],[70,-10]],
        [[35,-15],[35,35],[10,50],[-35,20],[-15,0],[10,-15],[35,-15]],
        [[-12,115],[-10,145],[-35,153],[-42,115],[-12,115]]
      ];
      for(const outline of continents){
        const points:{x:number;y:number;z:number}[]=[];
        for(let j=1;j<outline.length;j++){const a=outline[j-1],b=outline[j];for(let k=0;k<=12;k++){const t=k/12;points.push(project((a[0]+(b[0]-a[0])*t)*Math.PI/180,(a[1]+(b[1]-a[1])*t)*Math.PI/180));}}
        ctx.beginPath();let active=false;for(const p of points){if(p.z<0){active=false;continue;}if(active)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);active=true;}ctx.strokeStyle="#fbbf24aa";ctx.lineWidth=1.5;ctx.stroke();
      }
      ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.strokeStyle="#67e8f9";ctx.lineWidth=1.5;ctx.stroke();
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(frame);
  },[]);
  return <canvas ref={ref} className="fire-globe-canvas" aria-hidden="true"/>;
}
