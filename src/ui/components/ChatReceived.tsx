"use client";
/*
 * Documentation:
 * Avatar — https://app.subframe.com/34bd735365b5/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Chat Received — https://app.subframe.com/34bd735365b5/library?component=Chat+Received_be1cbd1f-58c2-47ae-8cac-39b31b82605f
 */

import React from "react";
import * as SubframeUtils from "../utils";
import { Avatar } from "./Avatar";

interface ChatReceivedRootProps extends React.HTMLAttributes<HTMLDivElement> {
  avatar?: string;
  initials?: React.ReactNode;
  name?: React.ReactNode;
  message?: React.ReactNode;
  time?: React.ReactNode;
  className?: string;
}

const ChatReceivedRoot = React.forwardRef<
  HTMLDivElement,
  ChatReceivedRootProps
>(function ChatReceivedRoot(
  {
    avatar,
    initials,
    name,
    message,
    time,
    className,
    ...otherProps
  }: ChatReceivedRootProps,
  ref
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        "flex w-full items-start gap-4",
        className
      )}
      ref={ref}
      {...otherProps}
    >
      <Avatar size="medium" image={avatar}>
        {initials}
      </Avatar>
      <div className="flex flex-col items-start gap-1">
        <div className="flex w-full flex-wrap items-center gap-2">
          {name ? (
            <span className="text-body-bold font-body-bold text-default-font">
              {name}
            </span>
          ) : null}
          {time ? (
            <span className="text-caption font-caption text-subtext-color">
              {time}
            </span>
          ) : null}
        </div>
        <div className="flex max-w-[576px] flex-col items-start gap-2 rounded-md bg-neutral-100 px-3 py-2">
          {message ? (
            <span className="text-body font-body text-default-font">
              {message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export const ChatReceived = ChatReceivedRoot;
