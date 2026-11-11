import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { Home } from "./routes/index";
import { Parcerias } from "./routes/parcerias";
import { Studio } from "./routes/studio";
const titles: Record<string,string> = {"/":"Yasmin Rocha | Karate Brasil","/parcerias":"Parcerias | Yasmin Rocha","/studio":"Studio | Yasmin Rocha"};
export function App(){ const {pathname}=useLocation(); useEffect(()=>{ document.title=titles[pathname] ?? "Yasmin Rocha | Karate Brasil"; const r=document.querySelector('meta[name="robots"]'); if(pathname==="/studio"){ if(!r){const m=document.createElement("meta");m.name="robots";m.content="noindex, nofollow";document.head.append(m);}else r.setAttribute("content","noindex, nofollow");}else{r?.remove();} window.scrollTo({top:0});},[pathname]); return <><Routes><Route path="/" element={<Home/>}/><Route path="/parcerias" element={<Parcerias/>}/><Route path="/studio" element={<Studio/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes><Toaster richColors position="bottom-right"/></> }
