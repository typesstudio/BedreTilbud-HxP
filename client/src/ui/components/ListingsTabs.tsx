"use client";
/*
 * Documentation:
 * Listings Tabs — https://app.subframe.com/34bd735365b5/library?component=Listings+Tabs_6670aebb-5045-4111-a97c-25b34d7596a6
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(function Item(
  {
    checked = false,
    children,
    icon = null,
    className,
    ...otherProps
  }: ItemProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "group/d4ec529f flex min-w-[96px] cursor-pointer items-center justify-center gap-2 border-b-2 border-solid border-transparent py-2 hover:border-b-2 hover:border-solid hover:border-neutral-300",
        {
          "border-b-2 border-solid border-default-font hover:border-b-2 hover:border-solid hover:border-default-font":
            checked,
        },
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <div className="flex grow shrink-0 basis-0 flex-col items-center gap-2">
        {icon ? (
          <SubframeCore.IconWrapper
            className={SubframeUtils.twClassNames(
              "text-heading-3 font-heading-3 text-subtext-color group-hover/d4ec529f:text-default-font",
              { "text-default-font": checked }
            )}
          >
            {icon}
          </SubframeCore.IconWrapper>
        ) : null}
        {children ? (
          <span
            className={SubframeUtils.twClassNames(
              "line-clamp-1 w-full font-['Inter'] text-[12px] font-[500] leading-[16px] text-neutral-500 text-center group-hover/d4ec529f:text-default-font",
              {
                "text-default-font group-hover/d4ec529f:text-default-font":
                  checked,
              }
            )}
          >
            {children}
          </span>
        ) : null}
      </div>
    </div>
  );
});

interface ListingsTabsRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const ListingsTabsRoot = React.forwardRef<
  HTMLDivElement,
  ListingsTabsRootProps
>(function ListingsTabsRoot(
  { children, className, ...otherProps }: ListingsTabsRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex w-full flex-col items-start gap-2",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 items-start gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const ListingsTabs = Object.assign(ListingsTabsRoot, {
  Item,
});
