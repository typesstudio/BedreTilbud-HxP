"use client";
/*
 * Documentation:
 * Text Field2 — https://app.subframe.com/34bd735365b5/library?component=Text+Field2_1c1c4f15-76ef-4a0d-8208-cc52efe07e1c
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  placeholder?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { placeholder, className, ...otherProps }: InputProps,
  ref
) {
  return (
    <input
      className={SubframeUtils.twClassNames(
        "h-full w-full border-none bg-transparent text-body font-body text-default-font outline-none placeholder:text-neutral-400",
        className
      )}
      placeholder={placeholder as string}
      ref={ref}
      {...otherProps}
    />
  );
});

interface TextField2RootProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  disabled?: boolean;
  error?: boolean;
  variant?: "outline" | "filled";
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const TextField2Root = React.forwardRef<HTMLLabelElement, TextField2RootProps>(
  function TextField2Root(
    {
      disabled = false,
      error = false,
      variant = "outline",
      label,
      helpText,
      icon = null,
      iconRight = null,
      children,
      className,
      ...otherProps
    }: TextField2RootProps,
    ref
  ) {
    return (
      <label
        className={SubframeUtils.twClassNames(
          "group/1c1c4f15 flex flex-col items-start gap-1",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        {label ? (
          <span className="text-caption-bold font-caption-bold text-default-font">
            {label}
          </span>
        ) : null}
        <div
          className={SubframeUtils.twClassNames(
            "flex h-8 w-full flex-none items-center gap-1 rounded-md border border-solid border-neutral-border bg-default-background px-2 group-focus-within/1c1c4f15:border group-focus-within/1c1c4f15:border-solid group-focus-within/1c1c4f15:border-brand-primary",
            {
              "border border-solid border-neutral-100 bg-neutral-100 group-hover/1c1c4f15:border group-hover/1c1c4f15:border-solid group-hover/1c1c4f15:border-neutral-border group-focus-within/1c1c4f15:bg-default-background":
                variant === "filled",
              "border border-solid border-error-600": error,
              "border border-solid border-neutral-200 bg-neutral-200": disabled,
            }
          )}
        >
          {icon ? (
            <SubframeCore.IconWrapper className="text-body font-body text-subtext-color">
              {icon}
            </SubframeCore.IconWrapper>
          ) : null}
          {children ? (
            <div className="flex grow shrink-0 basis-0 flex-col items-start self-stretch px-1">
              {children}
            </div>
          ) : null}
          {iconRight ? (
            <SubframeCore.IconWrapper
              className={SubframeUtils.twClassNames(
                "text-body font-body text-subtext-color",
                { "text-error-500": error }
              )}
            >
              {iconRight}
            </SubframeCore.IconWrapper>
          ) : null}
        </div>
        {helpText ? (
          <span
            className={SubframeUtils.twClassNames(
              "text-caption font-caption text-subtext-color",
              { "text-error-700": error }
            )}
          >
            {helpText}
          </span>
        ) : null}
      </label>
    );
  }
);

export const TextField2 = Object.assign(TextField2Root, {
  Input,
});
