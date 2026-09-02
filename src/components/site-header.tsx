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
    <Link href="/" aria-label="OSSZ Collections home" className={`inline-flex items-center ${className}`}>
      <img
        src="/ossz-short-logo.png"
        alt="OSSZ Collections"
        className="h-auto w-40 object-contain"
      />
    </Link>
  );
}
