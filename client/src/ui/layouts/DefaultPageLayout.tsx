// @subframe/sync-disable
"use client";
/*
 * Documentation:
 * Default Page Layout — https://app.subframe.com/34bd735365b5/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 */

import React from "react";
import * as SubframeUtils from "../utils";

interface DefaultPageLayoutRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  breadcrumbs?: { label: string; path: string; active?: boolean }[];
  onNavigate?: (path: string) => void;
  onProfileClick?: () => void;
  onSendInquiryClick?: () => void;
  className?: string;
}

const DefaultPageLayoutRoot = React.forwardRef<
  HTMLDivElement,
  DefaultPageLayoutRootProps
>(function DefaultPageLayoutRoot(
  { children, breadcrumbs = [], onNavigate, onProfileClick, onSendInquiryClick, className }: DefaultPageLayoutRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex h-full w-full flex-col items-center",
        className
      )}
      ref={ref}
    >
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto bg-default-background">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
