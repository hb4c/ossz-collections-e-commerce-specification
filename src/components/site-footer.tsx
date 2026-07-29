import Link from "next/link";
import { getSettings } from "@/lib/store";
import { NewsletterForm } from "@/components/newsletter-form";
import { getLocale } from "@/lib/locale-server";
import { t } from "@/lib/i18n-pages";

export async function SiteFooter() {
  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);
  return (
    <footer className="mt-24 border-t border-line bg-paper">
      <div className="wrap grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="display text-2xl tracking-[0.22em] uppercase">
            OSSZ<span className="text-accent">.</span>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {t(locale, "footer.tag")}
          </p>
          <p className="mt-4 text-sm text-muted">{settings.store_address}</p>
          <p className="mt-1 text-sm text-muted">{settings.business_hours}</p>
        </div>

        <div>
          <p className="eyebrow">{t(locale, "footer.shop")}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li><Link className="link-underline" href="/shop">{t(locale, "footer.allPieces")}</Link></li>
            <li><Link className="link-underline" href="/collections">{t(locale, "nav.collections")}</Link></li>
            <li><Link className="link-underline" href="/lookbook">{t(locale, "nav.lookbook")}</Link></li>
            <li><Link className="link-underline" href="/appointments">{t(locale, "home.bookCta")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">{t(locale, "footer.care")}</p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li><Link className="link-underline" href="/faq">{t(locale, "footer.faqLink")}</Link></li>
            <li><Link className="link-underline" href="/size-guide">{t(locale, "pdp.sizeGuide")}</Link></li>
            <li><Link className="link-underline" href="/contact">{t(locale, "footer.contactLink")}</Link></li>
            <li><Link className="link-underline" href="/order-lookup">{t(locale, "footer.trackLink")}</Link></li>
            <li><Link className="link-underline" href="/account">{t(locale, "footer.accountLink")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow">{t(locale, "footer.letter")}</p>
          <p className="mt-4 text-sm text-ink-soft">
            {t(locale, "footer.letterBody")}
          </p>
          <NewsletterForm />
        </div>
      </div>

      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-2 py-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} OSSZ Collections · Douala, Cameroon</p>
          <p className="tracking-[0.14em] uppercase">
            MTN MoMo · Orange Money · Visa · Mastercard
          </p>
        </div>
      </div>
    </footer>
  );
}
