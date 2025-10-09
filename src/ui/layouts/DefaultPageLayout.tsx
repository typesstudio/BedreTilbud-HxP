"use client";
/*
 * Documentation:
 * Default Page Layout — https://app.subframe.com/34bd735365b5/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Icon Button — https://app.subframe.com/34bd735365b5/library?component=Icon+Button_af9405b1-8c54-4e01-9786-5aad308224f6
 * Topbar with center nav — https://app.subframe.com/34bd735365b5/library?component=Topbar+with+center+nav_2d99c811-1412-432c-b923-b290dd513802
 */

import React from "react";
import { FeatherBell } from "@subframe/core";
import { FeatherUser } from "@subframe/core";
import { IconButton } from "../components/IconButton";
import { TopbarWithCenterNav } from "../components/TopbarWithCenterNav";
import * as SubframeUtils from "../utils";

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLDivElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, className, ...otherProps }: DefaultPageLayoutRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-screen w-full flex-col items-center",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <TopbarWithCenterNav
        leftSlot={
          <span className="text-body-bold font-body-bold text-brand-700">
            BedreTilbud.com
          </span>
        }
        centerSlot={
          <>
            <TopbarWithCenterNav.NavItem selected={true}>
              Home
            </TopbarWithCenterNav.NavItem>
            <TopbarWithCenterNav.NavItem>Inbox</TopbarWithCenterNav.NavItem>
            <TopbarWithCenterNav.NavItem>Reports</TopbarWithCenterNav.NavItem>
          </>
        }
        rightSlot={
          <>
            <IconButton size="small" icon={<FeatherBell />} />
            <IconButton size="small" icon={<FeatherUser />} />
          </>
        }
      />
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto bg-default-background">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
