"use client";

import { LogOut, ShoppingBag, User } from "lucide-react";
import { BRAND_LOGO_PATH, BRAND_NAME } from "@oc/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { authClient } from "@/lib/auth-client";
import { CART_UPDATED_EVENT } from "@/lib/cart-events";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAnonymous, isAuthenticated, isLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [cartLoading, setCartLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (isLoading) return;
    setCartLoading(true);
    try {
      const r = await fetch("/api/shop/cart", { credentials: "include" });
      const d = await r.json();
      setCartCount(d.data?.items?.length ?? 0);
    } catch {
      setCartCount(0);
    } finally {
      setCartLoading(false);
    }
  }, [isLoading]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart, pathname]);

  useEffect(() => {
    const handler = () => fetchCart();
    window.addEventListener(CART_UPDATED_EVENT, handler);
    return () => window.removeEventListener(CART_UPDATED_EVENT, handler);
  }, [fetchCart]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur-md">
      <div className="oc-container flex h-16 items-center justify-between">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src={BRAND_LOGO_PATH}
            alt={BRAND_NAME}
            width={180}
            height={48}
            className="h-12 w-auto max-w-[240px] object-contain md:h-14"
            priority
          />
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/products"
            className="text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            Products
          </Link>
          <Link href="/cart" className="text-muted-foreground transition-colors hover:text-gold">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              {!cartLoading && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-black">
                  {cartCount}
                </span>
              )}
            </div>
          </Link>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold transition-colors hover:bg-gold/30"
                title={user?.email}
              >
                {initials}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground transition-colors hover:text-gold"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              <User className="h-5 w-5" />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
