# Security policy

## Supported versions

Until ArchLens 1.0, security fixes are released on the newest minor version only.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| Earlier | No |

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's **Security → Report a vulnerability** flow for this repository. If private vulnerability reporting is unavailable, contact the repository owner through the private address listed on their GitHub profile.

Include a description, affected version, reproduction, impact, and any suggested mitigation. You can expect an acknowledgment within five business days and a status update within ten business days. Please allow maintainers a reasonable remediation window before public disclosure.

## Threat model

ArchLens reads untrusted repository trees and writes a report. It is designed to:

- never execute scanned source code;
- never evaluate project configuration;
- skip symbolic links during recursive walking;
- avoid network requests and telemetry;
- emit only repository-relative paths, metadata, and import specifiers;
- escape repository-derived values in HTML and Mermaid output;
- cap scanned file count by default.

Repository paths and import specifiers can still reveal sensitive architecture. Treat generated reports as source-adjacent artifacts and review them before sharing. Run ArchLens with the same filesystem privileges you would grant any local developer tool.

## Out of scope

Reports based on already-compromised local files, denial of service requiring intentionally enormous input beyond configured safety limits, and vulnerabilities in unsupported Node.js releases are generally out of scope. Clear bypasses of scanning limits, report injection, unintended file reads, or code execution are in scope.
