"use client";

import dynamic from "next/dynamic";

/** The lookbook's rAF loop and drag code load as their own chunk, off the home page's first load. */
export const Lookbook = dynamic(() => import("./Lookbook"));
