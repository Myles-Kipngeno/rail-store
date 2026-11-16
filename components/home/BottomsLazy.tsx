"use client";

import dynamic from "next/dynamic";

/**
 * Bottoms sits below the fold, so its scroll-linked code (motion useScroll/useTransform) loads as a
 * separate chunk instead of counting toward the home page's first-load JS. Still server-rendered.
 */
export const Bottoms = dynamic(() => import("./Bottoms"));
