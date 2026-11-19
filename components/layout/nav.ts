import type { IconName } from "@/components/ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: IconName;
  /** Other routes that belong to this section. */
  also?: string[];
}

export const NAV: NavItem[] = [
  { href: "/home", label: "Home", short: "Home", icon: "home" },
  { href: "/discover", label: "Discover", short: "Discover", icon: "compass", also: ["/paper"] },
  { href: "/briefings", label: "Briefings", short: "Briefings", icon: "briefing" },
  { href: "/library", label: "My Library", short: "Library", icon: "library" },
  { href: "/research", label: "My Research", short: "Research", icon: "flask", also: ["/topics", "/monitoring", "/settings"] },
];

export function isActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
