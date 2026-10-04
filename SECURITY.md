# Security policy

Qelvo handles resumes, which means names, phone numbers, addresses and work history. We take that seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately through GitHub:
[Report a vulnerability](https://github.com/SalmanDeveloperz/qelvo/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. If you have a fix in mind, mention it, but there's no need to send a patch.

We'll acknowledge the report within 3 working days and keep you posted until it's fixed. Once a fix ships, we'll credit you in the advisory unless you'd rather stay anonymous.

## Scope

In scope:

- Anything that sends a user's file or resume data somewhere they didn't expect.
- Script injection through imported files, the code view, or generated PDFs.
- The `/api/import` server: auth, rate limiting, request handling.

Out of scope: denial of service from very large files in your own browser tab, and findings that need a compromised machine or browser extension to begin with.

## Supported versions

Only the latest release on `main` gets security fixes.
