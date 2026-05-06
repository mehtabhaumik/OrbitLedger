# Orbit Ledger Office Access Model And Permission Matrix

This document defines the first Office access contract. It is intentionally strict because Office allows multiple people inside one business workspace.

## Core Rule

Office workspace roles are customer-company roles. They are not the same as Orbit Ledger internal admin roles.

- Customer Office roles control what a company member can do inside that company workspace.
- Orbit Ledger internal admin roles control support, billing review, and invitation processing outside the customer workspace.
- Internal admin access must never silently grant access to customer business data.

## Customer Office Roles

| Role | Purpose | Launch guidance |
| --- | --- | --- |
| Owner | Full workspace control, including billing, team access, backups, and ownership transfer. | Use only for the person legally responsible for the company workspace. |
| Admin | Runs the office workspace and team operations, without ownership transfer rights. | Good for a trusted office lead. Sensitive settings remain audited. |
| Manager | Handles daily customers, invoices, payments, inventory, reports, and recurring work. | Good for daily business operations. |
| Staff | Creates routine records and payments, with limited correction and export access. | Good for front-office entry work. |
| Accountant | Reviews reports, exports, tax surfaces, documents, and audit history without daily editing rights. | Good for accountants and finance reviewers. |
| Viewer | Read-only access to approved workspace views. | Good for review-only access. |

## High-Level Permission Matrix

| Area | Owner | Admin | Manager | Staff | Accountant | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard and business health | Yes | Yes | Yes | Limited | Yes | Yes |
| Customers | Full | Full | Create/edit | Create/edit | View | View |
| Invoices | Full | Full | Create/edit latest | Create/view | View/export | View |
| Invoice versions | Full | Full | View/restore | View | View | View |
| Payments | Full | Full | Record/verify/allocate | Record | View | View |
| Payment reversal and allocation corrections | Yes | Yes | No reversal | No | No | No |
| Transactions | Full | Full | Record/view | Record/view | View | View |
| Products and inventory | Full | Full | Manage | Manage | No | No |
| Documents and exports | Full | Full | Export | View only | Export and bulk export | View only |
| Reports and tax surfaces | Full | Full | Reports | Basic reports | Reports, exports, tax, audit | View reports |
| Recurring invoices and auto email approval | Full | Full | Recurring rules only | No | No | No |
| Company, invoice, tax, payment, security settings | Full | Full, audited | No | No | No | No |
| Backup export and restore | Full | Full | View status only | No | View status only | View status only |
| Team invites, roles, removal | Full | Non-owner roles only | No | No | No | No |
| Billing entitlement | Full | Full | No | No | No | No |
| Ownership transfer | Owner only | No | No | No | No | No |

## Sensitive Actions

These actions must remain audit-protected in Office:

- payment reversals,
- payment allocation changes,
- invoice cancellation,
- invoice version restore,
- tax setting changes,
- payment setting changes,
- security setting changes,
- backup export,
- backup restore,
- team invitation,
- role changes,
- member removal,
- billing entitlement changes,
- ownership transfer.

## Internal Orbit Ledger Admin Roles

These roles are for Rudraix or Orbit Ledger operations and must stay outside customer workspace membership.

| Internal role | Allowed scope |
| --- | --- |
| Internal owner | Review Office invitations, manage invited Office access, review billing events, resolve purchase issues, review consented diagnostics, and review security events. |
| Internal billing admin | Review Office invitations, manage invited Office access, review billing events, and resolve purchase issues. |
| Internal support reviewer | Review Office invitations and customer-approved diagnostics. |
| Internal security reviewer | Review customer-approved diagnostics and security events. |

## Implementation Contract

The shared source of truth lives in:

- `/Users/bmehta/Downloads/OrbitLedger/packages/core/src/officeAccess.ts`
- `/Users/bmehta/Downloads/OrbitLedger/packages/core/src/officeMembership.ts`

Every Office surface should use this shared model:

- web Office invitation and team UI,
- future Office admin console,
- Firestore rules and member documents,
- audit logs,
- support operations.

## Phase 2 Membership Schema

Office uses three Firestore subcollections under each workspace:

| Collection | Purpose | Client write policy |
| --- | --- | --- |
| `office_members` | Active, invited, suspended, or removed workspace members keyed by Firebase UID. | Owner and Office admin controlled. Members may update only their own lightweight presence fields. |
| `office_invitations` | Pending and historical invitations keyed by invitation ID. | Owner can invite admin and lower roles. Office admin can invite manager, staff, accountant, and viewer. |
| `office_access_audit` | Access history for invitations, role changes, removals, ownership events, and internal reviews. | Server controlled. Client apps can read only when allowed. |

### Member Document

Path:

`workspaces/{workspaceId}/office_members/{userId}`

Fields:

- `uid`
- `workspace_id`
- `role`
- `status`
- `email`
- `display_name`
- `invited_by`
- `invited_at`
- `accepted_at`
- `suspended_at`
- `removed_at`
- `last_seen_at`
- `created_at`
- `updated_at`

Allowed member statuses:

- `active`
- `invited`
- `suspended`
- `removed`

Only `active` members can read workspace data.

### Invitation Document

Path:

`workspaces/{workspaceId}/office_invitations/{invitationId}`

Fields:

- `email`
- `role`
- `status`
- `workspace_id`
- `invited_by`
- `invited_by_name`
- `message`
- `expires_at`
- `accepted_by`
- `accepted_at`
- `revoked_by`
- `revoked_at`
- `created_at`
- `updated_at`

Allowed invitation statuses:

- `pending`
- `accepted`
- `declined`
- `expired`
- `revoked`

### Firestore Rule Boundary

The current rules now support:

- owner-created workspace remains unchanged,
- owner access remains valid,
- active Office members can read workspace data,
- viewer and accountant roles remain read-only at the rule level,
- staff, manager, and admin can write allowed day-to-day collections,
- sensitive subscription and Office audit collections stay server controlled,
- Office admins cannot invite or create another admin or owner,
- inactive Office members cannot read the workspace.

The rules intentionally keep ownership transfer out of client-side writes for now. That should be a dedicated, audited server action.

## Phase 3 Office Invitation Review And Admin Grant Workflow

Office remains invitation-only. The first backend-safe workflow is:

1. Customer requests Office access.
2. The request enters admin review.
3. Internal admin marks it reviewing, approves it, rejects it, or grants access.
4. Granting access is allowed only after approval.
5. The grant creates Office entitlement and owner membership records.
6. Every access decision writes an audit record.

The shared workflow source of truth lives in:

- `/Users/bmehta/Downloads/OrbitLedger/packages/core/src/officeGrantWorkflow.ts`

### Request Statuses

- `submitted`
- `needs_review`
- `reviewing`
- `approved`
- `rejected`
- `granted`
- `cancelled`

Final statuses are:

- `rejected`
- `granted`
- `cancelled`

Finalized requests cannot be changed again.

### Admin Actions

| Action | Allowed when | Result |
| --- | --- | --- |
| `mark_reviewing` | Request is not final. | Marks request as actively reviewed. |
| `approve` | Request is not final. | Approves the request but does not grant access yet. |
| `reject` | Request is not final. | Rejects the request. |
| `grant_access` | Request is already approved. | Grants Office entitlement and creates owner membership. |

### Server-Controlled Collections

These are intentionally not client-writable:

| Collection | Purpose |
| --- | --- |
| `office_access_requests` | Stores customer Office access requests and current review status. |
| `office_access_admin_queue` | Internal admin queue projection for review work. |
| `office_access_audit` | Immutable access history for decisions and grants. |

The Firestore rules allow owner/admin read visibility where useful, but all writes stay server-controlled. Hidden admin tooling must use trusted server code, not browser writes.

### Grant Output

When an approved request is granted, the workflow produces:

- entitlement grant intent for `office_monthly` or `office_yearly`,
- owner `office_members` draft,
- `office_access_audit` draft,
- admin queue status patch,
- request status patch.

## Phase 10 Role-Aware App Guard QA

Phase 10 adds a web-facing simulation layer so Office role behavior is testable before a real team starts using the product.

Source of truth:

- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/web-office-access.ts`
- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/web-office-access.test.ts`

### Simulation Coverage

The QA simulation checks:

- existing solo workspaces without `office_members` still receive owner access,
- explicit owner membership matches owner fallback behavior,
- inactive members are locked out,
- every Office role is evaluated against workspace routes,
- every Office role is evaluated against sensitive action locks,
- viewer remains read-only,
- accountant remains review-first,
- staff can enter routine records but cannot export, approve, or reverse,
- manager can run daily operations but cannot manage billing, team access, sensitive settings, or restore backup.

### Route Guard Expectations

| Route area | Owner | Admin | Manager | Staff | Accountant | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Customers | Yes | Yes | Yes | Yes | Yes | Yes |
| Add customer | Yes | Yes | Yes | Yes | No | No |
| Invoices | Yes | Yes | Yes | Yes | Yes | Yes |
| Monthly invoice automation | Yes | Yes | Yes | No | No | No |
| Transactions | Yes | Yes | Yes | Yes | Yes | Yes |
| Payments | Yes | Yes | Yes | Yes | Yes | Yes |
| Products | Yes | Yes | Yes | Yes | No | No |
| Documents and templates | Yes | Yes | Yes | Yes | Yes | Yes |
| Reports | Yes | Yes | Yes | Yes | Yes | Yes |
| Market and billing | Yes | Yes | No | No | No | No |
| Team | Yes | Yes | No | No | No | No |
| Backup status | Yes | Yes | Yes | No | Yes | Yes |
| Settings | Yes | Yes | No | No | No | No |

### Sensitive Action Lock Expectations

| Sensitive action | Owner | Admin | Manager | Staff | Accountant | Viewer |
| --- | --- | --- | --- | --- | --- | --- |
| Create/update customers | Yes | Yes | Yes | Yes | No | No |
| Export customer profiles | Yes | Yes | Yes | No | Yes | No |
| Create invoices | Yes | Yes | Yes | Yes | No | No |
| Edit saved invoice | Yes | Yes | Yes | No | No | No |
| Cancel/archive invoice | Yes | Yes | No | No | No | No |
| Manage monthly invoice rules | Yes | Yes | Yes | No | No | No |
| Approve automatic email | Yes | Yes | No | No | No | No |
| Record invoice payment | Yes | Yes | Yes | Yes | No | No |
| Verify payment clearance | Yes | Yes | Yes | No | No | No |
| Reverse payment | Yes | Yes | No | No | No | No |
| Apply provider event to invoice | Yes | Yes | Yes | No | No | No |
| Record transaction | Yes | Yes | Yes | Yes | No | No |
| Export transactions/reports | Yes | Yes | Yes | No | Yes | No |
| Manage products/inventory | Yes | Yes | Yes | Yes | No | No |
| Export tax summary | Yes | Yes | No | No | Yes | No |
| Export backup | Yes | Yes | No | No | No | No |
| Restore backup | Yes | Yes | No | No | No | No |
| Manage billing/plans | Yes | Yes | No | No | No | No |
| Manage company settings | Yes | Yes | No | No | No | No |

### Verification Commands

Use Node 24:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run test -- apps/web/src/lib/web-office-access.test.ts
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run typecheck --workspace @orbit-ledger/web
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build --workspace @orbit-ledger/web
```

## Phase 11 Office Audit Log Viewer And Access Event Timeline

Phase 11 adds a user-facing Office access timeline on the Team page.

Source of truth:

- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/office-team.ts`
- `/Users/bmehta/Downloads/OrbitLedger/apps/web/app/(workspace)/team/page.tsx`

### Timeline Purpose

The access timeline helps owners, admins, and accountants answer:

- who was invited,
- who accepted,
- who changed a role,
- who suspended or removed a member,
- whether an invitation was revoked,
- whether ownership transfer activity occurred,
- whether Orbit Ledger reviewed access through a trusted internal flow.

### Timeline Filters

The Team page now supports:

- all access events,
- member changes,
- invitations,
- ownership,
- internal reviews.

### Access Rules

The Team page is now guarded by `view_audit_log`.

This means:

- Owner can view audit history and manage team access.
- Admin can view audit history and manage non-owner team access.
- Accountant can view audit history without invite, role-change, or removal actions.
- Manager, Staff, and Viewer cannot open the Team access surface.

Invite and member-management actions still use their stricter permissions:

- `invite_team_members`
- `change_member_roles`
- `remove_team_members`

### Timeline Copy Rules

Timeline rows must avoid raw backend language. Use plain labels:

- `Invitation created`
- `Invitation accepted`
- `Role changed`
- `Member suspended`
- `Member removed`
- `Invitation revoked`
- `Ownership transfer requested`
- `Ownership transferred`
- `Access reviewed`

The UI should show actor, target, date/time, and concise business context.

This keeps customer-facing Office admins separate from Orbit Ledger internal admins.

## Next Build Boundary

The next phase should add the hidden admin operations surface that can read the server-controlled queue and call trusted grant actions.

Recommended next keyword:

`EXECUTE OFFICE PHASE 4: Hidden Admin Operations UI`

## Phase 4 Hidden Admin Operations UI

The hidden Office operations route is:

`/office-operations`

It is intentionally not linked in the customer sidebar or public Market flow.

The UI currently provides:

- Office request metrics,
- review queue,
- request contact details,
- request message preview,
- status chips,
- available safe actions based on the shared review workflow,
- read-only guard copy until trusted server actions are connected.

The web source lives in:

- `/Users/bmehta/Downloads/OrbitLedger/apps/web/app/(workspace)/office-operations/page.tsx`
- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/office-admin-operations.ts`

### Access Boundary

The page checks `NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS` for a comma-separated allowlist. In production, if this allowlist is empty or the signed-in email is not listed, the page shows a restricted state.

This is not the final security boundary for writes. All grant writes remain server-controlled and blocked by Firestore rules. The UI only reads the current workspace queue and previews allowed actions.

### Current Limitation

The hidden UI does not yet execute `mark_reviewing`, `approve`, `reject`, or `grant_access`. Clicking an action shows the trusted server action that must be connected next.

## Next Build Boundary

The next phase should add trusted server functions for the hidden UI actions:

- mark reviewing,
- approve,
- reject,
- grant Office access,
- create Office entitlement,
- create owner `office_members` record,
- write `office_access_audit`.

Recommended next keyword:

`EXECUTE OFFICE PHASE 5: Trusted Grant Actions + Server Audit Writes`

## Phase 5 Trusted Grant Actions And Server Audit Writes

The hidden Office operations UI now calls a trusted Cloud Function:

`resolveOfficeAccessRequest`

The function verifies:

- signed-in Firebase user token,
- server-side internal admin email allowlist through `ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS`,
- workspace exists,
- Office access request exists,
- action is valid,
- request is not already finalized,
- access is approved before granting.

### Supported Actions

| Action | Server behavior |
| --- | --- |
| `mark_reviewing` | Updates request and admin queue to active review. |
| `approve` | Approves the request without granting access yet. |
| `reject` | Rejects the request and records audit. |
| `grant_access` | Grants Office entitlement, creates owner member record, updates request and queue, and writes audit. |

### Server Writes

Grant action writes:

- `workspaces/{workspaceId}/office_access_requests/{requestId}`
- `workspaces/{workspaceId}/office_access_admin_queue/{queueId}`
- `workspaces/{workspaceId}/office_access_audit/{auditId}`
- `workspaces/{workspaceId}/office_members/{requesterUid}`
- `users/{requesterUid}/subscription_entitlements/{workspaceId}`
- `users/{requesterUid}/subscription_entitlement_audit/{auditId}`

### Security Boundary

Firestore rules still block browser writes to the Office request, admin queue, and access audit collections. The browser can request an action, but only the trusted function can write the grant.

The production Functions environment must set:

`ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS`

Use comma-separated internal admin emails. Do not rely on the browser allowlist as the final write boundary.

## Next Build Boundary

The next phase should make Office access usable by the customer after approval:

- seed/read owner membership,
- team member list,
- invite form,
- role selector,
- remove/suspend flow,
- audit visibility,
- role-based UI disabling.

Recommended next keyword:

`EXECUTE OFFICE PHASE 6: Team Management UI + Role-Based Controls`

## Phase 6 Team Management UI And Role-Based Controls

The customer-facing Team route is now:

`/team`

It is linked from the workspace sidebar so Office users can find it after access is granted.

### What The Team Screen Provides

- Office access status for the signed-in user.
- Active member count.
- Pending invitation count.
- Suspended member count.
- Recent access history count.
- Invite teammate form.
- Member list.
- Role selector where the actor is allowed to change a role.
- Suspend, restore, and remove controls where the actor is allowed.
- Invitation list with revoke controls.
- A plain-language preview of the signed-in user's current permissions.

### Access Behavior

The Team route does not unlock only from the purchase plan. That is intentional because web beta checkout is free-only right now.

The UI treats a workspace as Office-ready when either:

- the active subscription tier includes Office, or
- the signed-in user has an active `office_members` record for that workspace.

This allows the internal Office grant workflow to create the owner membership record and immediately make the Team screen usable without depending on live checkout.

### Role-Based UI Controls

All visible controls use the shared Office role model:

- owners can invite admins and lower roles,
- admins can invite manager, staff, accountant, and viewer roles,
- admins cannot create another admin,
- owners cannot be removed or downgraded from the browser UI,
- members cannot suspend or remove themselves,
- role selectors show only roles the current actor may assign.

The Firestore rules remain the final client-write boundary for Office members and invitations.

### Web Source

- `/Users/bmehta/Downloads/OrbitLedger/apps/web/app/(workspace)/team/page.tsx`
- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/office-team.ts`
- `/Users/bmehta/Downloads/OrbitLedger/apps/web/src/lib/office-team.test.ts`

### Current Boundary

The screen creates and updates Office invitation/member records through the browser under strict Firestore role rules. Office access audit remains server-controlled and read-only for client apps.

Invitation delivery and member acceptance are intentionally not in this phase.

## Next Build Boundary

The next phase should make invitations complete:

- send or prepare invitation delivery,
- let invited users accept,
- attach the accepted Firebase UID to the member record,
- make invited users discover the shared workspace,
- write server-side audit entries for invitation acceptance.

Recommended next keyword:

`EXECUTE OFFICE PHASE 7: Invitation Delivery + Acceptance Flow`

## Phase 7 Invitation Delivery And Acceptance Flow

Office invitations now have an acceptance path instead of being only internal records.

### Invite Link

The Team screen can copy an acceptance link for a pending invitation:

`/team/invite?workspaceId={workspaceId}&invitationId={invitationId}`

This keeps delivery provider-neutral for now. The link can be sent manually while email delivery is connected later.

### Acceptance Page

The acceptance page lives outside the normal workspace guard:

`/team/invite`

That matters because an invited user may not have any workspace yet. The page asks the user to sign in and then accepts the invitation through a trusted Cloud Function.

### Trusted Function

The trusted function is:

`acceptOfficeInvitation`

It verifies:

- the caller is signed in,
- the caller has a verified Firebase user token,
- the invitation exists,
- the invitation is still pending,
- the signed-in email matches the invited email,
- the invited role is assignable,
- the workspace exists.

On success it writes:

- `workspaces/{workspaceId}/office_members/{acceptedUid}`
- `workspaces/{workspaceId}/office_invitations/{invitationId}`
- `workspaces/{workspaceId}/office_access_audit/{auditId}`

The member record becomes active immediately after acceptance.

### Workspace Discovery

The web workspace loader now returns:

- workspaces owned by the signed-in user,
- workspaces where the signed-in user has an active Office member record.

This makes accepted Office workspaces appear in the workspace selector after refresh.

### Safety Rules

- Invited users cannot accept with a different email.
- Revoked, expired, declined, or already accepted invitations cannot be reused by a different account.
- Firestore rules still block direct client writes to access audit.
- Firestore rules test active Office member workspace discovery through `office_members` collection group lookup.

### Current Boundary

Email delivery is still manual/provider-neutral. The Team screen copies the invite link, and the acceptance function makes the invite real. Automated email delivery should be a separate phase.

## Next Build Boundary

The next phase should add the stronger Office administration polish:

- branded invitation email draft/provider adapter,
- invite resend,
- invite expiry handling,
- pending member acceptance state,
- acceptance audit visibility in Team,
- role-control guards across high-risk web actions.

Recommended next keyword:

`EXECUTE OFFICE PHASE 8: Invitation Email Delivery + Expiry Controls`

## Phase 8 Invitation Email Delivery And Expiry Controls

Office invitations now include delivery and expiry behavior.

### Expiry

New Team invitations expire after 14 days by default.

The acceptance function rejects expired invitations and marks them as expired. The Team screen also shows an expired display state when a pending invite has passed its expiry time.

### Email Delivery

The trusted Cloud Function is:

`sendOfficeInvitationEmail`

It verifies:

- the caller is signed in,
- the caller is the workspace owner or an active Office admin,
- the workspace exists,
- the invitation exists,
- the invitation is still pending,
- the invitation is not expired.

It sends a branded Office invitation email when `RESEND_API_KEY` is configured.

If email delivery is not connected yet, the function does not fail the invitation. It records:

- `delivery_status: pending_provider_connection`
- `email_provider_status: pending_connection`
- `invite_url`
- `resend_count`
- `updated_at`

This keeps Office invitation delivery provider-ready without pretending an email was sent.

### Team Screen Controls

Pending invitations now show:

- send email,
- resend email,
- copy link,
- revoke.

The row also shows delivery state:

- email sent,
- email ready but provider not connected,
- email failed,
- expiry date.

### Data Added To Invitations

Server delivery may add:

- `delivery_status`
- `email_provider_status`
- `provider_message_id`
- `sent_at`
- `failure_reason`
- `resend_count`
- `last_resend_at`
- `invite_url`

### Current Boundary

Invitation email delivery is server-ready and Resend-ready. Actual email sending requires `RESEND_API_KEY` and an approved sender such as:

`ORBIT_LEDGER_OFFICE_FROM_EMAIL`

No email provider secret is exposed to the browser.

## Next Build Boundary

The next phase should harden Office roles across the rest of the app:

- disable high-risk web actions by Office role,
- add role-aware route guards for sensitive screens,
- show clear locked states for viewer/accountant/staff boundaries,
- keep owner-only billing and ownership actions protected.

Recommended next keyword:

`EXECUTE OFFICE PHASE 9: Role-Aware App Guards + Sensitive Action Locks`

## Phase 12: Member Activity Presence

Office members now refresh their own activity timestamp while using the web workspace.

### What Is Tracked

Each active member can update:

- `last_seen_at`
- `updated_at`

The web app refreshes this value on session load, browser focus, and visible activity at a throttled interval.

### What Members Cannot Change Through Presence

Presence updates cannot change:

- role,
- status,
- email,
- display name,
- invitation fields,
- another member's record.

Firestore rules only allow an active signed-in member to update their own presence fields.

### Team Screen Visibility

The Team screen now shows a `Last active` column with:

- `Active recently`
- `Seen before`
- `Not seen yet`
- `Access inactive`

This helps Office owners and admins see whether team access is actually being used without exposing any extra private data.

Recommended next keyword:

`EXECUTE OFFICE PHASE 13: Office Seat Limits + Invitation Capacity Guards`

## Phase 13: Office Seat Limits And Invitation Capacity

Office now has a shared capacity model for team seats.

### Included Capacity

The launch Office capacity is:

- `5` included Office seats.

Seats counted:

- active members,
- suspended members,
- pending invitations.

Seats not counted:

- removed members,
- accepted/revoked/expired/declined invitations.

Suspended members still count because they can be restored later. This avoids accidentally inviting beyond the included Office capacity.

### Invitation Guard

Before creating a new invitation, the Team screen now checks:

- whether seats are full,
- whether the email already belongs to a non-removed Office member,
- whether the email already has a pending invitation.

When an invite is blocked, the user sees a clear message and the invite button is disabled.

### Team Visibility

The Team screen now shows:

- `Office seats` metric,
- `X of 5 seats used`,
- seat availability message in the Invite teammate section.

### Shared Logic

The capacity rules live in the shared core package so web, mobile, and future trusted server flows use the same counting model.

### Current Boundary

The browser now prevents normal over-capacity invitation creation. A future trusted invitation-creation function should enforce the same shared capacity logic server-side before public Office rollout with paid team capacity add-ons.

Recommended next keyword:

`EXECUTE OFFICE PHASE 14: Trusted Invitation Creation Function + Server Capacity Enforcement`

## Phase 14: Trusted Invitation Creation

Office invitation creation now runs through a trusted Cloud Function instead of direct browser writes.

### Trusted Function

The web app calls:

`createOfficeInvitation`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the caller is the workspace owner or an active Office admin,
- owners can invite any non-owner Office role,
- admins can invite manager, staff, accountant, and viewer only,
- the invite email is valid,
- the email is not already a non-removed Office member,
- the email does not already have a pending invitation,
- Office seat capacity is still available.

### Server Capacity Enforcement

The server applies the same launch seat model:

- `5` included seats,
- active members count,
- suspended members count,
- pending invitations count,
- removed members do not count,
- completed/expired/revoked/declined invitations do not count.

This prevents someone from bypassing the browser UI with developer tools.

### Firestore Rules Boundary

Client-side creation of `office_invitations` is now blocked.

The browser can still:

- read invitations when allowed,
- request the trusted function to create invitations,
- use existing controlled invitation actions such as delivery/revoke where allowed.

### Audit Trail

The function writes an `office_access_audit` event for invitation creation:

- `action: member_invited`
- actor uid,
- actor role,
- target email,
- invited role,
- created timestamp.

### Current Boundary

Invitation creation is now server-controlled. The next Office phase should move invitation revoke/resend-sensitive actions fully behind trusted functions and add richer admin/member notification history.

Recommended next keyword:

`EXECUTE OFFICE PHASE 15: Trusted Invitation Revocation + Delivery Action Audit`

## Phase 15: Trusted Revocation And Delivery Audit

Office invitation revocation now uses a trusted Cloud Function instead of direct browser updates.

### Trusted Revocation Function

The web app calls:

`revokeOfficeInvitation`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the invitation exists,
- the invitation is still pending,
- the caller is the workspace owner or an active Office admin,
- admins cannot revoke admin invitations.

The function writes:

- `status: revoked`,
- `revoked_by`,
- `revoked_at`,
- `updated_at`,
- an `office_access_audit` record with `action: invitation_revoked`.

### Trusted Delivery Audit

Invitation email delivery already used:

`sendOfficeInvitationEmail`

This phase adds audit writes for delivery attempts.

Each send/resend attempt writes an `office_access_audit` record with:

- `action: invitation_email_sent`,
- actor uid,
- actor role,
- target email,
- invited role,
- delivery result.

Delivery audit messages distinguish:

- email sent,
- provider not connected yet,
- delivery failed,
- queued.

### Firestore Rules Boundary

Client-side `office_invitations` writes are now fully blocked:

- no direct create,
- no direct update,
- no direct delete.

Invitation creation, revocation, acceptance, and delivery updates must go through trusted functions.

### Admin Role Boundary

Office admins remain below owner/admin-level authority:

- admins can act on manager, staff, accountant, and viewer invitations,
- admins cannot create, revoke, or send admin invitations.

Recommended next keyword:

`EXECUTE OFFICE PHASE 16: Trusted Member Role And Status Actions`

## Phase 16: Trusted Member Role And Status Actions

Office member role and access status changes now use a trusted Cloud Function instead of direct browser writes.

### Trusted Member Access Function

The web app calls:

`updateOfficeMemberAccess`

The function supports:

- `change_role`
- `suspend`
- `restore`
- `remove`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the target member exists,
- the caller is the workspace owner or an active Office admin,
- the caller is not changing their own access,
- the workspace owner cannot be changed from this flow,
- admins cannot change admin members,
- admins cannot assign the admin role,
- removed members cannot be changed again.

### Status Rules

- `suspend` pauses an active or invited non-owner member.
- `restore` only restores suspended members.
- `remove` marks a non-owner member as removed.
- direct permanent delete stays blocked.

### Role Rules

- owners can assign admin, manager, staff, accountant, or viewer to non-owner members.
- admins can assign manager, staff, accountant, or viewer to lower-role members.
- admins cannot create or assign another admin.

### Audit Writes

Every trusted member access action writes an `office_access_audit` record:

- `member_role_changed`
- `member_suspended`
- `member_restored`
- `member_removed`

The audit record stores:

- actor uid,
- actor role,
- target uid,
- target email when available,
- previous and next role,
- previous and next status,
- created date.

### Firestore Rules Boundary

Client-side `office_members` updates are now limited to active members refreshing their own presence fields:

- `last_seen_at`
- `updated_at`

Role and status changes must go through the trusted function.

Recommended next keyword:

`EXECUTE OFFICE PHASE 17: Ownership Transfer Request + Approval Flow`

## Phase 17: Ownership Transfer Request And Approval Flow

Ownership transfer is now a two-person trusted flow.

### Trusted Request Function

The web app calls:

`requestOfficeOwnershipTransfer`

The function verifies:

- the caller is signed in,
- the caller is the current workspace owner,
- the receiving member exists,
- the receiving member is active,
- the owner is not transferring to themselves,
- no other ownership transfer is already pending.

The function writes a server-controlled record:

`workspaces/{workspaceId}/office_ownership_transfers/{transferId}`

with:

- status,
- requested by,
- receiving member uid/email/name,
- request date,
- expiry date,
- approval/cancellation fields.

It also writes an `office_access_audit` event:

`ownership_transfer_requested`

### Trusted Approval Function

The web app calls:

`resolveOfficeOwnershipTransfer`

Supported actions:

- `approve`
- `cancel`

Approval rules:

- only the receiving member can approve,
- transfer must still be pending,
- transfer must not be expired,
- receiving member must still be active.

When approved, the function:

- updates workspace `owner_uid`,
- changes the receiving member role to `owner`,
- moves the previous owner to `admin`,
- marks the transfer as approved,
- writes an `ownership_transferred` audit event.

Cancellation rules:

- the current owner can cancel,
- the receiving member can cancel,
- cancellation writes an `ownership_transfer_cancelled` audit event.

### Firestore Rules Boundary

Client-side writes to `office_ownership_transfers` are blocked.

Client-side workspace ownership changes are already blocked because workspace updates must keep the existing `owner_uid`.

### Team UI

The Team screen now includes an Ownership transfer section:

- owners can request transfer to an active non-owner member,
- receiving member can approve,
- owner or receiving member can cancel,
- transfer history appears alongside status and dates.

Recommended next keyword:

`EXECUTE OFFICE PHASE 18: Ownership Transfer Notifications + Expiry Handling`

## Phase 18: Ownership Transfer Notifications And Expiry Handling

Ownership transfers now have notification and expiry safety.

### Notification-Ready Transfer Records

Ownership transfer records now track approval email state:

- notification status,
- provider status,
- provider message id,
- sent date,
- failure reason,
- resend count,
- last resend date.

User-facing screens show calm language:

- `Approval email sent`
- `Approval email ready`
- `Approval email needs attention`
- `Approval email queued`

Provider wording stays internal.

### Approval Email Delivery

When an owner requests transfer, the trusted function attempts to send an approval email to the receiving member.

If email delivery is not connected yet:

- the transfer request still succeeds,
- the record is marked as ready for delivery,
- the Team screen shows the approval email state.

This prevents email setup from blocking the ownership safety flow.

### Expiry Handling

Ownership transfers expire after seven days.

Expiry is handled in two ways:

1. When a user tries to act on an expired transfer, the trusted function marks it expired and writes an audit event.
2. A scheduled function periodically marks stale pending transfer requests as expired.

Expired transfers cannot be approved. The owner must create a new request.

### Audit Events

Phase 18 adds:

- `ownership_transfer_expired`
- `ownership_transfer_notification_sent`

This means the access timeline can explain:

- when the transfer was requested,
- whether the approval email was prepared or sent,
- whether the transfer expired,
- whether it was approved or cancelled.

Recommended next keyword:

`EXECUTE OFFICE PHASE 19: Ownership Transfer Resend + Reminder Controls`

## Phase 19: Ownership Transfer Resend And Reminder Controls

Ownership transfer approval emails can now be resent from a trusted server action.

### Trusted Reminder Function

The web app calls:

`resendOfficeOwnershipTransferNotification`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the ownership transfer exists,
- the transfer is still pending,
- the transfer is not expired,
- the caller is either the current owner or the receiving member.

If the transfer has expired, the function marks it expired and writes an audit event.

### Reminder Delivery

The reminder uses the same provider-ready email path as the original transfer request.

If the real email provider secret is not connected yet:

- the reminder action still completes safely,
- the transfer record stays marked as ready for email delivery,
- no provider wording is shown to the user.

When the real email provider secret is added, the same function will send real email without changing the user flow.

### Transfer Record Updates

Each reminder updates:

- notification status,
- provider status,
- provider message id,
- sent date,
- failure reason,
- resend count,
- last resend date.

### Audit Events

Each reminder writes:

`ownership_transfer_notification_sent`

The audit reason clarifies whether the approval reminder was sent, ready for delivery, or failed.

### Team UI

Pending ownership transfers now show:

- approval status,
- notification state,
- sent/ready/failure detail,
- `Send reminder` action.

Only the owner or receiving member can send the reminder.

Recommended next keyword:

`EXECUTE OFFICE PHASE 20: Office Admin Impersonation-Proof Support Review`

## Phase 20: Office Admin Impersonation-Proof Support Review

Orbit Ledger internal support review is intentionally separate from customer Office membership.

### Core Rule

Internal support can record why a workspace was reviewed, but cannot impersonate a customer or start a member session.

Support review:

- does not create a workspace member,
- does not change roles,
- does not grant Office access,
- does not transfer ownership,
- does not update invoices, payments, settings, backups, or billing,
- does not expose secrets,
- does not bypass customer consent for diagnostics.

### Trusted Server Action

The web app calls:

`recordOfficeSupportReview`

The function verifies:

- the caller is signed in,
- the caller email is on the internal admin allowlist,
- the workspace exists,
- a review reason was provided.

It writes a server-controlled `office_access_audit` record with:

- internal actor uid,
- internal actor email,
- internal support role,
- support case id when provided,
- whether customer-approved diagnostic context exists,
- `impersonation_allowed: false`,
- clear reason text that says no member session was started.

### Hidden Admin UI

The hidden Office operations page now includes a support review guard.

It asks for:

- optional support case,
- review reason,
- whether customer-approved diagnostic context exists.

The UI shows guardrails clearly before recording the review.

### Audit Visibility

The support review is written into the workspace Office audit log so owners and allowed Office reviewers can see that internal support reviewed the workspace.

Recommended next keyword:

`EXECUTE OFFICE PHASE 21: Support Consent Intake + Diagnostic Review Pack`

## Phase 21: Support Consent Intake + Diagnostic Review Pack

Customer-approved support review now has a dedicated intake path.

### Customer Consent Intake

The Support page lets a user:

- write a support message,
- review the redacted message,
- include a safe diagnostic summary,
- confirm that the summary was reviewed,
- approve Orbit Ledger support to review that safe diagnostic pack.

This approval is separate from sending an email. It creates a consent record that support can reference.

### Diagnostic Review Pack

The diagnostic pack stores only:

- safe app context,
- route without private query data,
- platform/browser context,
- record counts,
- redacted field labels,
- private-data warning labels,
- sanitized user message.

It does not store:

- customer records,
- invoice bodies,
- payment proof,
- backup contents,
- private keys,
- raw URLs with identifiers,
- raw error text that may include private data.

### Server-Controlled Consent

The web app calls:

`createSupportDiagnosticConsent`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the caller is the workspace owner or active Office admin,
- a reviewed support message and diagnostic summary are provided.

It writes:

- `support_diagnostic_consents`,
- a matching `office_access_audit` event.

Client apps cannot directly write support consent documents.

### Admin Review Surface

The hidden Office operations page now shows customer-approved diagnostic packs:

- support case,
- support kind,
- approving user email,
- expiration,
- approved safe field count,
- redacted field count,
- sanitized message.

This gives support context without impersonation.

### Expiry

Support diagnostic consent expires after seven days by default.

Recommended next keyword:

`EXECUTE OFFICE PHASE 22: Support Consent Revocation + Expiry Cleanup`

## Phase 22: Support Consent Revocation + Expiry Cleanup

Support diagnostic consent is now reversible and time-bound.

### User Revocation

After approving a diagnostic review pack, the Support page shows:

- the saved approval,
- the expiry date,
- `Revoke approval`.

Revocation calls the trusted server function:

`revokeSupportDiagnosticConsent`

The function verifies:

- the caller is signed in,
- the workspace exists,
- the consent exists,
- the caller is the workspace owner, active Office admin, or the user who created the approval.

If valid, it marks the consent:

`revoked`

and writes an Office access audit entry.

### Expiry Cleanup

Support diagnostic consent expires after seven days.

A scheduled function:

`expireSupportDiagnosticConsents`

runs every six hours and marks active consent records as:

`expired`

when their expiry date has passed.

Each expiry also writes an audit entry.

### Admin Visibility

The hidden Office operations page now distinguishes:

- active consent,
- expired consent,
- revoked consent,
- consent that is no longer active for support.

Support can see the record, but stale consent is clearly not usable for support review.

### Client Rules

Client apps cannot create, update, or delete support consent records directly.

All consent creation, revocation, and expiry changes are trusted server actions.

Recommended next keyword:

`EXECUTE OFFICE PHASE 23: Diagnostic Consent Audit Timeline + Support Case Linking`

## Phase 23: Diagnostic Consent Audit Timeline + Support Case Linking

Diagnostic support consent is now connected back to the Office audit trail.

### Support Case Linking

Support review and diagnostic consent audit records can carry:

- support case ID,
- support consent ID,
- customer diagnostic approval flag,
- impersonation guard flag,
- previous and next consent status.

This lets the app link approval, support review, revocation, and expiry events to the same case.

### Team Timeline

The Office team access timeline now treats support events as first-class timeline items:

- `Support review approved`,
- `Support review recorded`,
- `Support approval revoked`,
- `Support approval expired`.

Each support event shows the related case and consent IDs when available.

### Hidden Operations View

The hidden Office operations page now shows linked audit events inside each diagnostic review pack.

Support reviewers can see:

- when consent was approved,
- when support review was recorded,
- when consent was revoked or expired,
- which support case the event belongs to,
- which consent record the event belongs to.

This keeps support review traceable without impersonating the customer or exposing raw private data.

Recommended next keyword:

`EXECUTE OFFICE PHASE 24: Support Case Admin Notes + Resolution Workflow`

## Phase 24: Support Case Admin Notes + Resolution Workflow

Support cases now have a server-controlled resolution record.

### Case Record

Each support case can track:

- support case ID,
- current case status,
- latest internal action,
- latest internal note,
- note count,
- latest note author,
- resolved time,
- reopened time.

Supported internal actions:

- add internal note,
- mark resolved,
- reopen case.

### Trusted Updates

The web app calls the trusted function:

`recordSupportCaseAdminAction`

The function verifies:

- the caller is signed in,
- the caller is an Orbit Ledger internal admin,
- the workspace exists,
- a support case and note were provided.

Client apps cannot directly create, edit, or delete support case records.

### Audit Trail

Every support case note, resolution, and reopen action writes an Office audit event with:

- support case ID,
- previous case status,
- next case status,
- internal support actor,
- note summary,
- impersonation blocked.

These events appear in:

- the hidden Office operations support case view,
- the Office access event timeline.

### Hidden Operations View

Office operations now includes a support case resolution section:

- add note,
- resolve case,
- reopen case,
- view current case status,
- view latest note,
- jump from a case to the next update action.

This gives Orbit Ledger support a proper case workflow without touching customer data or opening a customer session.

Recommended next keyword:

`EXECUTE OFFICE PHASE 25: Support Case Customer-Facing Status + Safe Follow-Up`

## Phase 25: Support Case Customer-Facing Status + Safe Follow-Up

Support now has a customer-facing case status view.

### Customer Status View

The Support page shows safe case status without exposing internal notes:

- in review,
- waiting for your reply,
- reopened,
- resolved.

Each case gives a simple follow-up instruction and lets the user reuse the case number in a new support request.

### Privacy Boundary

Customer-facing support status does not show:

- internal support notes,
- internal actor IDs,
- diagnostic field details beyond user-approved summaries,
- raw audit records.

### Safe Follow-Up

The user sees clear next action copy:

- keep the case number,
- reply with the case number,
- reopen by sending another request if needed.

Recommended next keyword:

`EXECUTE OFFICE PHASE 26: Support Case Email Readiness + Resend Adapter Boundary`

## Phase 26: Support Case Email Readiness + Resend Adapter Boundary

Support follow-up email is now provider-ready without sending real email yet.

### Trusted Email Request

The hidden Office operations page can prepare a support case follow-up email with:

- support case,
- recipient email,
- subject,
- safe message body.

The trusted function:

`queueSupportCaseFollowUpEmail`

verifies:

- internal admin identity,
- workspace existence,
- support case ID,
- valid recipient email,
- subject and body.

### Provider Boundary

Prepared support emails are stored as:

`pending_provider_connection`

This keeps the workflow ready for Resend while preventing accidental customer emails before the real provider is connected.

### Server-Controlled Storage

Support email requests live in:

`support_case_email_requests`

Client apps can read status, but cannot create, update, or delete records directly.

### Audit Trail

Every prepared support follow-up email writes an Office audit event linked to the support case.

Recommended next keyword:

`EXECUTE OFFICE PHASE 27: Office Admin Review Dashboard Polish + Filters`

## Phase 27: Office Admin Review Dashboard Polish + Filters

The hidden Office operations dashboard now has local review filters.

### Filters

Internal reviewers can filter by:

- search text,
- Office access request status,
- support case status.

The filter view is local only. It does not change server data.

### Review Queue Polish

The Office access queue now shows:

- number of visible requests,
- clearer empty state copy,
- trusted action wording.

### Support Case Polish

The support case section now shows:

- number of visible cases,
- active/resolved/reopened filtering,
- cleaner action path for note, email, resolve, and reopen.

Recommended next keyword:

`EXECUTE OFFICE PHASE 28: Office Security QA + Rules Abuse Tests`

## Phase 28: Office Security QA + Rules Abuse Tests

Office support rules now have broader abuse coverage.

### Added Rules Coverage

The emulator test suite now verifies:

- clients cannot write Office audit records,
- clients cannot write Office access requests,
- clients cannot write Office admin queue records,
- clients cannot write diagnostic consent records,
- clients cannot write support case records,
- clients cannot write support email request records.

### Read Boundary Coverage

The tests now verify sensitive Office/support reads:

- owner can read internal admin queue,
- Office admin cannot read the owner-only admin queue,
- Office admin can read Office access requests,
- accountant can read audit/support review records,
- accountant cannot read Office access requests,
- staff cannot read audit/support review records.

### Result

Support cases, consent, support email requests, and audit events remain server-controlled.

Recommended next keyword:

`EXECUTE OFFICE PHASE 29: Office Production Deployment Checklist + Secrets Readiness`

## Phase 29: Office Production Deployment Checklist + Secrets Readiness

The hidden Office operations dashboard now includes a production readiness checklist.

### Checklist Coverage

The checklist covers:

- trusted Office functions deployed,
- Firestore rules deployed,
- internal admin allowlist configured,
- `RESEND_API_KEY` stored in Firebase Secret Manager,
- support email domain verified,
- production App Check reviewed.

### Secret Safety

The checklist names required secrets but never displays secret values.

This is intentional. Secrets must stay in the provider or Firebase Secret Manager, not in web code, docs, logs, screenshots, or browser output.

### Launch Use

Before accepting Office users, use this checklist to confirm:

- functions and rules are deployed together,
- Office support workflows are not partially deployed,
- support email queue remains provider-pending until Resend is connected,
- internal review access is restricted.

Recommended next keyword:

`EXECUTE OFFICE PHASE 30: Office Final Launch QA + Freeze`

## Phase 30: Office Final Launch QA + Freeze

Office feature buildout is now frozen for controlled invite readiness.

### Included In Freeze

The Office launch scope now includes:

- Office access model,
- role-aware team controls,
- invitation delivery readiness,
- ownership transfer flow,
- support consent intake,
- support consent revocation and expiry,
- diagnostic consent timeline,
- support case admin notes,
- support case resolution/reopen flow,
- support email queue readiness,
- security rules coverage,
- production readiness checklist.

### Still Provider-Pending

The following are intentionally not live yet:

- real support email delivery,
- real Resend send execution,
- live purchase payment provider capture,
- live Office payment enforcement.

These should be wired only when production credentials and domain verification are ready.

### Freeze Rule

After this phase, Office should accept:

- bug fixes,
- copy polish,
- QA fixes,
- deployment checklist updates,
- real provider wiring.

Office should not accept new feature expansion until the controlled invite launch has been tested with real users.

Recommended next action:

Commit, push, deploy rules/functions/web when the owner is ready for a launch candidate.
