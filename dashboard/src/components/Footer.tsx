export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 py-4 text-xs text-muted-foreground">
      <p className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>Sitio no oficial, sin vinculación con Sputnik Climbing</span>
        <span aria-hidden>·</span>
        <span>Datos de su API pública</span>
        <span aria-hidden>·</span>
        <span>MIT © 2026</span>
        <span aria-hidden>·</span>
        <a
          href="https://github.com/bgonp/sputnik-crowd-tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Código fuente
        </a>
      </p>
    </footer>
  );
}
