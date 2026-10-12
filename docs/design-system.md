# MIS Student Portal Design System

Status: implementation baseline for EN-04 review. Product/design approval is still required before treating these values as formally frozen.

## Typography

The interface uses DM Sans, loaded by Next.js from `next/font/google` in `app/fe/src/app/layout.tsx`. The Figma export specifies these styles (letter spacing 0%):

| Figma style | Size | Weight |
| --- | ---: | ---: |
| Heading / hero | 64px | 500 |
| Heading / h1 | 48px | 500 |
| Heading / h2 | 40px | 500 |
| Heading / h3 | 32px | 500 |
| Heading / h4 | 24px | 500 |
| Paragraph / medium | 16px | 500 |
| Paragraph / regular | 16px | 400 |
| Small / medium | 14px | 500 |
| Small / regular | 14px | 400 |
| Extra Small / medium | 12px | 500 |
| Extra Small / regular | 12px | 400 |

## Implemented CSS color tokens

These are the values currently declared in `app/fe/src/app/globals.css`:

| Token | Value | Intended use |
| --- | --- | --- |
| `--color-primary` | `#de1641` | Primary brand actions and emphasis |
| `--color-primary-hover` | `#d91445` | Hover state for primary actions |
| `--color-primary-active` | `#bf123c` | Pressed state for primary actions |
| `--color-primary-soft` | `#fde8ee` | Soft brand background |
| `--color-background` | `#f7f7f8` | Application page background |
| `--color-surface` | `#ffffff` | Cards and surfaces |
| `--color-text-primary` | `#171717` | Primary text |
| `--color-text-secondary` | `#6b7280` | Secondary text |
| `--color-text-muted` | `#9ca3af` | Muted text |
| `--color-border` | `#e5e7eb` | Standard borders |
| `--color-border-strong` | `#d1d5db` | Emphasized borders |
| `--color-danger` | `#dc2626` | Error/destructive state |
| `--color-success` | `#16a34a` | Success state |
| `--color-warning` | `#f59e0b` | Warning state |

The Figma style export also names `Brand/Outline`, `Brand/Background`, `Dark/*`, `White/*`, and `State/*` tokens but does not include their color values. Those values must be confirmed against the source Figma styles before mapping them to CSS variables; this document does not infer them.

## Component conventions

- Shared primitives live under `app/fe/src/components/ui`.
- Feature-specific dialogs live beside their feature under `app/fe/src/ui/<role>/<feature>/dialog`.
- Use semantic buttons, labels, table headers, and dialog roles; provide visible focus states and responsive overflow where needed.
- Use `components-preview` as the interactive component showcase. It is a review surface, not a business feature or source of production data.
