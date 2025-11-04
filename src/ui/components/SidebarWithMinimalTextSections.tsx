"use client";
/*
 * Documentation:
 * Sidebar with minimal text sections — https://app.subframe.com/34bd735365b5/library?component=Sidebar+with+minimal+text+sections_5ceb0e51-a859-4b82-b5ee-367eaf41d29d
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface NavItemProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  selected?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
}

const NavItem = React.forwardRef<HTMLDivElement, NavItemProps>(function NavItem(
  {
    icon = null,
    children,
    selected = false,
    rightSlot,
    className,
    ...otherProps
  }: NavItemProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/9fa6ec70 flex w-full cursor-pointer items-center gap-2 rounded-md py-1",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper
          className={SubframeUtils.twClassNames(
            "text-body font-body text-subtext-color group-hover/9fa6ec70:text-default-font",
            { "text-default-font": selected }
          )}
        >
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
      {children ? (
        <span
          className={SubframeUtils.twClassNames(
            "line-clamp-1 text-body font-body text-subtext-color group-hover/9fa6ec70:text-default-font",
            {
              "text-body-bold font-body-bold text-default-font group-hover/9fa6ec70:no-underline":
                selected,
            }
          )}
        >
          {children}
        </span>
      ) : null}
      {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}
    </div>
  );
});

interface NavSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
}

const NavSection = React.forwardRef<HTMLDivElement, NavSectionProps>(
  function NavSection(
    { children, label, className, ...otherProps }: NavSectionProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "flex w-full flex-col items-start gap-4",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        <div className="flex w-full flex-col items-start gap-4">
          {label ? (
            <span className="line-clamp-1 w-full text-caption-bold font-caption-bold text-default-font">
              {label}
            </span>
          ) : null}
        </div>
        {children ? (
          <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-2">
            {children}
          </div>
        ) : null}
      </div>
    );
  }
);

interface SidebarWithMinimalTextSectionsRootProps
  extends React.HTMLAttributes<HTMLElement> {
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const SidebarWithMinimalTextSectionsRoot = React.forwardRef<
  HTMLElement,
  SidebarWithMinimalTextSectionsRootProps
>(function SidebarWithMinimalTextSectionsRoot(
  {
    header,
    children,
    footer,
    className,
    ...otherProps
  }: SidebarWithMinimalTextSectionsRootProps,
  ref
) {
  return (
    <nav
      className={SubframeUtils.twClassNames(
        "flex h-full w-72 flex-col items-start bg-default-background border-r border-solid border-neutral-border",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {header ? (
        <div className="flex w-full flex-col items-start gap-2 px-8 pt-8 pb-6">
          {header}
        </div>
      ) : null}
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-12 px-8 py-6 overflow-auto">
          {children}
        </div>
      ) : null}
      {footer ? (
        <div className="flex w-full flex-col items-start justify-end gap-2 px-6 py-6">
          {footer}
        </div>
      ) : null}
    </nav>
  );
});

export const SidebarWithMinimalTextSections = Object.assign(
  SidebarWithMinimalTextSectionsRoot,
  {
    NavItem,
    NavSection,
  }
);
