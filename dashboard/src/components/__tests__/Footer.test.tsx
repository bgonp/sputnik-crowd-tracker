import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";

describe("Footer", () => {
  it("renders the disclaimer and data-source text", () => {
    render(<Footer />);
    expect(screen.getByText(/sin vinculación con Sputnik Climbing/)).toBeInTheDocument();
    expect(screen.getByText("Datos de su sitio web público")).toBeInTheDocument();
  });

  it("renders repo links", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /Código fuente/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contribuir/ })).toBeInTheDocument();
  });
});
