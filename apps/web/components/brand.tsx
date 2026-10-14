import Link from "next/link";

// Logotipo North Scale tomado del SVG de la referencia (cuatro polígonos).
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 261 312" aria-hidden="true">
      <polygon className="bm-ink" points="0,29 189,174 189,252 0,105" />
      <polygon className="bm-ink" points="146,70 261,0 261,217 195,168 195,70" />
      <polygon className="bm-blue" points="0,120 53,159 53,268 0,308" />
      <polygon className="bm-blue" points="199,187 261,232 261,312 199,265" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="North Scale — inicio">
      <BrandMark />
      <span className="brand-text">
        <span className="brand-name">
          <b>NORTH</b> SC&Lambda;LE
        </span>
        <span className="brand-sub">Marketing agency</span>
      </span>
    </Link>
  );
}
