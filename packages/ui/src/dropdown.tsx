"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { LordIcon, type LordIconName } from "./lord-icon";

export type DropdownOption<T = string> = {
  label: ReactNode;
  value: T;
  disabled?: boolean;
  description?: ReactNode;
  icon?: LordIconName | ReactNode;
  group?: string;
};

export interface DropdownProps<T = string> {
  /** List of options to pick from. Can be strings or DropdownOption objects. */
  options: readonly (DropdownOption<T> | T)[];

  /** Selected option value (controlled) */
  value?: T;

  /** Initial selected option value (uncontrolled) */
  defaultValue?: T;

  /** Callback fired when an option is selected */
  onChange?: (value: T, option?: DropdownOption<T>) => void;

  /** Placeholder when nothing is selected */
  placeholder?: string;

  /** Optional label displayed above the dropdown trigger */
  label?: ReactNode;

  /** Dynamic left icon for trigger (LordIcon shorthand name e.g. "filter", "briefcase", or ReactNode) */
  leftIcon?: ReactNode | LordIconName | (string & {});

  /** LordIcon name for the chevron. Default: "chevron-down" */
  chevronIcon?: LordIconName | (string & {});

  /** Disable the dropdown */
  disabled?: boolean;

  /** Name attribute for standard HTML form submission */
  name?: string;

  /** Whether a selection is required */
  required?: boolean;

  /** Allow clearing the selection back to empty */
  clearable?: boolean;

  /** Custom class name on the trigger button/container */
  className?: string;

  /** Custom class name on the outer label/field wrapper */
  containerClassName?: string;

  // =========================================================
  // ADJUSTABLE OPENED STATE PROPS
  // =========================================================

  /** Controlled open state */
  open?: boolean;

  /** Callback fired when the opened state changes */
  onOpenChange?: (open: boolean) => void;

  /**
   * Adjustable class name for the opened dropdown popup card.
   * Can control width, padding, background, borders, z-index, animations, etc.
   */
  menuClassName?: string;

  /**
   * Width behavior for the opened dropdown:
   * - "trigger": matches width of the trigger (w-full / 100%)
   * - "auto": auto fits option content width
   * - custom tailwind class e.g. "w-64", "min-w-[240px]", "w-80"
   */
  menuWidth?: "trigger" | "auto" | "full" | string;

  /**
   * Alignment & placement for the opened menu:
   * "bottom-start" (default) | "bottom-end" | "top-start" | "top-end" | "bottom"
   */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom";

  /** Max height for the options list before scrolling. Default: "max-h-60" (240px) */
  maxHeight?: string;

  /** Show an inline search filter inside the opened dropdown menu */
  searchable?: boolean;

  /** Placeholder for the search input when searchable=true */
  searchPlaceholder?: string;

  /** Custom header content rendered at the top of the opened dropdown (above options) */
  headerContent?: ReactNode;

  /** Custom footer content rendered at the bottom of the opened dropdown (below options) */
  footerContent?: ReactNode;

  /** Custom empty state message when no options match */
  emptyMessage?: ReactNode;

  /** Custom renderer for each option item */
  renderOption?: (
    option: DropdownOption<T>,
    state: { selected: boolean; active: boolean }
  ) => ReactNode;

  /** Custom renderer for trigger button inner content */
  renderTrigger?: (
    selectedOption: DropdownOption<T> | undefined,
    state: { open: boolean }
  ) => ReactNode;
}

export function Dropdown<T = string>({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "Select option",
  label,
  leftIcon,
  chevronIcon = "chevron-down",
  disabled = false,
  name,
  required = false,
  clearable = false,
  className = "",
  containerClassName = "",
  open: controlledOpen,
  onOpenChange,
  menuClassName = "",
  menuWidth = "trigger",
  placement = "bottom-start",
  maxHeight = "max-h-60",
  searchable = false,
  searchPlaceholder = "Search...",
  headerContent,
  footerContent,
  emptyMessage = "No options found.",
  renderOption,
  renderTrigger,
}: DropdownProps<T>) {
  const generatedId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to DropdownOption<T>
  const normalizedOptions: DropdownOption<T>[] = options.map((opt) => {
    if (typeof opt === "object" && opt !== null && "value" in opt) {
      return opt as DropdownOption<T>;
    }
    return {
      label: String(opt),
      value: opt as T,
    };
  });

  // State management
  const [internalValue, setInternalValue] = useState<T | undefined>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpenControlled = controlledOpen !== undefined;
  const isOpen = isOpenControlled ? controlledOpen : internalOpen;

  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const selectedOption = normalizedOptions.find((opt) => opt.value === currentValue);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isOpenControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
      if (!nextOpen) {
        setSearchQuery("");
        setFocusedIndex(-1);
      }
    },
    [isOpenControlled, onOpenChange]
  );

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, setOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const labelString = typeof opt.label === "string" ? opt.label : String(opt.value);
    return labelString.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const selectOption = (opt: DropdownOption<T>) => {
    if (opt.disabled) return;
    if (!isControlled) {
      setInternalValue(opt.value);
    }
    onChange?.(opt.value, opt);
    setOpen(false);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isControlled) {
      setInternalValue(undefined);
    }
    onChange?.(undefined as unknown as T, undefined);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === "Enter" && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
      e.preventDefault();
      selectOption(filteredOptions[focusedIndex]);
    }
  };

  // Helper to render trigger icon
  const renderTriggerIcon = (icon: ReactNode | LordIconName | (string & {})) => {
    if (!icon) return null;
    if (typeof icon === "string") {
      return (
        <LordIcon
          src={icon as LordIconName}
          size={20}
          trigger="hover"
          target="div,button"
          colors="primary:#6b7280,secondary:#9ca3af"
          className="shrink-0 transition-colors duration-150 group-hover/dropdown:[--lord-icon-primary:#de1641] group-hover/dropdown:[--lord-icon-secondary:#de1641]"
        />
      );
    }
    return (
      <span className="shrink-0 text-zinc-950/60 transition-colors duration-150 group-hover/dropdown:text-rose-600">
        {icon}
      </span>
    );
  };

  // Positioning classes for adjustable opened menu
  const placementClasses = {
    "bottom-start": "top-full left-0 mt-1.5",
    "bottom-end": "top-full right-0 mt-1.5",
    "bottom": "top-full left-1/2 -translate-x-1/2 mt-1.5",
    "top-start": "bottom-full left-0 mb-1.5",
    "top-end": "bottom-full right-0 mb-1.5",
  }[placement];

  const widthClass = {
    trigger: "w-full",
    full: "w-full",
    auto: "w-auto min-w-[200px]",
  }[menuWidth] ?? menuWidth;

  return (
    <div
      ref={dropdownRef}
      className={`relative block space-y-[3px] ${containerClassName}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for HTML form compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue !== undefined ? String(currentValue) : ""}
          required={required}
        />
      )}

      {label && (
        <label
          htmlFor={generatedId}
          className="block text-sm font-medium text-gray-600"
          onClick={() => !disabled && setOpen(!isOpen)}
        >
          {label}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        id={generatedId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className={[
          "group/dropdown flex h-9 w-full items-center justify-between gap-2",
          "rounded-full border border-zinc-950/60 bg-neutral-50 px-3 text-left text-sm",
          "transition-colors duration-150",
          "hover:border-rose-600",
          isOpen
            ? "border-rose-600 ring-2 ring-rose-100"
            : "focus-visible:border-rose-600 focus-visible:ring-2 focus-visible:ring-rose-100",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {renderTriggerIcon(leftIcon)}

          {renderTrigger ? (
            renderTrigger(selectedOption, { open: isOpen })
          ) : (
            <span
              className={`block truncate text-sm font-normal transition-colors duration-150 ${
                selectedOption
                  ? "text-slate-900"
                  : "text-zinc-950/40 group-hover/dropdown:text-rose-600"
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          )}
        </span>

        {/* Clear and Chevron Controls */}
        <span className="flex shrink-0 items-center gap-1.5">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={clearSelection}
              className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </span>
          )}

          {/* LordIcon Chevron-Down with hover to red and rotation when opened */}
          <span
            className={`flex items-center justify-center transition-transform duration-200 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          >
            <LordIcon
              src={chevronIcon}
              size={20}
              trigger="hover"
              target="button"
              colors={
                isOpen
                  ? "primary:#de1641,secondary:#de1641"
                  : "primary:#6b7280,secondary:#9ca3af"
              }
              className={`shrink-0 transition-colors duration-150 ${
                isOpen
                  ? "[--lord-icon-primary:#de1641] [--lord-icon-secondary:#de1641]"
                  : "group-hover/dropdown:[--lord-icon-primary:#de1641] group-hover/dropdown:[--lord-icon-secondary:#de1641]"
              }`}
            />
          </span>
        </span>
      </button>

      {/* ADJUSTABLE OPENED STATE MENU */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={[
            "absolute z-50 rounded-3xl border border-rose-50 bg-white p-1.5 shadow-xl shadow-rose-950/5",
            "backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150",
            placementClasses,
            widthClass,
            menuClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* Optional Search bar in opened state with LordIcon search */}
          {searchable && (
            <div className="mb-1.5 px-1 pt-1">
              <div className="flex h-8 items-center gap-2 rounded-full border border-zinc-950/60 bg-neutral-50 px-3 transition-colors focus-within:border-rose-600 focus-within:ring-1 focus-within:ring-rose-200 hover:border-rose-600">
                <LordIcon
                  src="search"
                  size={20}
                  trigger="hover"
                  colors="primary:#6b7280,secondary:#9ca3af"
                  className="shrink-0"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-zinc-950/40"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Optional Adjustable Header Content Slot */}
          {headerContent && <div className="border-b border-rose-50/80 px-2 py-1.5">{headerContent}</div>}

          {/* Scrollable Options List with >= 4px padding between buttons */}
          <div
            className={[
              "flex flex-col gap-1 overflow-y-auto overscroll-contain p-1 pr-1.5",
              "[scrollbar-width:thin] [scrollbar-color:#e5e7eb_transparent]",
              maxHeight,
            ].join(" ")}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-950/60">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === currentValue;
                const isFocused = index === focusedIndex;

                if (renderOption) {
                  return (
                    <div
                      key={String(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectOption(opt)}
                      className={opt.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
                    >
                      {renderOption(opt, { selected: isSelected, active: isFocused })}
                    </div>
                  );
                }

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={[
                      "group/opt flex w-full items-center justify-between gap-2.5 rounded-full px-3 py-1.5 text-left text-sm font-normal",
                      "transition-colors duration-150",
                      isSelected
                        ? "bg-rose-50/80 text-rose-600"
                        : isFocused
                        ? "bg-rose-50 text-rose-600"
                        : "text-gray-700 hover:bg-rose-50 hover:text-rose-600",
                      opt.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {opt.icon && (
                        <span className="shrink-0">
                          {typeof opt.icon === "string" ? (
                            <LordIcon
                              src={opt.icon as LordIconName}
                              size={20}
                              trigger="hover"
                              colors={isSelected || isFocused ? "primary:#de1641,secondary:#de1641" : "primary:#6b7280,secondary:#9ca3af"}
                            />
                          ) : (
                            opt.icon
                          )}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-normal">{opt.label}</span>
                        {opt.description && (
                          <span className="block truncate text-xs text-zinc-950/50">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </span>

                    {/* Selected checkmark indicator - animated 20px LordIcon */}
                    {isSelected && (
                      <span className="shrink-0 text-rose-600">
                        <DropdownCheckIcon />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Optional Adjustable Footer Content Slot */}
          {footerContent && (
            <div className="mt-1 border-t border-rose-50/80 px-2 pt-1.5">{footerContent}</div>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownCheckIcon() {
  const iconRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = iconRef.current as any;
    if (el?.play) {
      el.play();
    }
  }, []);

  return (
    <LordIcon
      ref={iconRef}
      src="check-circle"
      size={20}
      trigger="hover"
      target="button"
      colors="primary:#de1641,secondary:#de1641"
      className="shrink-0 transition-colors duration-150 [--lord-icon-primary:#de1641] [--lord-icon-secondary:#de1641]"
    />
  );
}
