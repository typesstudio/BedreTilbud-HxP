"use client";
/*
 * Documentation:
 * Breadcrumbs — https://app.subframe.com/34bd735365b5/library?component=Breadcrumbs_8898334b-a66f-4ee8-8bd1-afcfa8e37cc0
 * Button — https://app.subframe.com/34bd735365b5/library?component=Button_3b777358-b86b-40af-9327-891efc6826fe
 * Default Page Layout — https://app.subframe.com/34bd735365b5/library?component=Default+Page+Layout_a57b1c43-310a-493f-b807-8cc88e2452cf
 * Icon Button — https://app.subframe.com/34bd735365b5/library?component=Icon+Button_af9405b1-8c54-4e01-9786-5aad308224f6
 */

import React from "react";
import { FeatherUser } from "@subframe/core";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Button } from "../components/Button";
import { IconButton } from "../components/IconButton";
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
      <div className="flex w-full items-center justify-center gap-2 px-4 py-4">
        <div className="flex grow shrink-0 basis-0 items-center gap-2">
          <Breadcrumbs>
            <Breadcrumbs.Item>Dine bedre tilbud</Breadcrumbs.Item>
            <Breadcrumbs.Divider />
            <Breadcrumbs.Item active={true}>Sammenligning</Breadcrumbs.Item>
          </Breadcrumbs>
        </div>
        <Button
          disabled={false}
          variant="variation"
          size="medium"
          icon={null}
          iconRight={null}
          loading={false}
        >
          bedre tilbud
        </Button>
        <div className="flex grow shrink-0 basis-0 items-center justify-end gap-2">
          <span className="text-caption-bold font-caption-bold text-default-font">
            Få flere tilbud
          </span>
          <IconButton
            variant="brand-secondary"
            size="small"
            icon={<FeatherUser />}
          />
        </div>
      </div>
      {children ? (
        <div className="flex w-full grow shrink-0 basis-0 flex-col items-start gap-4 overflow-y-auto bg-default-background">
          {children}
        </div>
      ) : null}
    </div>
  );
});

export const DefaultPageLayout = DefaultPageLayoutRoot;
