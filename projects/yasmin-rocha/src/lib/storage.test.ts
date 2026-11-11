import { describe, expect, it, vi, afterEach } from "vitest";
import { isValidValue, importAll, exportAll } from "./storage";
const makeLocal = () => {
  const store = new Map<string, string>();
  return {getItem: (k:string)=>store.get(k) ?? null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);},clear:()=>store.clear()};
};
afterEach(()=>vi.unstubAllGlobals());
describe("Studio backups", () => {
 it("rejeita parâmetros malformados e JSON sem versão",()=>{
  expect(()=>importAll({app:"yasmin-rocha-studio",version:2,posts:[]})).toThrow();
  expect(isValidValue("posts", [{id:"x",date:"2026-11-11",title:"Post",format:"Inválido",pillar:"tecnica",status:"ideia"}])).toBe(false);
  expect(isValidValue("goals",[{id:"a",label:"x",metric:"followers",target:-1,deadline:""}])).toBe(false);
 });
 it("importa apenas dados válidos e preserva o backup",()=>{
   const localStorage = makeLocal(); vi.stubGlobal("localStorage",localStorage);vi.stubGlobal("window",{dispatchEvent:vi.fn()});vi.stubGlobal("Event",class {constructor(public type:string){}});
   expect(importAll({app:"yasmin-rocha-studio",version:1,posts:[],tasks:{"f0":true}})).toBe(2);
   const result=exportAll();expect(result.tasks).toEqual({"f0":true});expect(result.posts).toEqual([]);
 });
 it("recusa dados parcialmente inválidos sem sobrescrever o que já existe",()=>{
   const localStorage=makeLocal();vi.stubGlobal("localStorage",localStorage);vi.stubGlobal("window",{dispatchEvent:vi.fn()});vi.stubGlobal("Event",class {constructor(public type:string){}});
   importAll({app:"yasmin-rocha-studio",version:1,leads:[]});
   expect(()=>importAll({app:"yasmin-rocha-studio",version:1,leads:[{name:"invalid"}],tasks:{}})).toThrow();
   expect(exportAll().leads).toEqual([]);
 });
});
