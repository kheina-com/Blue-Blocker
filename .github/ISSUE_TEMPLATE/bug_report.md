---
name: Bug report
about: Create a report to help us improve Blue-Blocker
title: "[bug]"
labels: bug
assignees: ''

body:
- type: markdown
  attributes:
    value: "Hi! Thank you for your bug report. We have a question for you to answer first."
- type: checkboxes
  id: checked-dupes
  attributes:
    label: "Before you create your issue, have you checked if there is already an open issue related to the bug you encountered?"
    description: "[Click here](https://github.com/kheina-com/Blue-Blocker/labels/bug) to check for open issues."
    options:
      - label: "Yes, I have made sure that this is not a duplicate issue"
        required: "true"
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots and console logs**
If applicable, add screenshots to help explain your problem. If there are console logs related to the bug, then please add them here, too.

**Please fill in the following information:**
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
