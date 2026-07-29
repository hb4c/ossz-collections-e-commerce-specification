import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/store";
import { getLocale } from "@/lib/locale-server";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const [user, cart, locale] = await Promise.all([getCurrentUser(), getCart(), getLocale()]);
  return (
    <HeaderNav
      locale={locale}
      itemCount={cart.itemCount}
      user={
        user
          ? { name: user.fullName || user.email.split("@")[0], role: user.role }
          : null
      }
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`display text-2xl tracking-[0.18em] uppercase ${className}`}>
      OSSZ<span className="text-accent">.</span>
    </Link>
  );
}
