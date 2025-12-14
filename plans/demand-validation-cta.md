# Demand Validation CTA Plan

## Goal

Validate user interest in a GIF sharing/hosting platform (ytgify.com) before investing in full deployment. Measure demand from existing extension users via a CTA on the success screen that links to a landing page with email capture.

## Background

- Extension has thousands of weekly active users
- Future monetization: community site for hosting, sharing, liking, remixing GIFs
- Site features are built but not productionized
- Need signal on whether enough users would use such a platform to justify deployment

## Approach

Add a CTA button to the GIF creation success screen that:
1. Teases upcoming sharing features
2. Links to ytgify.com with UTM tracking
3. Landing page captures emails via Google Forms (or similar)

## Measurement

**Primary metrics:**
- Landing page visits from UTM source (via site analytics)
- Email signups (via Google Forms responses)

**Funnel:**
```
GIF Created → CTA Clicked → Landing Page Visit → Email Signup
```

**Success threshold (suggested):**
- >5% of GIF creators click the CTA = moderate interest
- >10% click = strong interest
- >2% of clickers sign up = validated demand

---

## Implementation Plan

### Phase 1: Landing Page Setup (No code changes)

1. **Add analytics to ytgify.com** (if not present)
   - Google Analytics, Plausible, or similar
   - Ensure UTM parameters are tracked

2. **Create email capture section on ytgify.com**
   - Embed Google Form or use simple form service
   - Copy: "Be the first to know when GIF sharing launches"
   - Fields: Email only (minimize friction)

3. **Add teaser content to landing page**
   - Brief description of planned features:
     - Host your GIFs with shareable links
     - Share directly to Discord, Slack, social media
     - Browse and remix community GIFs
     - Like and save favorites
   - Optional: mockup/wireframe of the sharing experience

### Phase 2: Extension Changes

**File: `src/content/overlay-wizard/screens/SuccessScreen.tsx`**

Add a CTA button in the success screen bottom actions section:

```tsx
// Button text options (pick one):
// - "Share This GIF"
// - "Get a Shareable Link"
// - "Share with Friends"

// Subtext options:
// - "Coming soon - join the waitlist"
// - "Host & share your GIFs (coming soon)"
```

**File: `src/constants/links.ts`**

Add helper function:
```tsx
export function getWaitlistLink(): string {
  return 'https://ytgify.com?utm_source=extension&utm_medium=success_screen&utm_campaign=waitlist';
}
```

**UI placement:**
- Add alongside existing "Join Discord" button in bottom actions
- Use consistent styling (secondary button)
- Include upload/share icon

**No local tracking needed** - UTM params + landing page analytics provide all necessary data.

### Phase 3: Release & Monitor

1. Build production extension
2. Submit to Chrome Web Store
3. Monitor for 2-4 weeks:
   - Landing page visits from extension UTM
   - Email signup count
   - Calculate conversion rates

---

## Copy Options

### Button text
| Option | Pros | Cons |
|--------|------|------|
| "Share This GIF" | Direct, action-oriented | Implies immediate sharing |
| "Get a Shareable Link" | Clear value prop | Slightly longer |
| "Share with Friends" | Social framing | Generic |

**Recommendation:** "Share This GIF" with subtext "Get a shareable link (coming soon)"

### Landing page copy

**Headline:** "Share Your GIFs Instantly"

**Subhead:** "We're building a home for your YouTube GIFs. Host, share, and discover."

**Features to highlight:**
- One-click shareable links
- Works in Discord, Slack, Twitter, anywhere
- Browse community creations
- Remix and build on others' GIFs

**CTA:** "Join the Waitlist" → Google Form embed

---

## Technical Notes

- No backend changes required
- No new dependencies
- No local storage tracking (not aggregatable)
- UTM parameters: `utm_source=extension`, `utm_medium=success_screen`, `utm_campaign=waitlist`

---

## Decision Framework

Based on validation results after 2-4 weeks:

| CTA Click Rate | Email Signup Rate | Interpretation | Action |
|----------------|-------------------|----------------|--------|
| <2% | - | Low interest | Don't deploy; revisit value prop |
| 2-5% | <1% | Mild curiosity | Test different CTA copy; don't deploy yet |
| 2-5% | >2% | Interest exists | Consider limited beta deployment |
| 5-10% | >2% | Strong signal | Deploy platform, prioritize core sharing features |
| >10% | >3% | High demand | Deploy quickly, plan additional features |

**Minimum viable signal to proceed:** 5% click rate AND 20+ email signups

---

## Email Capture Recommendations

**For validation phase: Google Forms is sufficient.**

Pros:
- Zero setup time
- Free
- Responses auto-collect to spreadsheet
- Reliable, no maintenance

Cons (acceptable for validation):
- Generic appearance
- No automated confirmation email
- Manual export needed if migrating later

**If validation succeeds:** Migrate collected emails to Mailchimp, Buttondown, or similar to communicate with waitlist about launch.

**Form fields:** Email only. Every additional field reduces conversions. Name, use case, etc. can be collected later.

---

## Open Questions

1. What's the current analytics setup on ytgify.com?
2. Preferred email capture method? (Google Forms is simplest)
3. Any existing waitlist or email list to integrate with?
4. Target timeline for running this experiment?
5. What conversion rate would justify deploying the sharing platform?

---

## Next Steps

1. [ ] Set up analytics on ytgify.com (if needed)
2. [ ] Add email capture form to landing page
3. [ ] Add teaser content about sharing features
4. [ ] Implement CTA button in extension success screen
5. [ ] Test locally
6. [ ] Release to Chrome Web Store
7. [ ] Monitor for 2-4 weeks
8. [ ] Evaluate results and decide on platform deployment
