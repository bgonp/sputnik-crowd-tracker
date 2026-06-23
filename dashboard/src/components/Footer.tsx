const REPO = "https://github.com/bgonp/sputnik-crowd-tracker";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 py-4 text-xs text-muted-foreground">
      <p className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span>Sitio no oficial, sin vinculación con Sputnik Climbing</span>
        <span aria-hidden>·</span>
        <span>Datos de su sitio web público</span>
        <span aria-hidden>·</span>
        <a
          href={`${REPO}/blob/main/LICENSE`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          MIT © 2026
        </a>
        <span aria-hidden>·</span>
        <a
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Código fuente
        </a>
        <span aria-hidden>·</span>
        <a
          href={`${REPO}/blob/main/CONTRIBUTING.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Contribuir
        </a>
      </p>
    </footer>
  );
}
