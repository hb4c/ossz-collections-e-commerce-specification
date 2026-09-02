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

const OSSZ_LOGO_URL =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ossz%20Short%20Logo-xJ9dwOJQbmLcvzXLnJZwXRYREpdudl.png";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="OSSZ Collections home" className={`inline-flex items-center ${className}`}>
      <img
        src={OSSZ_LOGO_URL}
        alt="OSSZ Collections"
        className="h-auto w-24 object-contain"
      />
    </Link>
  );
}
