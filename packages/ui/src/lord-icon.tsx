"use client";

import React, { useEffect } from "react";
import lottie from "lottie-web";
import { defineElement, LordIconElement } from "@lordicon/element";

// TypeScript declarations for the <lord-icon> custom element in React / JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "lord-icon": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          trigger?: string;
          colors?: string;
          "current-color"?: boolean | string;
          currentColor?: boolean | string;
          delay?: string | number;
          speed?: string | number;
          stroke?: string | number;
          state?: string;
          target?: string;
          loading?: "lazy" | "auto";
        },
        HTMLElement
      >;
    }
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "lord-icon": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          trigger?: string;
          colors?: string;
          "current-color"?: boolean | string;
          currentColor?: boolean | string;
          delay?: string | number;
          speed?: string | number;
          stroke?: string | number;
          state?: string;
          target?: string;
          loading?: "lazy" | "auto";
        },
        HTMLElement
      >;
    }
  }
}

class AlignedLordIconElement extends LordIconElement {
  override connectedCallback() {
    super.connectedCallback();
    if (this.shadowRoot && !this.shadowRoot.querySelector("style[data-align-fix]")) {
      const style = document.createElement("style");
      style.dataset.alignFix = "";
      style.textContent = `
        :host {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 0 !important;
          vertical-align: middle !important;
        }
        div {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
        }
        svg {
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
      `;
      this.shadowRoot.appendChild(style);
    }
  }
}

let isLordIconRegistered = false;

function registerLordIconElement() {
  if (typeof window === "undefined" || isLordIconRegistered) return;
  try {
    defineElement({ element: AlignedLordIconElement });
    isLordIconRegistered = true;
  } catch (error) {
    console.error("Failed to register lord-icon element:", error);
  }
}

if (typeof window !== "undefined") {
  registerLordIconElement();
}

/**
 * Registry mapping icon shorthand names to local files in /lord-icons/system/
 */
export const LORD_ICON_REGISTRY = {
  // Navigation & Core
  "dashboard": "/lord-icons/system/system-outline-63-home.json",
  "home": "/lord-icons/system/system-outline-63-home.json",
  "file": "/lord-icons/system/system-outline-56-file-text.json",
  "file-text": "/lord-icons/system/system-outline-56-file-text.json",
  "file-check": "/lord-icons/system/system-outline-14-file-check.json",
  "clipboard": "/lord-icons/system/system-outline-4381-check-list.json",
  "check-list": "/lord-icons/system/system-outline-4381-check-list.json",
  "business": "/lord-icons/system/system-outline-187-briefcase.json",
  "briefcase": "/lord-icons/system/system-outline-187-briefcase.json",
  "account": "/lord-icons/system/system-outline-483-building.json",
  "building": "/lord-icons/system/system-outline-483-building.json",
  "room": "/lord-icons/system/system-outline-483-building.json",
  "people": "/lord-icons/system/system-outline-314-avatars-group.json",
  "avatars-group": "/lord-icons/system/system-outline-314-avatars-group.json",
  "users": "/lord-icons/system/system-outline-314-avatars-group.json",
  "student": "/lord-icons/system/system-outline-406-student-cap.json",
  "student-cap": "/lord-icons/system/system-outline-406-student-cap.json",
  "graduation-cap": "/lord-icons/system/system-outline-406-student-cap.json",
  "course": "/lord-icons/system/system-outline-4092-book.json",
  "book": "/lord-icons/system/system-outline-4092-book.json",
  "category": "/lord-icons/system/system-outline-3150-puzzle-piece.json",
  "puzzle-piece": "/lord-icons/system/system-outline-3150-puzzle-piece.json",
  "calendar": "/lord-icons/system/system-outline-364-calendar-dots.json",
  "calendar-dots": "/lord-icons/system/system-outline-364-calendar-dots.json",
  "calendar-check": "/lord-icons/system/system-outline-4286-calendar-check.json",
  "calendar-circle-plus": "/lord-icons/system/system-outline-973-calendar-circle-plus.json",
  "certificate": "/lord-icons/system/system-outline-4256-badge-check.json",
  "badge-check": "/lord-icons/system/system-outline-4256-badge-check.json",
  "notification": "/lord-icons/system/system-outline-193-bell.json",
  "bell": "/lord-icons/system/system-outline-193-bell.json",
  "audit": "/lord-icons/system/system-outline-45-clock.json",
  "clock": "/lord-icons/system/system-outline-45-clock.json",
  "history": "/lord-icons/system/system-outline-45-clock.json",
  "complete": "/lord-icons/system/system-outline-24-check-circle.json",
  "check": "/lord-icons/system/system-outline-24-check-circle.json",
  "check-circle": "/lord-icons/system/system-outline-24-check-circle.json",
  "monitor": "/lord-icons/system/system-outline-4125-desktop-alt.json",
  "desktop": "/lord-icons/system/system-outline-4125-desktop-alt.json",
  "desktop-alt": "/lord-icons/system/system-outline-4125-desktop-alt.json",
  "profile": "/lord-icons/system/system-outline-44-avatar-circle.json",
  "avatar-circle": "/lord-icons/system/system-outline-44-avatar-circle.json",
  "avatar": "/lord-icons/system/system-outline-21-avatar.json",
  "user": "/lord-icons/system/system-outline-21-avatar.json",
  "remote": "/lord-icons/system/system-outline-86-compass.json",
  "compass": "/lord-icons/system/system-outline-86-compass.json",
  "report": "/lord-icons/system/system-outline-4094-arrow-trending-up.json",
  "arrow-trending-up": "/lord-icons/system/system-outline-4094-arrow-trending-up.json",
  "arrow-trending-down": "/lord-icons/system/system-outline-4093-arrow-trending-down.json",
  "matrix": "/lord-icons/system/system-outline-4381-check-list.json",

  // Sales & Finance Specific
  "hand-dollar": "/lord-icons/system/system-outline-4428-hand-dollar.json",
  "sales": "/lord-icons/system/system-outline-4428-hand-dollar.json",
  "money": "/lord-icons/system/system-outline-4428-hand-dollar.json",
  "receipt": "/lord-icons/system/system-outline-2451-receipt.json",
  "bar-chart": "/lord-icons/system/system-outline-153-bar-chart-vertical-grow.json",
  "bar-chart-vertical": "/lord-icons/system/system-outline-153-bar-chart-vertical-grow.json",
  "bar-chart-vertical-grow": "/lord-icons/system/system-outline-153-bar-chart-vertical-grow.json",
  "chart": "/lord-icons/system/system-outline-153-bar-chart-vertical-grow.json",

  // Utilities & Actions
  "search": "/lord-icons/system/system-outline-19-magnifier.json",
  "magnifier": "/lord-icons/system/system-outline-19-magnifier.json",
  "mail": "/lord-icons/system/system-outline-145-mail.json",
  "link": "/lord-icons/system/system-outline-11-link.json",
  "qr-code": "/lord-icons/system/system-outline-1335-qr-code.json",
  "logout": "/lord-icons/system/system-outline-1725-person-exit.json",
  "person-exit": "/lord-icons/system/system-outline-1725-person-exit.json",
  "trash": "/lord-icons/system/system-outline-185-trash-bin.json",
  "trash-bin": "/lord-icons/system/system-outline-185-trash-bin.json",
  "download": "/lord-icons/system/system-outline-199-download.json",
  "upload": "/lord-icons/system/system-outline-200-upload.json",
  "arrow-right": "/lord-icons/system/system-outline-230-arrow-right.json",
  "star": "/lord-icons/system/system-outline-237-star.json",
  "save": "/lord-icons/system/system-outline-2460-floppy-disk.json",
  "floppy-disk": "/lord-icons/system/system-outline-2460-floppy-disk.json",
  "cross-circle": "/lord-icons/system/system-outline-25-cross-circle.json",
  "warning-circle": "/lord-icons/system/system-outline-260-warning-circle.json",
  "alert": "/lord-icons/system/system-outline-260-warning-circle.json",
  "megaphone": "/lord-icons/system/system-outline-2873-megaphone.json",
  "chevron-right": "/lord-icons/system/system-outline-31-chevron-right.json",
  "chevron-left": "/lord-icons/system/system-outline-32-chevron-left.json",
  "chevron-down": "/lord-icons/system/system-outline-33-chevron-down.json",
  "chevron-up": "/lord-icons/system/system-outline-34-chevron-up.json",
  "chevron-circle": "/lord-icons/system/system-outline-3412-chevron-right-circle.json",
  "chevron-right-circle": "/lord-icons/system/system-outline-3412-chevron-right-circle.json",
  "chevron-left-circle": "/lord-icons/system/system-outline-3413-chevron-left-circle.json",
  "chevron-up-circle": "/lord-icons/system/system-outline-3410-chevron-up-circle.json",
  "chevron-down-circle": "/lord-icons/system/system-outline-3411-chevron-down-circle.json",
  "chevron-circle-right": "/lord-icons/system/system-outline-3412-chevron-right-circle.json",
  "chevron-circle-left": "/lord-icons/system/system-outline-3413-chevron-left-circle.json",
  "chevron-circle-up": "/lord-icons/system/system-outline-3410-chevron-up-circle.json",
  "chevron-circle-down": "/lord-icons/system/system-outline-3411-chevron-down-circle.json",
  "info": "/lord-icons/system/system-outline-367-info-circle.json",
  "info-circle": "/lord-icons/system/system-outline-367-info-circle.json",
  "figures": "/lord-icons/system/system-outline-372-figures.json",
  "cross": "/lord-icons/system/system-outline-38-cross.json",
  "close": "/lord-icons/system/system-outline-38-cross.json",
  "bookmark": "/lord-icons/system/system-outline-400-bookmark.json",
  "pencil-line": "/lord-icons/system/system-outline-4062-pencil-line.json",
  "edit": "/lord-icons/system/system-outline-4062-pencil-line.json",
  "pen-nib": "/lord-icons/system/system-outline-4228-pen-nib.json",
  "send": "/lord-icons/system/system-outline-4214-send-horizontal.json",
  "send-horizontal": "/lord-icons/system/system-outline-4214-send-horizontal.json",
  "plus": "/lord-icons/system/system-outline-48-plus.json",
  "add": "/lord-icons/system/system-outline-48-plus.json",
  "shield-check": "/lord-icons/system/system-outline-457-shield-check.json",
  "security": "/lord-icons/system/system-outline-457-shield-check.json",
  "hourglass": "/lord-icons/system/system-outline-472-hourglass.json",
  "image": "/lord-icons/system/system-outline-54-image-mountain.json",
  "image-mountain": "/lord-icons/system/system-outline-54-image-mountain.json",
  "eye": "/lord-icons/system/system-outline-69-eye.json",
  "pushpin": "/lord-icons/system/system-outline-754-pushpin.json",

  // Flat Icons (Multi-color support: primary, secondary, tertiary, quaternary, quinary)
  "toolbox": "/lord-icons/flat/wired-flat-2499-toolbox-hover-pinch.json",
  "flat-toolbox": "/lord-icons/flat/wired-flat-2499-toolbox-hover-pinch.json",
  "construction": "/lord-icons/flat/wired-flat-2499-toolbox-hover-pinch.json",
  "bookshelf": "/lord-icons/flat/wired-flat-1622-bookshelf-hover-pinch.json",
} as const;

export type LordIconName = keyof typeof LORD_ICON_REGISTRY;

export type LordIconTrigger =
  | "hover"
  | "click"
  | "loop"
  | "loop-on-hover"
  | "morph"
  | "boomerang"
  | "in"
  | "sequence";

export interface LordIconProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /**
   * Name of registered Lordicon (e.g. "briefcase", "receipt", "file", "home", "toolbox")
   * or direct path / URL to a Lottie JSON file.
   */
  src: LordIconName | (string & {});

  /** Size in pixels (applies to width & height). Default: 20 */
  size?: number | string;

  /** Trigger behavior. Default: "hover" */
  trigger?: LordIconTrigger;

  /** Primary color (e.g. "#de1641", "#ebe6ef", "#ffffff") */
  primaryColor?: string;

  /** Secondary color (e.g. "#de1641", "#6b7280", "#ffffff") */
  secondaryColor?: string;

  /** Tertiary color (e.g. "#3a3347") - used in multi-color flat icons */
  tertiaryColor?: string;

  /** Quaternary color (e.g. "#b26836") - used in multi-color flat icons */
  quaternaryColor?: string;

  /** Quinary color (e.g. "#ffc738") - used in multi-color flat icons */
  quinaryColor?: string;

  /**
   * Raw colors string in Lordicon format (e.g. "primary:#ebe6ef,secondary:#de1641,tertiary:#3a3347,quaternary:#b26836,quinary:#ffc738").
   * Overrides individual color props if provided.
   */
  colors?: string;

  /**
   * Inherit currentColor for all paths.
   */
  currentColor?: boolean;

  /** Delay in milliseconds before animation trigger */
  delay?: number | string;

  /** Speed multiplier (e.g. 1, 1.5) */
  speed?: number | string;

  /** Stroke style ("light", "regular", "bold", or numeric percentage 50, 70, 100) */
  stroke?: number | "light" | "regular" | "bold";

  /** State name for multi-state icons */
  state?: string;

  /**
   * Target element selector that triggers animation on interaction (e.g. "button", "a", ".group").
   * When set, hovering or clicking the matching parent ancestor will play the Lordicon!
   */
  target?: string;

  /** Loading mode ("lazy" | "auto") */
  loading?: "lazy" | "auto";

  /** Extra class names */
  className?: string;

  /** Style overrides */
  style?: React.CSSProperties;
}

/**
 * Resolves a Lordicon name to its public JSON asset URL
 */
export function resolveLordIconSrc(src: string): string {
  if (src in LORD_ICON_REGISTRY) {
    return LORD_ICON_REGISTRY[src as LordIconName];
  }
  return src;
}

export const LordIcon = React.forwardRef<HTMLElement, LordIconProps>(function LordIcon(
  {
    src,
    size = 20,
    trigger = "hover",
    primaryColor,
    secondaryColor,
    tertiaryColor,
    quaternaryColor,
    quinaryColor,
    colors,
    currentColor,
    delay,
    speed,
    stroke,
    state,
    target,
    loading = "auto",
    className = "",
    style,
    ...props
  },
  ref
) {
  useEffect(() => {
    registerLordIconElement();
  }, []);

  const resolvedSrc = resolveLordIconSrc(src);

  // Compute colors parameter
  let computedColors = colors;
  if (
    !computedColors &&
    (primaryColor || secondaryColor || tertiaryColor || quaternaryColor || quinaryColor)
  ) {
    const formatColor = (val: string) => {
      if (val.startsWith("#") || val === "currentColor" || val === "transparent") return val;
      if (/^[0-9a-fA-F]{3,8}$/.test(val)) return `#${val}`;
      return val;
    };
    const parts: string[] = [];
    if (primaryColor) parts.push(`primary:${formatColor(primaryColor)}`);
    if (secondaryColor) parts.push(`secondary:${formatColor(secondaryColor)}`);
    if (tertiaryColor) parts.push(`tertiary:${formatColor(tertiaryColor)}`);
    if (quaternaryColor) parts.push(`quaternary:${formatColor(quaternaryColor)}`);
    if (quinaryColor) parts.push(`quinary:${formatColor(quinaryColor)}`);
    computedColors = parts.join(",");
  }

  const dimension = typeof size === "number" ? `${size}px` : size;

  const mergedStyle: React.CSSProperties = {
    width: dimension,
    height: dimension,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 0,
    verticalAlign: "middle",
    flexShrink: 0,
    ...style,
  };

  return (
    <lord-icon
      ref={ref as unknown as React.Ref<HTMLElement>}
      src={resolvedSrc}
      trigger={trigger}
      colors={computedColors}
      current-color={currentColor ? "" : undefined}
      delay={delay}
      speed={speed}
      stroke={stroke}
      state={state}
      target={target}
      loading={loading}
      className={className}
      style={mergedStyle}
      suppressHydrationWarning
      {...props}
    />
  );
});
