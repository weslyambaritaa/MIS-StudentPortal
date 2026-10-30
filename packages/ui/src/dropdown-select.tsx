"use client";

import { Children, isValidElement, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from "react";
import { Dropdown, type DropdownOption, type DropdownProps } from "./dropdown";

type OptionProps = { value?: string; disabled?: boolean; children?: ReactNode };

export type DropdownSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "className" | "onChange" | "placeholder" | "size"> & {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  label?: ReactNode;
  placeholder?: string;
  leftIcon?: DropdownProps["leftIcon"];
  rightIcon?: DropdownProps["leftIcon"];
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
};

/** Native-select-compatible adapter that renders the shared, branded dropdown. */
export function DropdownSelect({
  children,
  className = "",
  containerClassName = "",
  label,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  name,
  placeholder = "Select option",
  leftIcon,
  rightIcon,
  ...attributes
}: DropdownSelectProps) {
  const options: DropdownOption<string>[] = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child) || child.type !== "option") return [];
    const optionValue = child.props.value ?? (typeof child.props.children === "string" ? child.props.children : "");
    return [{ value: optionValue, label: child.props.children, disabled: child.props.disabled }];
  });

  const sizingClasses = className
    .split(/\s+/)
    .filter((token) => /^(w-|min-w-|max-w-|mt-|mb-|ml-|mr-|mx-|my-|self-|flex-)/.test(token))
    .join(" ");

  return (
    <Dropdown
      ariaLabel={attributes["aria-label"]}
      options={options}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      onChange={(nextValue) => onChange?.({ target: { value: nextValue }, currentTarget: { value: nextValue } } as ChangeEvent<HTMLSelectElement>)}
      label={label}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      name={name}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      containerClassName={containerClassName}
      className={sizingClasses}
    />
  );
}
