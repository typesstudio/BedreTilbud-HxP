"use client";
/*
 * Documentation:
 * Avatar — https://app.subframe.com/34bd735365b5/library?component=Avatar_bec25ae6-5010-4485-b46b-cf79e3943ab2
 * Chat List — https://app.subframe.com/34bd735365b5/library?component=Chat+List_0912e9e6-c7c3-497f-bf60-cb5361d8c378
 */

import React from "react";
import { FeatherCornerUpLeft } from "@subframe/core";
import * as SubframeUtils from "../utils";
import { Avatar } from "./Avatar";

interface ChatListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  avatar?: string;
  name?: React.ReactNode;
  message?: React.ReactNode;
  timestamp?: React.ReactNode;
  replied?: boolean;
  unread?: boolean;
  selected?: boolean;
  className?: string;
}

const ChatListItem = React.forwardRef<HTMLDivElement, ChatListItemProps>(
  function ChatListItem(
    {
      avatar,
      name,
      message,
      timestamp,
      replied = false,
      unread = false,
      selected = false,
      className,
      ...otherProps
    }: ChatListItemProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          "group/f0df7a36 flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-md px-3 py-3 hover:bg-neutral-50 active:bg-neutral-100",
          { "bg-brand-100 hover:bg-brand-100 active:bg-brand-50": selected },
          className
        )}
        ref={ref}
        {...otherProps}
      >
        <Avatar size="large" image={avatar}>
          JS
        </Avatar>
        <div className="flex grow shrink-0 basis-0 flex-col items-start">
          <div className="flex w-full items-center gap-2">
            {name ? (
              <span className="grow shrink-0 basis-0 text-body-bold font-body-bold text-default-font">
                {name}
              </span>
            ) : null}
            {timestamp ? (
              <span
                className={SubframeUtils.twClassNames(
                  "text-caption font-caption text-subtext-color",
                  {
                    "text-default-font": selected,
                    "text-caption-bold font-caption-bold text-default-font":
                      unread,
                  }
                )}
              >
                {timestamp}
              </span>
            ) : null}
          </div>
          <div className="flex w-full items-center gap-2">
            <FeatherCornerUpLeft
              className={SubframeUtils.twClassNames(
                "hidden text-body-bold font-body-bold text-subtext-color",
                { "inline-flex": replied }
              )}
            />
            {message ? (
              <span
                className={SubframeUtils.twClassNames(
                  "line-clamp-1 grow shrink-0 basis-0 text-body font-body text-subtext-color",
                  {
                    "text-default-font": selected,
                    "text-body-bold font-body-bold text-default-font": unread,
                    "text-body font-body": replied,
                  }
                )}
              >
                {message}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
);

interface ChatListRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const ChatListRoot = React.forwardRef<HTMLDivElement, ChatListRootProps>(
  function ChatListRoot(
    { children, className, ...otherProps }: ChatListRootProps,
    ref
  ) {
    return children ? (
      <div
        className={SubframeUtils.twClassNames(
          "flex w-full flex-col items-start gap-1",
          className
        )}
        ref={ref}
        {...otherProps}
      >
        {children}
      </div>
    ) : null;
  }
);

export const ChatList = Object.assign(ChatListRoot, {
  ChatListItem,
});
