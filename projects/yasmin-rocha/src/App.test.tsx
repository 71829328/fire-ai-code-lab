// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

beforeEach(() => { localStorage.clear(); vi.stubGlobal("confirm", vi.fn(() => true)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const open = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

describe("Yasmin Rocha: smoke test das páginas", () => {
  it("apresenta a atleta com imagem verdadeira e CTA comercial", () => {
    const { container } = open("/");
    expect(screen.getByText(/Força que/i)).toBeTruthy();
    expect(container.querySelector('img[src="/images/yasmin-hero.webp"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: /Conversar sobre parceria/i })).toBeTruthy();
  });

  it("navega entre as páginas e oferece impressão da proposta", () => {
    const print = vi.fn(); vi.stubGlobal("print", print);
    open("/parcerias");
    expect(screen.getByText("Marca que acompanha")).toBeTruthy();
    expect(screen.getByText("Missão internacional")).toBeTruthy();
    expect(screen.getByText("Parceiro de temporada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Salvar proposta em PDF/i }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("adiciona lead ao quadro local de parcerias", () => {
    open("/studio");
    fireEvent.click(screen.getByRole("button", { name: "Parcerias" }));
    expect(screen.getByText("Prospecção comercial")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca teste, sem contato real" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lead" }));
    expect(screen.getByText("Marca teste, sem contato real")).toBeTruthy();
  });

  it("usa uma ideia e adiciona ao calendário editorial", () => {
    open("/studio");
    fireEvent.click(screen.getByRole("button", { name: "Editorial" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Treino de hoje" } });
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-11-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Treino de hoje")).toBeTruthy();
  });
});
