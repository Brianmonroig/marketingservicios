"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "Resumen", exact: true, manager: false },
  { href: "/app/leads", label: "Leads", exact: false, manager: false },
  { href: "/app/conversaciones", label: "Conversaciones", exact: false, manager: false },
  { href: "/app/plantillas", label: "Plantillas", exact: false, manager: false },
  { href: "/app/integraciones", label: "Conexiones", exact: false, manager: true },
  { href: "/app/equipo", label: "Equipo", exact: false, manager: true },
];

export function AppLinks({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="app-links" aria-label="Aplicación">
      {links
        .filter((link) => isManager || !link.manager)
        .map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className="app-link" aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
