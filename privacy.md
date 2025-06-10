# Blue Blocker Privacy Policy

This privacy policy ("policy") will help you understand how Blue Blocker collects, uses, and protects the data you provide when you use the Blue Blocker extension/addon (herein: "the Extension").

This policy may change from time to time and we will do our best to promptly update you on changes. If you want to make sure that you are up to date with the latest changes, we advise you to visit the version of this policy hosted on [GitHub](https://github.com/kheina-com/Blue-Blocker/blob/main/privacy.md).

This version of the Privacy Policy was last updated on September 6th, 2024.

## What User Data the Extension Collects

-   Session cookies set by the Twitter web client.
-   CSRF tokens used in requests to the Twitter API.
-   The URL of any request made by the Twitter web client to the Twitter API. These URLs may include the URLs of pages that you visit.
-   Data sent to the Twitter web client by Twitter's servers ("Twitter data".)

## Why the Extension Collects Your Data

-   Session cookies are used to authenticate requests to the blocking/muting endpoint of the Twitter API.
-   CSRF tokens are used to allow requests to be sent and processed by Twitter.
-   URLs are used to filter responses and to parse responses in order to extract Twitter user objects.
-   Twitter data is used to determine whether a Twitter user should be blocked, and to properly form requests to the blocking/muting endpoint of the Twitter API.
    -   Twitter usernames, display names, and user IDs contained in this data are additionally used to create a history of users that have been blocked by the extension, and generate a list of users to not block in the future.
    -   This data may also be used to allow other extensions or addons to add additional checks in determining if the user should be blocked. You are advised to consult the Privacy Policies of any integrated extensions to learn what purposes they have for usage of this data.

**Your data will never be used by the Extension for any analytical or commercial purpose.**

## How User Data is Processed

All processing of User Data by the Extension is done on-device. The Extension does not transmit data to an external server in order to process it.

If you decide to share data with other extensions or addons, we can not guarantee how your data will be processed by those extensions or addons. You are advised to read the Privacy Policies of any other extensions or addons you share User Data with to understand how they process your User Data.

## What User Data is Stored by the Extension

We are committed to safeguarding all data that you provide to the Extension. We have done everything in our power to prevent data theft, unauthorized access, and disclosure by storing as much data locally as is feasible, and only using well understood browser APIs to store your data.

Session cookies and CSRF tokens are stored locally by the Extension.

Any URLs that are collected are discarded after their use, and never stored.

The usernames, display names, and/or user IDs of blocked users are stored locally.

Usernames, display names, and user IDs of unblocked users is stored within the synced portion of your browser's extension data store.

All other Twitter data (including, but not limited to: post contents, like counts, following/follower status, and profile description), including data from users that are not blocked, is discarded immediately after use, and never stored.

## What User Data is Shared With Third Parties

The public user data sent by the Twitter API are parsed by the Extension, and/or extensions/addons you have opted to integrate with, and determines what user IDs are transmitted back to the Twitter API in order to block the user.

You can optionally configure the Extension to send the Twitter data it collects to other extensions/addons ("integrations"). Data is never shared without your explicit consent, and you may revoke consent at any time. We advise you to refer to the Privacy Policies of the extensions/addons that you enable data sharing with to understand how those extensions collect, store, and use the data you provide to them.

**No other user data is shared with any outside parties.**

## How to Opt Out of Data Collection, Usage, and Storage

We have made our best effort to limit the data that is collected, used, and stored to only the data that is essential to the function of the Extension. Therefore opting out of collection, usage, and/or storage of your data will make the Extension non-functional.

If at any time you wish to no longer allow the Extension to collect, store, or use your data, we advise you to immediately uninstall the Extension.

## Data Deletion

You can delete all data related to or stored by the Extension at any time by uninstalling the Extension.

You can delete all data related to unblocked users at any time by navigating to the "advanced" tab of the Extension's popup and clicking the "clear" button in the safelist section.
