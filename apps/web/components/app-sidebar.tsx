"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";

type NavItem = { href: string; label: string; exact?: boolean };
type NavGroup = { id: string; label: string; href?: string; exact?: boolean; children?: NavItem[]; managerOnly?: boolean };

const groups: NavGroup[] = [
  {
    id: "crm",
    label: "CRM",
    children: [
      { href: "/app/crm/chat", label: "Chat" },
      { href: "/app/crm/contactos", label: "Contactos" },
      { href: "/app/crm/tickets", label: "Tickets" },
      { href: "/app/crm/oportunidades", label: "Oportunidades" },
    ],
  },
  { id: "dashboard", label: "Dashboard", href: "/app/dashboard", exact: true },
  {
    id: "config",
    label: "Configuración",
    managerOnly: true,
    children: [
      { href: "/app/configuracion/integraciones", label: "Integraciones" },
      { href: "/app/configuracion/canales", label: "Canales" },
      { href: "/app/configuracion/plantillas", label: "Plantillas" },
      { href: "/app/configuracion/equipo", label: "Equipo" },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupOpen(pathname: string, group: NavGroup) {
  if (group.href && isActive(pathname, group.href, group.exact)) return true;
  return group.children?.some((child) => isActive(pathname, child.href)) ?? false;
}

export function AppSidebar({
  isManager,
  agencyName,
  userName,
  role,
}: {
  isManager: boolean;
  agencyName: string;
  userName: string;
  role: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      if (groupOpen(pathname, group)) next[group.id] = true;
    }
    setOpenGroups((prev) => ({ ...prev, ...next }));
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", mobileOpen);
    return () => document.body.classList.remove("sidebar-open");
  }, [mobileOpen]);

  const visible = groups.filter((group) => isManager || !group.managerOnly);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      <button
        type="button"
        className="sidebar-burger"
        aria-label={mobileOpen || !collapsed ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={mobileOpen || !collapsed}
        onClick={() => {
          if (window.matchMedia("(max-width: 959px)").matches) {
            setMobileOpen((value) => !value);
          } else {
            setCollapsed((value) => !value);
          }
        }}
      >
        <span />
        <span />
        <span />
      </button>

      {mobileOpen ? <button type="button" className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} /> : null}

      <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Navegación principal">
        <div className="sidebar-brand">
          <Brand href="/app/crm/chat" />
        </div>

        <nav className="sidebar-nav">
          {visible.map((group) => {
            const expanded = openGroups[group.id] ?? groupOpen(pathname, group);
            if (!group.children) {
              const active = group.href ? isActive(pathname, group.href, group.exact) : false;
              return (
                <Link
                  key={group.id}
                  href={group.href!}
                  className="sidebar-link"
                  aria-current={active ? "page" : undefined}
                  title={group.label}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="sidebar-ico" aria-hidden="true">
                    {group.id === "dashboard" ? "◆" : "●"}
                  </span>
                  <span className="sidebar-text">{group.label}</span>
                </Link>
              );
            }

            return (
              <div key={group.id} className={`sidebar-group${expanded ? " is-open" : ""}`}>
                <button type="button" className="sidebar-group-btn" onClick={() => toggleGroup(group.id)} aria-expanded={expanded} title={group.label}>
                  <span className="sidebar-ico" aria-hidden="true">
                    {group.id === "crm" ? "▣" : "⚙"}
                  </span>
                  <span className="sidebar-text">{group.label}</span>
                  <span className="sidebar-chevron" aria-hidden="true" />
                </button>
                <div className="sidebar-sub" hidden={!expanded && collapsed}>
                  {group.children.map((child) => {
                    const active = isActive(pathname, child.href, child.exact);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="sidebar-sublink"
                        aria-current={active ? "page" : undefined}
                        title={child.label}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="sidebar-text">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <strong className="sidebar-text">{agencyName}</strong>
            <span className="sidebar-text">
              {userName} · {role}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
