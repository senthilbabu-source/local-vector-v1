You are absolutely spot on with your reasoning. Building Realtime before you have a multi-tenant structure to apply it to is like wiring a house for smart switches before pouring the foundation. Your sequence (Foundation → Customization → Live Collaboration) is exactly the right path.

Looking specifically at your first phase—Multi-User Agency Accounts—your feature list is excellent, but from a technical and implementation standpoint, there are a few critical architectural steps and edge cases missing.

Here is what you need to add to your sequence to make the Agency implementation bulletproof, especially since you are using Supabase and Stripe.

Phase 0: The Multi-Tenant Database Foundation

Before building roles and invitations, you must design the data isolation strategy. Since you are using Supabase, this relies entirely on Postgres Row Level Security (RLS).

Tenant ID Injection: Every core table in your database needs an agency_id (or tenant_id).

Row Level Security (RLS) Policies: You need to write strict RLS policies ensuring that a user can only Read/Insert/Update/Delete rows where the agency_id matches their verified session claim or a junction table mapping (user_agency_roles).

Custom JWT Claims: To make RLS performant, you'll want to inject the user's agency_id and role directly into the Supabase Auth JWT so you don't have to do complex table joins on every single database query.

Additions to Phase 1: Core Agency Workflows

Your list covers the what, but you need to account for the how in these specific workflows:

1. The "Zero-to-One" Onboarding Flow

Creation vs. Joining: The system needs to distinguish between a new user signing up to create a new agency, versus a user signing up because they clicked an invite link to join an existing one.

Default State: When a new user signs up independently, the system must automatically generate an Agency record, assign them the "Owner" role, and route them to Stripe to start their base subscription.

2. Invitation Mechanics & State Management

Pending Invites Table: You need a separate database table for pending_invitations (email, agency_id, role, token, expiration).

Existing vs. New Users: If you invite bob@email.com, does Bob already have a Supabase auth account on your platform for a different agency? Your flow needs to handle attaching existing accounts to new agencies vs. forcing a fresh sign-up.

3. Seat-Based Billing Complexities (Stripe)

Webhook Synchronization: You cannot rely entirely on the frontend to update seat counts. You must implement robust backend endpoints to listen for Stripe webhooks (customer.subscription.updated, invoice.payment_succeeded) to update the "active seats" in your database.

Proration Logic: When an Admin invites a 6th user to a 5-seat plan mid-month, your app needs to seamlessly trigger a Stripe API call to increase the quantity of the subscription item, which charges prorated amounts.

Graceful Degradation: What happens if a payment fails, or the agency owner downgrades from 10 seats to 5, but they still have 10 users active? You need a "lockout" UI that forces the owner to deactivate 5 users before the dashboard unlocks.

4. Data Lifecycle & Ownership

Soft Deletes: You rarely want to hard-delete users in a B2B SaaS because it breaks your Activity Audit Log (e.g., "Who deleted that location? Oh, the user doesn't exist anymore"). Implement a status column (active/suspended/removed) instead of deleting rows.

Ownership Transfer: An agency owner might leave the company. You need a specific, high-friction workflow allowing the current Owner to transfer the "Owner" role to another Admin before they leave.

The Refined Sequence

If we inject these missing pieces, your roadmap looks like this:

Phase 0: Supabase Schema Design, RLS Policies, and JWT custom claims.

Phase 1A: The "Zero-to-One" Agency creation flow and Stripe base-plan checkout.

Phase 1B: Team Invitation architecture (Pending invites, Magic links, cross-agency users).

Phase 1C: Seat-based Stripe webhooks, proration handling, and downgrade lockouts.

Phase 1D: Granular permissions (Locations), Soft-deletes, and Activity Audit Logging.

Phase 2: White-Label Engine (Domains, branding, emails).

Phase 3: Supabase Realtime (Co-editing, presence, live toasts).