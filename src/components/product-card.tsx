import Image from "next/image";
import Link from "next/link";
import type { ProductCardData } from "@/lib/store";
import { formatXAF } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n-pages";
import { BuyNowButton } from "@/components/buy-now-button";

/**
 * Server component — the card itself ships no JavaScript. Only the Buy-now
 * button below it is interactive.
 */
export function ProductCard({
  product,
  priority = false,
  locale = "en",
}: {
  product: ProductCardData;
  priority?: boolean;
  locale?: Locale;
}) {
  return (
    <div className="group flex flex-col">
      <div className="relative">
      <Link href={`/product/${product.slug}`} className="block zoom-parent">
        <div className="photo-frame relative aspect-[3/4]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.imageAlt || product.name}
              fill
              priority={priority}
              loading={priority ? "eager" : "lazy"}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 50vw"
              quality={58}
              className="object-cover"
            />
          ) : null}
          {!product.inStock ? (
            <span className="absolute left-3 top-3 rounded-full bg-paper/95 px-2.5 py-1 text-[0.62rem] tracking-[0.16em] uppercase">
              {t(locale, "buy.soldOut")}
            </span>
          ) : null}
        </div>
      </Link>
      <BuyNowButton slug={product.slug} locale={locale} inStock={product.inStock} variant="overlay" />
      </div>

      <Link href={`/product/${product.slug}`} className="block">
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium leading-snug">{product.name}</h3>
            <p className="mt-1 text-xs text-muted">
              {product.collectionName ?? product.categoryName ?? "OSSZ"}
            </p>
          </div>
          <p className="whitespace-nowrap text-sm">{formatXAF(product.basePrice)}</p>
        </div>
      </Link>
    </div>
  );
}
