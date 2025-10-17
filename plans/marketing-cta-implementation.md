# Marketing CTA Implementation Plan

## Overview

Implement non-intrusive, privacy-respecting call-to-action prompts to encourage organic growth through Chrome Web Store reviews, social sharing, GitHub engagement, and word-of-mouth referrals.

**See ASCII mockups:** [marketing-cta-mockups.md](./marketing-cta-mockups.md)

## Strategy

### Core Principles
- **Non-intrusive:** All CTAs dismissible, no modals blocking workflow
- **Conservative timing:** Only after deep engagement (10+ GIFs, 14+ days)
- **Limited frequency:** Max 2 lifetime prompts per user
- **Privacy-first:** All tracking local, no external analytics
- **Multi-channel:** Support Web Store reviews, social sharing, GitHub stars, word-of-mouth

### Qualification Criteria

**Primary Prompt (First Ask):**
- User has created 10+ GIFs
- AND 14+ days since installation
- AND has not dismissed primary prompt before

**Secondary Prompt (Second Ask):**
- User has created 20+ GIFs
- AND previously dismissed primary prompt
- AND has not dismissed secondary prompt before

### CTA Locations

1. **Success Screen** - Permanent "Spread the word" link (mockup: Section 1)
2. **Milestone Celebrations** - At 10, 25, 50 GIFs (mockup: Section 2)
3. **Popup Footer** - Subtle text links at bottom (mockup: Section 3)
4. **Feedback Screen** - Enhanced "Show Your Support" section (mockup: Section 4)

## Technical Architecture

### 1. Engagement Tracking System

**File:** `src/shared/engagement-tracker.ts` (NEW)

**Responsibilities:**
- Track installation date
- Track total GIFs created
- Track CTA prompt history (primary/secondary shown, dismissed)
- Determine if user qualifies for prompts
- Record user actions (show, dismiss, click)

**Data Structure:**
```typescript
interface EngagementData {
  installDate: number; // timestamp
  totalGifsCreated: number;
  prompts: {
    primary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
    secondary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
  };
  milestones: {
    milestone10: boolean; // shown
    milestone25: boolean;
    milestone50: boolean;
  };
  popupFooterDismissed: boolean;
}
```

**Storage:** `chrome.storage.local` (key: `engagement-data`)

**Key Methods:**
```typescript
// Initialize tracking (call on extension install)
initializeEngagement(): Promise<void>

// Update GIF count (call on GIF creation)
incrementGifCount(): Promise<void>

// Check if user qualifies for prompt
shouldShowPrompt(type: 'primary' | 'secondary'): Promise<boolean>

// Check if milestone should be shown
shouldShowMilestone(count: 10 | 25 | 50): Promise<boolean>

// Record prompt shown
recordPromptShown(type: 'primary' | 'secondary'): Promise<void>

// Record milestone shown
recordMilestoneShown(count: 10 | 25 | 50): Promise<void>

// Record dismissal
recordDismissal(type: 'primary' | 'secondary' | 'popup-footer'): Promise<void>

// Record action click
recordAction(type: 'primary' | 'secondary', action: 'rate' | 'share' | 'github'): Promise<void>

// Get current stats
getEngagementStats(): Promise<EngagementData>
```

**Integration Points:**
- Initialize on extension install (background/index.ts)
- Increment count in GIF processor after successful creation
- Query before showing any CTA component

---

### 2. Social Templates Utility

**File:** `src/utils/social-templates.ts` (NEW)

**Responsibilities:**
- Provide pre-written social media messages
- Generate share URLs (Twitter/X)
- Handle copy-to-clipboard functionality
- Track which template was used (optional)

**Templates:**
- Twitter/X: Short, Medium, Long variations (see mockups Section 6)
- Discord/Slack: Casual message
- Reddit: Formatted post
- Generic: Copy link only

**Key Functions:**
```typescript
// Get all Twitter variations
getTwitterTemplates(): Array<{ label: string; text: string }>

// Get Discord/Slack message
getDiscordTemplate(): string

// Get Reddit post
getRedditTemplate(): string

// Generate Twitter share URL
generateTwitterShareUrl(template: string): string

// Copy to clipboard with feedback
copyToClipboard(text: string): Promise<boolean>
```

**Links:**
- Chrome Web Store URL (placeholder until live, easy to update)
- GitHub repo URL
- Documentation URL

---

### 3. External Links Constants

**File:** `src/constants/links.ts` (NEW)

**Purpose:** Centralize all external URLs for easy updates

**Constants:**
```typescript
export const LINKS = {
  // Chrome Web Store
  WEBSTORE_LISTING: 'https://chrome.google.com/webstore/detail/[ID]', // Update when live
  WEBSTORE_REVIEWS: 'https://chrome.google.com/webstore/detail/[ID]/reviews',

  // GitHub
  GITHUB_REPO: 'https://github.com/neonwatty/ytgify',
  GITHUB_STARS: 'https://github.com/neonwatty/ytgify/stargazers',
  GITHUB_ISSUES: 'https://github.com/neonwatty/ytgify/issues',

  // Social
  TWITTER_PROFILE: 'https://x.com/neonwatty',

  // Documentation
  DOCS_USER_GUIDE: 'https://github.com/neonwatty/ytgify#user-guide',
} as const;

// Helper to open external link
export function openExternalLink(url: string): void {
  chrome.tabs.create({ url });
}
```

---

### 4. Success Screen Enhancement

**File:** `src/content/overlay-wizard/screens/SuccessScreen.tsx` (MODIFY)

**See mockup:** [Section 1](./marketing-cta-mockups.md#1-success-screen---permanent-share-link)

**Changes:**
1. Add permanent "Spread the word about YTGify" link next to "Give Feedback" button
2. Import social templates utility
3. Handle share click - opens Twitter with pre-filled tweet

**Component Structure:**
```typescript
import { getTwitterTemplates, generateTwitterShareUrl } from '@/utils/social-templates';
import { openExternalLink } from '@/constants/links';

// Handle share action
const handleShare = () => {
  const templates = getTwitterTemplates();
  const twitterUrl = generateTwitterShareUrl(templates[0].text); // Use short template
  openExternalLink(twitterUrl);
};

// In render - add to bottom actions
<div className="ytgif-success-bottom-actions">
  <button onClick={onFeedback} className="ytgif-button-secondary">
    Give Feedback
  </button>

  <button onClick={handleShare} className="ytgif-share-link">
    <ShareIcon />
    Spread the word about YTGify
  </button>
</div>
```

**Styling:**
- Both buttons at bottom of screen, side-by-side
- "Give Feedback" on left, "Spread the word" on right
- Share link has icon + text
- Secondary styling (less prominent than main Download button)
- No conditional rendering - always visible
- No engagement tracker dependency

---

### 5. Milestone Celebration Screen

**File:** `src/content/overlay-wizard/screens/MilestoneScreen.tsx` (NEW)

**See mockups:** [Section 2](./marketing-cta-mockups.md#2-milestone-celebration-screen)

**Purpose:** Replace Success Screen at exact milestone counts (10, 25, 50 GIFs)

**Props:**
```typescript
interface MilestoneScreenProps {
  milestoneCount: 10 | 25 | 50;
  onContinue: () => void;
  onRate?: () => void;
  onShare?: () => void;
  onGitHub?: () => void;
}
```

**Visual Elements:**
- Title varies by milestone:
  - 10: "Milestone!"
  - 25: "Amazing Work!"
  - 50: "Legendary Creator!"
- Message: "You've created X GIFs!"
- Same 3 action buttons
- "Continue" button to proceed to standard Success Screen

**Integration:**
- Check milestone eligibility in OverlayWizard after GIF creation
- Show MilestoneScreen instead of SuccessScreen when applicable
- Record milestone shown: `recordMilestoneShown(count)`
- After "Continue", show standard SuccessScreen

---

### 6. Popup Footer Enhancement

**File:** `src/popup/popup-modern.tsx` (MODIFY)

**See mockup:** [Section 3](./marketing-cta-mockups.md#3-popup-footer-enhancement)

**Changes:**
1. Check qualification and dismissal status on mount
2. Render footer conditionally at bottom of popup
3. Single line with text links
4. Small × dismiss button

**Footer Component:**
```typescript
// State
const [showFooter, setShowFooter] = useState(false);

// Check on mount
useEffect(() => {
  async function checkFooter() {
    const stats = await engagementTracker.getEngagementStats();
    const qualifies = await engagementTracker.shouldShowPrompt('primary');
    const dismissed = stats.popupFooterDismissed;
    setShowFooter(qualifies && !dismissed);
  }
  checkFooter();
}, []);

// Render footer
{showFooter && (
  <div className="popup-footer">
    Enjoying YTGify?{' '}
    <a onClick={handleRate}>Rate us</a> |{' '}
    <a onClick={handleShare}>Share</a> |{' '}
    <a onClick={handleGitHub}>⭐</a>
    <button className="dismiss-btn" onClick={handleDismiss}>×</button>
  </div>
)}
```

**Styling:**
- Border-top separator
- 11px font, muted color (#666)
- 32px height
- Links underline on hover
- Dismiss × in corner

---

### 7. Enhanced Feedback Screen

**File:** `src/content/overlay-wizard/screens/FeedbackScreen.tsx` (MODIFY)

**See mockup:** [Section 4](./marketing-cta-mockups.md#4-enhanced-feedback-screen)

**Changes:**
1. Add "Show Your Support" section between GitHub Issues and Follow sections
2. Two side-by-side buttons: "⭐ Rate YTGify" and "⭐ Star on GitHub"
3. No qualification check - always visible (user chose feedback)

**New Section:**
```tsx
<div className="ytgif-feedback-option">
  <h3>Show Your Support</h3>
  <p>Love YTGify? Help us grow:</p>
  <div className="ytgif-support-buttons">
    <button onClick={handleRate} className="ytgif-feedback-button">
      ⭐ Rate YTGify
      <span className="button-subtitle">Chrome Web Store</span>
    </button>
    <button onClick={handleGitHub} className="ytgif-feedback-button">
      ⭐ Star on GitHub
      <span className="button-subtitle">Show your support</span>
    </button>
  </div>
</div>
```

**Styling:**
- Match existing feedback option sections
- Two buttons in row (50% width each)
- Button subtitles in smaller, muted text
- Same hover states as existing buttons

---

### 8. Social Share Dialog

**File:** `src/content/overlay-wizard/components/ShareDialog.tsx` (NEW)

**See mockup:** [Section 5](./marketing-cta-mockups.md#5-social-share-dialog)

**Purpose:** Modal dialog for social sharing options

**Props:**
```typescript
interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Features:**
1. **Share on X/Twitter:**
   - Dropdown to select template (short/medium/long)
   - "Open X with Tweet" button → new tab with pre-filled tweet

2. **Copy Link:**
   - Display Chrome Web Store URL
   - "Copy to Clipboard" button with feedback

3. **Copy Message:**
   - Display generic message
   - "Copy Message" button with feedback

**Implementation:**
- Use portal for modal overlay
- Dimmed background (50% opacity black)
- Centered dialog
- ESC key to close
- Click outside to close
- Copy feedback: "✓ Copied!" for 1.5s

**State:**
```typescript
const [selectedTemplate, setSelectedTemplate] = useState('short');
const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
```

---

### 9. Wizard Integration

**File:** `src/content/overlay-wizard/OverlayWizard.tsx` (MODIFY)

**Changes:**
1. Import MilestoneScreen, ShareDialog
2. Add milestone detection logic
3. Route to MilestoneScreen or SuccessScreen based on GIF count
4. Pass engagement data to child screens

**Logic:**
```typescript
// After GIF creation success
const stats = await engagementTracker.getEngagementStats();
const gifCount = stats.totalGifsCreated;

// Check if milestone should be shown
if ([10, 25, 50].includes(gifCount)) {
  const shouldShow = await engagementTracker.shouldShowMilestone(gifCount as 10 | 25 | 50);
  if (shouldShow) {
    setCurrentScreen('milestone');
    setMilestoneCount(gifCount);
    return;
  }
}

// Otherwise show success screen
setCurrentScreen('success');
```

---

### 10. Styling Updates

**File:** `src/content/wizard-styles.css` (MODIFY)

**New Styles:**

```css
/* Success Screen Share Link */
.ytgif-success-bottom-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 16px;
}

.ytgif-share-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: none;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.ytgif-share-link:hover {
  color: #333;
  text-decoration: underline;
}

/* Milestone Screen */
.ytgif-milestone-screen {
  text-align: center;
}

.ytgif-milestone-title {
  font-size: 24px;
  font-weight: bold;
  margin: 20px 0;
}

.ytgif-milestone-count {
  font-size: 20px;
  margin: 20px 0;
}

/* Popup Footer */
.popup-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px 16px;
  font-size: 11px;
  color: #666;
  position: relative;
}

.popup-footer a {
  color: #666;
  cursor: pointer;
  text-decoration: none;
}

.popup-footer a:hover {
  text-decoration: underline;
}

.popup-footer .dismiss-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
}

/* Support Buttons (Feedback Screen) */
.ytgif-support-buttons {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.ytgif-feedback-button {
  flex: 1;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ytgif-feedback-button .button-subtitle {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}

/* Share Dialog */
.ytgif-share-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}

.ytgif-share-dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.ytgif-share-option {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
}

.ytgif-copy-feedback {
  color: #4caf50;
  font-weight: 500;
}
```

---

### 11. Type Definitions

**File:** `src/types/storage.ts` (MODIFY)

**Add:**
```typescript
export interface EngagementData {
  installDate: number;
  totalGifsCreated: number;
  prompts: {
    primary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
    secondary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
  };
  milestones: {
    milestone10: boolean;
    milestone25: boolean;
    milestone50: boolean;
  };
  popupFooterDismissed: boolean;
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Priority: HIGH)
**Files:**
- `src/shared/engagement-tracker.ts` (NEW)
- `src/utils/social-templates.ts` (NEW)
- `src/constants/links.ts` (NEW)
- `src/types/storage.ts` (MODIFY)

**Tasks:**
1. Create engagement tracker with chrome.storage.local
2. Initialize tracking on extension install (background/index.ts)
3. Integrate GIF count increment in GIF processor
4. Create social templates with all variations
5. Define external link constants
6. Write unit tests for tracker and templates

**Testing:**
- Verify storage initialization
- Test qualification logic with various states
- Test prompt history tracking
- Verify GIF count increments

---

### Phase 2: Success Screen & Milestone (Priority: HIGH)
**Files:**
- `src/content/overlay-wizard/screens/SuccessScreen.tsx` (MODIFY)
- `src/content/overlay-wizard/screens/MilestoneScreen.tsx` (NEW)
- `src/content/overlay-wizard/OverlayWizard.tsx` (MODIFY)
- `src/content/wizard-styles.css` (MODIFY)

**Tasks:**
1. Add permanent share link to Success Screen
2. Create Milestone Screen component with all 3 variants
3. Add milestone detection logic to OverlayWizard
4. Implement milestone dismiss handlers
5. Add CSS for share link and milestone
6. Test milestone triggering at exact counts

**Testing:**
- Create 9, 10, 11 GIFs and verify milestone shows only at 10
- Verify share link always visible on Success Screen
- Test share link opens Twitter with pre-filled tweet
- Test milestone dismiss functionality
- Test milestone action clicks (rate, share, github)

---

### Phase 3: Share Dialog (Priority: MEDIUM)
**Files:**
- `src/content/overlay-wizard/components/ShareDialog.tsx` (NEW)
- `src/content/wizard-styles.css` (MODIFY)

**Tasks:**
1. Create ShareDialog component with modal overlay
2. Implement Twitter share URL generation
3. Add copy-to-clipboard with feedback
4. Integrate with Success Screen and Milestone Screen
5. Add ESC and click-outside close handlers
6. Test copy feedback animation

**Testing:**
- Test Twitter URL generation with all templates
- Verify copy-to-clipboard works
- Test modal dismiss behaviors
- Verify no layout shifts

---

### Phase 4: Popup Footer (Priority: MEDIUM)
**Files:**
- `src/popup/popup-modern.tsx` (MODIFY)
- `src/popup/styles.css` (if separate) or inline styles

**Tasks:**
1. Add footer component to popup
2. Implement qualification check
3. Add dismiss functionality
4. Style footer to match popup design
5. Test responsive behavior

**Testing:**
- Verify footer only shows when qualified
- Test dismiss persistence
- Verify links work correctly
- Test on different screen sizes

---

### Phase 5: Feedback Screen Enhancement (Priority: LOW)
**Files:**
- `src/content/overlay-wizard/screens/FeedbackScreen.tsx` (MODIFY)
- `src/content/wizard-styles.css` (MODIFY)

**Tasks:**
1. Add "Show Your Support" section
2. Style buttons to match existing design
3. Hook up rate and star actions
4. Test layout on different screen sizes

**Testing:**
- Verify section appears correctly
- Test button clicks
- Verify no breaking changes to existing feedback options

---

### Phase 6: Polish & Optimization (Priority: LOW)
**Tasks:**
1. Optimize engagement tracker queries (caching)
2. Add telemetry (optional, local only)
3. Comprehensive E2E testing
4. Update documentation

**Testing:**
- Full user journey testing (install → 50 GIFs)
- Performance testing (storage queries)
- Cross-browser testing (Chrome, Edge, Brave)

---

## Integration Points

### Background Script (src/background/index.ts)
**On Extension Install:**
```typescript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    engagementTracker.initializeEngagement();
  }
});
```

### GIF Processor (src/content/gif-processor.ts)
**After Successful GIF Creation:**
```typescript
async function onGifCreated() {
  // ... existing code ...

  await engagementTracker.incrementGifCount();

  // ... show success screen ...
}
```

### Overlay Wizard (src/content/overlay-wizard/OverlayWizard.tsx)
**After GIF Processing:**
```typescript
const handleProcessingComplete = async () => {
  const stats = await engagementTracker.getEngagementStats();
  const gifCount = stats.totalGifsCreated;

  // Check milestone
  if ([10, 25, 50].includes(gifCount)) {
    const shouldShow = await engagementTracker.shouldShowMilestone(gifCount);
    if (shouldShow) {
      setScreen('milestone');
      setMilestoneCount(gifCount);
      return;
    }
  }

  // Standard success
  setScreen('success');
};
```

---

## Testing Strategy

### Unit Tests
**Files to test:**
- `engagement-tracker.ts`: All methods, edge cases
- `social-templates.ts`: Template generation, URL encoding
- `links.ts`: URL validity

**Test cases:**
- Qualification logic (various GIF counts, install dates)
- Prompt history tracking (shown, dismissed, clicked)
- Milestone eligibility (exact counts, already shown)
- Storage persistence and retrieval
- Edge cases (negative counts, future dates, etc.)

### E2E Tests
**Scenarios:**
1. **New user journey:**
   - Install extension
   - Create 1-9 GIFs → no CTA shown
   - Wait 14 days (mock time)
   - Create 10th GIF → milestone shown
   - Dismiss milestone
   - Create 11th GIF → CTA card shown on success screen

2. **Power user journey:**
   - Create 10 GIFs, dismiss CTA
   - Create 20th GIF → secondary prompt shown
   - Click "Rate" → opens Web Store
   - Create 25th GIF → milestone shown
   - Create 50th GIF → final milestone shown

3. **Popup footer:**
   - Qualify for CTA
   - Open popup → footer visible
   - Dismiss footer
   - Reopen popup → footer gone

4. **Share dialog:**
   - Trigger share from success screen
   - Select template
   - Copy link → verify clipboard
   - Open Twitter → verify pre-filled tweet

### Manual Testing Checklist
- [ ] Install extension, verify engagement initialized
- [ ] Create GIF, verify count increments
- [ ] Mock time forward 14 days
- [ ] Create 10th GIF, verify milestone shows
- [ ] Dismiss milestone, verify it doesn't show again
- [ ] Create 11th GIF, verify CTA card shows
- [ ] Click "Rate", verify Web Store opens
- [ ] Click "Share", verify dialog opens
- [ ] Copy link, verify clipboard
- [ ] Click "Star", verify GitHub opens
- [ ] Dismiss CTA, verify it doesn't show until 20 GIFs
- [ ] Open popup, verify footer shows
- [ ] Dismiss footer, verify persistence
- [ ] Open feedback screen, verify new section

---

## Privacy & Compliance

### Data Collection
**What we track (locally only):**
- Installation date
- Total GIFs created
- CTA prompt history (shown, dismissed, clicked action)
- Milestone history (shown)

**What we DON'T track:**
- Video URLs or titles
- User identity
- External analytics
- IP addresses
- Browsing behavior

### Storage
- All data in `chrome.storage.local`
- No external servers
- No network requests for tracking
- User can clear data via browser settings

### User Control
- All CTAs are dismissible
- Limited frequency (max 2 prompts)
- No blocking modals
- No negative consequences for dismissing

### Chrome Web Store Compliance
- No deceptive patterns
- Clear CTAs (not misleading)
- Respects user attention
- Follows best practices for review requests
- No incentivized reviews

---

## Chrome Web Store URL Update

**Before publishing:**
1. Submit extension to Chrome Web Store
2. Get extension ID from dashboard
3. Update `src/constants/links.ts`:
   ```typescript
   WEBSTORE_LISTING: 'https://chrome.google.com/webstore/detail/ytgify/[ACTUAL_ID]',
   WEBSTORE_REVIEWS: 'https://chrome.google.com/webstore/detail/ytgify/[ACTUAL_ID]/reviews',
   ```
4. Update social templates in `social-templates.ts`
5. Build and test
6. Submit update

**Until then:**
- Use placeholder URL
- Consider GitHub repo link as fallback
- Or hide "Rate" button until live

---

## Success Metrics (Local Analytics Only)

**Track locally (no external reporting):**
- CTAs shown: primary, secondary, milestone
- Actions taken: rate, share, github
- Dismissals: primary, secondary, popup footer
- Time between install and first GIF
- GIF creation frequency

**Use for:**
- Product decisions (which CTAs work best)
- Debugging (is tracking working correctly)
- User-facing stats (show user their own activity)

**Never:**
- Send to external server
- Aggregate across users
- Identify individual users
- Sell or share data

---

## Rollout Plan

### Version 1.0.7 (Phase 1 + 2)
- Engagement tracking system
- Success Screen CTA card
- Milestone celebrations
- Basic social templates

**Goals:**
- Validate tracking logic
- Get initial user feedback on milestone timing
- Test CTA effectiveness

### Version 1.0.8 (Phase 3 + 4)
- Share dialog with templates
- Popup footer
- Polish animations

**Goals:**
- Improve social sharing experience
- Increase CTA visibility in popup

### Version 1.0.9 (Phase 5 + 6)
- Enhanced Feedback screen
- Final polish
- Performance optimizations

**Goals:**
- Complete feature set
- Optimize performance
- Comprehensive testing

---

## Documentation Updates

**Files to update:**
- `README.md`: Mention community support features
- `CONTRIBUTING.md`: Add note about CTA system
- `docs/user-guide.md`: Explain milestone celebrations
- `docs/privacy-policy.md`: Document engagement tracking
- `CHANGELOG.md`: Document new features

---

## Open Questions

1. **Chrome Web Store Extension ID:**
   - Need actual ID before going live
   - Update all references in constants

2. **Alternative Social Platforms:**
   - Should we add more platforms (Bluesky, Mastodon)?
   - Keep it simple vs. comprehensive?

3. **GitHub Engagement:**
   - Track GitHub stars/issues separately?
   - Different CTA for GitHub contributors?

4. **A/B Testing:**
   - Test different milestone thresholds (10 vs 5)?
   - Test different timings (14 days vs 7 days)?
   - Would require feature flags

5. **User Feedback:**
   - Monitor GitHub issues for CTA complaints
   - Be ready to adjust timing/frequency if needed

---

## Maintenance

### Regular Updates
- Monitor Chrome Web Store review sentiment
- Track GitHub star growth
- Monitor social mentions
- Adjust messaging based on feedback

### Potential Adjustments
- If too intrusive: increase thresholds
- If not effective: adjust timing earlier
- If specific CTA underperforms: revise copy
- If users request disable: add settings toggle

---

## Conclusion

This implementation provides a comprehensive, privacy-respecting, and non-intrusive marketing CTA system that encourages organic growth through multiple channels while maintaining the user-first philosophy of YTGify.

**Key Success Factors:**
- Conservative timing (deep engagement required)
- Multiple touchpoints (success, milestone, popup, feedback)
- User control (all dismissible, limited frequency)
- Multi-channel (reviews, social, GitHub, word-of-mouth)
- Privacy-first (local tracking only)

**Next Steps:**
1. Review plan and mockups
2. Begin Phase 1 implementation
3. Test thoroughly at each phase
4. Gather user feedback
5. Iterate based on data and feedback
