"use client";

import dynamic from "next/dynamic";

/**
 * The showcases sit below the fold, so their scroll-linked code (motion useScroll/useTransform) loads
 * as a separate chunk instead of counting toward the home page's first-load JS. Still server-rendered.
 */
export const Showcase = dynamic(() => import("./Showcase"));
